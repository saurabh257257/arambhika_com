require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const Database = require('better-sqlite3');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', 1); // behind nginx

// There is no built-in default password any more: the tool refuses to start without one.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
if (!ADMIN_PASSWORD) {
  console.error('ADMIN_PASSWORD is not set. Refusing to start without a login password.');
  process.exit(1);
}

const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ── Database ───────────────────────────────────────────────────
// DB_PATH lets local dev point the db outside OneDrive-synced folders —
// background sync can lock/truncate a SQLite file mid-write. Points at the
// same shopmanager.db as the CRM app so the product catalog (with images)
// is shared rather than duplicated.
const dbPath = process.env.DB_PATH || path.join(__dirname, 'shopmanager.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT, category TEXT, name TEXT,
    price TEXT, new_price TEXT,
    availability TEXT DEFAULT 'yes',
    unit TEXT, min_quantity INTEGER DEFAULT 1,
    dimensions TEXT, details TEXT,
    specs TEXT DEFAULT '{}',
    applications TEXT,
    images TEXT DEFAULT '[]',
    flag_for_website INTEGER DEFAULT 0,
    flag_available INTEGER DEFAULT 0,
    flag_out_of_stock INTEGER DEFAULT 0,
    quantity REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);
// Added after the table above was already live in the shared CRM db, so it
// needs its own migration rather than just living in the CREATE TABLE.
try { db.exec("ALTER TABLE products ADD COLUMN flag_reference_image INTEGER DEFAULT 0"); } catch (e) {}

app.use(compression());
app.use(express.json({ limit: '15mb' }));

// ── Authentication ──────────────────────────────────────────────
// A signed cookie issued at login. Every page, API call and uploaded image is checked on the
// server; hiding things in the browser is not what protects them.
const COOKIE = 'dc_session';
const SESSION_HOURS = 12;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const sign = (payload) => crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
function issueSession() {
  const expires = Date.now() + SESSION_HOURS * 3600 * 1000;
  return `${expires}.${sign(String(expires))}`;
}
function isAuthed(req) {
  const raw = (req.headers.cookie || '').split(';').map((p) => p.trim()).find((p) => p.startsWith(COOKIE + '='));
  if (!raw) return false;
  const [expires, mac] = decodeURIComponent(raw.slice(COOKIE.length + 1)).split('.');
  return Boolean(expires && mac && Number(expires) > Date.now() && safeEqual(mac, sign(expires)));
}
function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  if (req.path.startsWith('/api/') || req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Please sign in' });
  return res.redirect('/login.html');
}

app.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow'); // an internal tool, never to be indexed
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// login: at most 10 tries per address per 10 minutes
const loginTries = new Map();
app.post('/api/auth/login', (req, res) => {
  const now = Date.now();
  const tries = (loginTries.get(req.ip) || []).filter((t) => t > now - 10 * 60 * 1000);
  if (tries.length >= 10) return res.status(429).json({ success: false, error: 'Too many attempts. Please wait a few minutes.' });
  const password = String((req.body && req.body.password) || '').trim();
  if (!password) return res.status(400).json({ success: false, error: 'Password required' });
  if (!safeEqual(password, ADMIN_PASSWORD)) {
    tries.push(now); loginTries.set(req.ip, tries);
    return res.status(401).json({ success: false, error: 'Incorrect password' });
  }
  loginTries.delete(req.ip);
  res.cookie(COOKIE, issueSession(), {
    httpOnly: true, sameSite: 'lax', secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    maxAge: SESSION_HOURS * 3600 * 1000, path: '/',
  });
  res.json({ success: true, role: 'admin', name: 'Admin' });
});
app.post('/api/auth/logout', (req, res) => { res.clearCookie(COOKIE, { path: '/' }); res.json({ success: true }); });
app.get('/api/auth/me', (req, res) => res.json({ authenticated: isAuthed(req) }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// everything under /api (except /api/auth/*), the OAuth helpers and the uploaded images need a session
app.use('/api', (req, res, next) => (req.path.startsWith('/auth/') ? next() : requireAuth(req, res, next)));
app.use('/auth', requireAuth);
app.use('/uploads', requireAuth, express.static(uploadsDir, { dotfiles: 'deny', index: false }));

// only the front-end files are served: not server.js, package.json, the database or .env
app.use('/css', express.static(path.join(__dirname, 'css'), { maxAge: '1h' }));
app.use('/js', express.static(path.join(__dirname, 'js'), { maxAge: '1h' }));
app.use('/assets', express.static(path.join(__dirname, 'assets'), { maxAge: '1d' }));
const page = (file) => (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(__dirname, file)); };
app.get('/login.html', (req, res) => (isAuthed(req) ? res.redirect('/image-generator.html') : page('login.html')(req, res)));
app.get('/image-generator.html', requireAuth, page('image-generator.html'));
app.get('/products.html', requireAuth, page('products.html'));
app.get('/', (req, res) => res.redirect(isAuthed(req) ? '/image-generator.html' : '/login.html'));

// ── Image upload setup ────────────────────────────────────────

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, '-')),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// ── Products ─────────────────────────────────────────────────────
app.get('/api/products', (req, res) => {
  const { category, search } = req.query;
  let sql = 'SELECT * FROM products';
  const params = [], conds = [];
  if (category) { conds.push('category = ?'); params.push(category); }
  if (search) { conds.push('(name LIKE ? OR sku LIKE ? OR category LIKE ? OR details LIKE ?)'); params.push(...Array(4).fill(`%${search}%`)); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY category, CAST(sku AS INTEGER)';
  res.json({ data: db.prepare(sql).all(...params) });
});

app.get('/api/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});

// Available / Out of Stock are read from inventory, not set by hand: they're
// a pure function of quantity, except for flag_for_website products (not
// inventory-tracked at all — "On Request" instead, so neither flag applies).
function syncAvailabilityFlags(productId) {
  const p = db.prepare('SELECT quantity, flag_for_website FROM products WHERE id=?').get(productId);
  if (!p) return;
  const available = !p.flag_for_website && (p.quantity || 0) > 0;
  const outOfStock = !p.flag_for_website && (p.quantity || 0) <= 0;
  db.prepare('UPDATE products SET flag_available=?, flag_out_of_stock=? WHERE id=?')
    .run(available ? 1 : 0, outOfStock ? 1 : 0, productId);
}

app.post('/api/products', (req, res) => {
  const p = req.body;
  // New products aren't in inventory until someone explicitly adds them there
  // (client confirmation workflow) -- default flag_for_website to 1 unless the
  // caller says otherwise.
  const flagForWebsite = p.flag_for_website === undefined ? 1 : (p.flag_for_website ? 1 : 0);
  const r = db.prepare(`INSERT INTO products (sku,category,name,price,new_price,availability,unit,min_quantity,dimensions,details,specs,applications,images,flag_for_website,flag_reference_image) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(p.sku, p.category, p.name, p.price, p.new_price || '', p.availability || 'yes', p.unit, p.min_quantity || 1, p.dimensions || '', p.details || '', JSON.stringify(p.specs || {}), p.applications || '', '[]', flagForWebsite, p.flag_reference_image ? 1 : 0);
  syncAvailabilityFlags(r.lastInsertRowid);
  res.json({ success: true, id: r.lastInsertRowid });
});

app.put('/api/products/:id', (req, res) => {
  const p = req.body;
  db.prepare(`UPDATE products SET sku=?,category=?,name=?,price=?,new_price=?,availability=?,unit=?,min_quantity=?,dimensions=?,details=?,specs=?,applications=?,flag_for_website=?,flag_reference_image=?,updated_at=datetime('now') WHERE id=?`)
    .run(p.sku, p.category, p.name, p.price, p.new_price || '', p.availability, p.unit, p.min_quantity, p.dimensions || '', p.details || '', JSON.stringify(p.specs || {}), p.applications || '', p.flag_for_website ? 1 : 0, p.flag_reference_image ? 1 : 0, req.params.id);
  syncAvailabilityFlags(req.params.id);
  res.json({ success: true });
});

app.patch('/api/products/:id/flags', (req, res) => {
  const { flag_for_website, flag_reference_image } = req.body;
  const updates = [], params = [];
  if (flag_for_website !== undefined) { updates.push('flag_for_website=?'); params.push(flag_for_website ? 1 : 0); }
  if (flag_reference_image !== undefined) { updates.push('flag_reference_image=?'); params.push(flag_reference_image ? 1 : 0); }
  if (!updates.length) return res.status(400).json({ error: 'No flags provided' });
  params.push(req.params.id);
  db.prepare(`UPDATE products SET ${updates.join(', ')}, updated_at=datetime('now') WHERE id=?`).run(...params);
  if (flag_for_website !== undefined) syncAvailabilityFlags(req.params.id);
  res.json({ success: true });
});

app.delete('/api/products/:id', (req, res) => {
  const p = db.prepare('SELECT images FROM products WHERE id=?').get(req.params.id);
  if (p) {
    JSON.parse(p.images || '[]').forEach(f => {
      const fp = path.join(uploadsDir, f);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    });
  }
  db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// Image upload
app.post('/api/products/:id/images', upload.array('images', 10), (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  const existing = JSON.parse(p.images || '[]');
  const safeId = String(p.id);
  const safeSku = (p.sku || 'sku').replace(/[^a-zA-Z0-9]/g, '_');
  const safeCat = (p.category || 'cat').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
  const safeName = (p.name || 'product').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
  const newFiles = req.files.map((f, i) => {
    const ext = path.extname(f.originalname).toLowerCase() || '.jpg';
    const idx = existing.length + i + 1;
    const newName = `${safeId}_${safeSku}_${safeCat}_${safeName}_${idx}${ext}`;
    try {
      fs.renameSync(path.join(uploadsDir, f.filename), path.join(uploadsDir, newName));
      return newName;
    } catch (e) {
      console.error('Image rename failed:', e.message);
      return f.filename;
    }
  });
  const all = [...existing, ...newFiles];
  db.prepare('UPDATE products SET images=? WHERE id=?').run(JSON.stringify(all), req.params.id);
  res.json({ success: true, images: all });
});

app.delete('/api/products/:id/images/:filename', (req, res) => {
  const p = db.prepare('SELECT images FROM products WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const images = JSON.parse(p.images || '[]').filter(f => f !== req.params.filename);
  db.prepare('UPDATE products SET images=? WHERE id=?').run(JSON.stringify(images), req.params.id);
  const fp = path.join(uploadsDir, path.basename(req.params.filename)); // never leave the uploads folder
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  res.json({ success: true });
});

// ── Image rename to id_sku_category_name_N ───────────────────────────
app.post('/api/products/:id/rename-images', (req, res) => {
  try {
    const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    const images = JSON.parse(p.images || '[]');
    const safeId = String(p.id);
    const safeSku = (p.sku || 'sku').replace(/[^a-zA-Z0-9]/g, '_');
    const safeCat = (p.category || 'cat').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
    const safeName = (p.name || 'product').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
    const newImages = images.map((oldFile, i) => {
      const ext = path.extname(oldFile).toLowerCase() || '.jpg';
      const newFile = `${safeId}_${safeSku}_${safeCat}_${safeName}_${i + 1}${ext}`;
      const oldPath = path.join(uploadsDir, oldFile);
      const newPath = path.join(uploadsDir, newFile);
      if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) fs.renameSync(oldPath, newPath);
      return fs.existsSync(newPath) ? newFile : oldFile;
    });
    db.prepare('UPDATE products SET images=? WHERE id=?').run(JSON.stringify(newImages), req.params.id);
    res.json({ success: true, images: newImages });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Publishing ──────────────────────────────────────────────────
// This tool only GENERATES images and text. Nothing here posts to Instagram, LinkedIn or any other
// network; copy or download the result and publish it yourself.

// ── BytePlus ModelArk — image generation ───────────────────────
// REST API docs: https://docs.byteplus.com/en/docs/ModelArk/1541523
const BYTEPLUS_REGIONS = {
  'ap-southeast-1': 'https://ark.ap-southeast.bytepluses.com/api/v3/images/generations',
  'eu-west-1': 'https://ark.eu-west.bytepluses.com/api/v3/images/generations',
};

const BYTEPLUS_MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp' };

// Real logo, always fed in as a reference — never let the model invent or
// approximate the wordmark. Copied into assets/ (not read from outside the
// app) so the path still resolves once this is deployed.
const LOGO_PATH = path.join(__dirname, 'assets', 'arambhika-logo.jpeg');

app.post('/api/byteplus/generate-image', async (req, res) => {
  try {
    const key = process.env.BYTEPLUS_API_KEY;
    if (!key) return res.status(400).json({ error: 'BYTEPLUS_API_KEY not set in .env' });
    const { model, size, response_format, region, referenceImages, imageUrl } = req.body;
    let { prompt } = req.body;
    if (!model || !prompt) return res.status(400).json({ error: 'model and prompt are required' });

    // Base64-encode local references (works on localhost and once deployed,
    // since BytePlus's servers can never reach localhost). imageUrl is used
    // as-is instead — the "regenerate with feedback" flow passes the previous
    // BytePlus result URL straight through; that image already has the logo
    // baked in from its own generation, so the logo isn't re-added there.
    let image;
    if (imageUrl) {
      image = imageUrl;
    } else {
      const refs = [];
      const noteLines = [];
      if (fs.existsSync(LOGO_PATH)) {
        refs.push(`data:image/jpeg;base64,${fs.readFileSync(LOGO_PATH).toString('base64')}`);
        noteLines.push(`Reference image ${refs.length} is the exact Arambhika Enablers logo (wordmark + bolt icon) — reproduce it exactly as shown, do not redraw, restyle, or approximate it.`);
      }
      const refImageList = Array.isArray(referenceImages) ? referenceImages : (referenceImages ? [referenceImages] : []);
      for (const referenceImage of refImageList) {
        const safeName = path.basename(referenceImage);
        const filePath = path.join(uploadsDir, safeName);
        if (!fs.existsSync(filePath)) return res.status(400).json({ error: `Reference image ${safeName} not found` });
        const ext = path.extname(safeName).toLowerCase();
        const mime = BYTEPLUS_MIME[ext];
        if (!mime) return res.status(400).json({ error: `Unsupported reference image format: ${ext}` });
        refs.push(`data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`);
        noteLines.push(`Reference image ${refs.length} is an exact product photo — keep it accurate and unaltered.`);
      }
      if (refs.length) {
        image = refs.length === 1 ? refs[0] : refs;
        prompt = noteLines.join(' ') + '\n\n' + prompt;
      }
    }

    const url = BYTEPLUS_REGIONS[region] || BYTEPLUS_REGIONS['ap-southeast-1'];
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model,
        prompt,
        ...(image ? { image } : {}),
        size: size || '2K',
        watermark: false, // BytePlus's own "AI generated" disclosure stamp — we stamp our own logo instead, below
        response_format: response_format || 'url',
      }),
    });
    const j = await r.json();
    if (!r.ok || j.error) return res.status(r.status || 500).json({ error: j.error?.message || j.error || 'BytePlus request failed' });

    // Save a durable local copy of every generated image — BytePlus's
    // own result URLs are only valid 24h. No compositing here: the only
    // logo in the image is the one the model draws in per the prompt
    // (top-left) — we no longer stamp a second one on top. rawUrl and url
    // end up identical here, but rawUrl is kept so "regenerate with
    // feedback" always has an explicit source to edit from. Never let a
    // save hiccup fail the generation the user is waiting on.
    if (Array.isArray(j.data)) {
      const publicBase = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
      await Promise.all(j.data.map(async (item, i) => {
        if (!item.url) return;
        item.rawUrl = item.url;
        try {
          const sourceRes = await fetch(item.url);
          if (!sourceRes.ok) throw new Error(`Failed to download generated image (${sourceRes.status})`);
          const sourceBuffer = Buffer.from(await sourceRes.arrayBuffer());
          const contentType = sourceRes.headers.get('content-type') || 'image/jpeg';
          const ext = contentType.includes('png') ? 'png' : 'jpg';
          const filename = `generated-${Date.now()}-${i}.${ext}`;
          fs.writeFileSync(path.join(uploadsDir, filename), sourceBuffer);
          item.url = `${publicBase}/uploads/${filename}`;
        } catch (e) {
          console.error('Saving a local copy failed, using the raw BytePlus url:', e.message);
        }
      }));
    }

    res.json(j);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Anthropic — Instagram caption / LinkedIn post generation ───
// Claude Haiku 4.5 — the cheapest current Claude model — is plenty for a
// short social caption/post and keeps this cheap to run on every click.
app.post('/api/anthropic/generate-caption', async (req, res) => {
  try {
    const { prompt, productContext } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      system: 'You write Instagram captions for Arambhika Enablers, a B2B manufacturer of nickel strips, copper busbars, and battery connectors for EV/ESS battery pack makers in India. Write one caption: 2-4 short sentences, confident and technical (not gimmicky), end with a CTA line using these real contact details verbatim: "WhatsApp +91-9315545821 for Bulk Quote — 2hr response  ·  www.arambhika.com", then 4-6 relevant hashtags on a new line. Do not invent specific numbers, percentages, certifications, or customer names/counts that were not given to you — if no product facts are supplied, keep any technical claims general and qualitative instead of fabricating specifics; the WhatsApp number and website above are the only contact details you should use, and always use them exactly as given. Return ONLY the caption text, no preamble, no quotes, no markdown.',
      messages: [{
        role: 'user',
        content: `Write an Instagram caption for this image.\n\nImage brief: ${prompt}${productContext ? `\n\nProduct facts to reference accurately (do not invent numbers): ${productContext}` : ''}`,
      }],
    });
    res.json({ caption: msg.content[0].text.trim() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/anthropic/generate-linkedin-post', async (req, res) => {
  try {
    const { topic, productContext } = req.body;
    if (!topic) return res.status(400).json({ error: 'topic is required' });
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 500,
      system: 'You write LinkedIn posts for the Arambhika Enablers company page — a B2B manufacturer of nickel strips, copper busbars, and battery connectors for EV and energy storage (ESS) battery pack makers in India. Audience: procurement managers, battery pack engineers, EV/ESS OEMs. Tone: professional, confident, specific — no hype, no emoji spam (at most 1-2 tasteful emoji), no clickbait. Structure: a strong opening line, 2-4 short paragraphs or a brief bulleted list of specifics, a clear CTA (e.g. "DM us or WhatsApp for a bulk quote"), then 3-5 relevant hashtags on their own line at the end. Never invent specific numbers, percentages, certifications, customer names/counts, testimonials, or contact details (phone numbers, placeholders like "[your number]") that were not given to you — if no product facts are supplied, keep technical claims general and qualitative and let the CTA be a plain "DM us" / "WhatsApp us" with no fabricated number. Return ONLY the post text — no preamble, no quotes, no markdown formatting (the trailing hashtags are fine).',
      messages: [{
        role: 'user',
        content: `Write a LinkedIn post about: ${topic}${productContext ? `\n\nProduct facts to reference accurately (do not invent numbers): ${productContext}` : ''}`,
      }],
    });
    res.json({ post: msg.content[0].text.trim() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = app;
if (require.main === module) app.listen(PORT, () => console.log(`Digital Content server running on http://localhost:${PORT}`));
