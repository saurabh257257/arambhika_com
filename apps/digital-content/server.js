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
app.get('/login.html', (req, res) => (isAuthed(req) ? res.redirect('/studio.html') : page('login.html')(req, res)));
app.get('/image-generator.html', requireAuth, page('image-generator.html'));
app.get('/studio.html', requireAuth, page('studio.html'));
app.get('/', (req, res) => res.redirect(isAuthed(req) ? '/studio.html' : '/login.html'));

// ── Image upload setup ────────────────────────────────────────

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, '-')),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// ── Library: every generated post, kept by product category ───────────────
const dataUrlExt = (u) => { const m = /^data:image\/(jpeg|png|webp);base64,/.exec(String(u)); return m ? (m[1] === 'jpeg' ? 'jpg' : m[1]) : null; };
app.post('/api/creatives', (req, res) => {
  const b = req.body || {};
  const imgs = Array.isArray(b.images) ? b.images.slice(0, 10) : [];
  const saved = [];
  try {
    for (const u of imgs) {
      const ext = dataUrlExt(u);
      if (!ext) throw new Error('Images must be JPEG, PNG or WebP');
      const buf = Buffer.from(String(u).split(',')[1], 'base64');
      if (!buf.length || buf.length > 12 * 1024 * 1024) throw new Error('Image is empty or too large');
      const name = 'creative-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '.' + ext;
      fs.writeFileSync(path.join(uploadsDir, name), buf);
      saved.push(name);
    }
  } catch (e) {
    saved.forEach((n) => { try { fs.unlinkSync(path.join(uploadsDir, n)); } catch (x) {} });
    return res.status(400).json({ error: e.message });
  }
  const str = (v, n) => String(v == null ? '' : v).slice(0, n);
  const r = db.prepare('INSERT INTO creatives (channel, template, category, title, caption, images, products) VALUES (?,?,?,?,?,?,?)')
    .run(str(b.channel, 40), str(b.template, 80), str(b.category, 120) || 'General', str(b.title, 160), str(b.caption, 5000), JSON.stringify(saved), JSON.stringify((Array.isArray(b.products) ? b.products : []).slice(0, 20).map((x) => str(x, 160))));
  res.json({ success: true, id: r.lastInsertRowid });
});

app.get('/api/creatives', (req, res) => {
  const conds = [], params = [];
  if (req.query.category) { conds.push('category = ?'); params.push(req.query.category); }
  if (req.query.channel) { conds.push('channel = ?'); params.push(req.query.channel); }
  const rows = db.prepare('SELECT * FROM creatives' + (conds.length ? ' WHERE ' + conds.join(' AND ') : '') + ' ORDER BY id DESC LIMIT 500').all(...params);
  res.json({ data: rows.map((r) => ({ ...r, images: JSON.parse(r.images || '[]'), products: JSON.parse(r.products || '[]') })) });
});

app.delete('/api/creatives/:id', (req, res) => {
  const row = db.prepare('SELECT images FROM creatives WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  JSON.parse(row.images || '[]').forEach((n) => { try { fs.unlinkSync(path.join(uploadsDir, path.basename(n))); } catch (e) {} });
  db.prepare('DELETE FROM creatives WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Upload a photo or logo to use as a reference or as the brand logo (images only).
app.post('/api/uploads', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose an image to upload' });
  const ext = path.extname(req.file.filename).toLowerCase();
  if (!BYTEPLUS_MIME[ext]) {
    try { fs.unlinkSync(req.file.path); } catch (e) {}
    return res.status(400).json({ error: 'Use a JPG, PNG, WebP, GIF or BMP image' });
  }
  res.json({ filename: req.file.filename, url: '/uploads/' + req.file.filename });
});

// ── Products ─────────────────────────────────────────────────────
app.get('/api/products', (req, res) => {
  const { category, search } = req.query;
  let sql = 'SELECT * FROM products';
  const params = [], conds = [];
  if (category) { conds.push('category = ?'); params.push(category); }
  if (search) { conds.push('(name LIKE ? OR sku LIKE ? OR category LIKE ? OR details LIKE ?)'); params.push(...Array(4).fill(`%${search}%`)); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY cat_order, category, CAST(sku AS INTEGER)'; // same category order as the website
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

// ── Live website catalogue ────────────────────────────────────────
// The tool's product list mirrors what is on the website. Importing downloads each photo into the
// uploads folder, so the picker and the image generator work from the same local files as before.
// Removing a product only removes it from this tool; the website and Zoho are never touched.
try { db.exec("ALTER TABLE products ADD COLUMN source TEXT DEFAULT ''"); } catch (e) {}
db.exec('CREATE TABLE IF NOT EXISTS website_removed (sku TEXT PRIMARY KEY)');
try { db.exec("ALTER TABLE products ADD COLUMN collections TEXT DEFAULT '[]'"); } catch (e) {}
try { db.exec('ALTER TABLE products ADD COLUMN cat_order INTEGER DEFAULT 999'); } catch (e) {}
try { db.exec("ALTER TABLE products ADD COLUMN image_src TEXT DEFAULT '[]'"); } catch (e) {}
db.exec('CREATE TABLE IF NOT EXISTS sync_meta (k TEXT PRIMARY KEY, v TEXT)');
db.exec(`CREATE TABLE IF NOT EXISTS creatives (
  id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT DEFAULT (datetime('now')),
  channel TEXT, template TEXT, category TEXT, title TEXT, caption TEXT, images TEXT DEFAULT '[]', products TEXT DEFAULT '[]'
)`);
const WEBSITE_URL = (process.env.WEBSITE_URL || 'https://www.arambhika.com').replace(/[/]+$/, '');

async function importWebsiteCatalog({ restore = false } = {}) {
  const res = await fetch(WEBSITE_URL + '/products.json', { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error('Website catalogue returned ' + res.status);
  const body = await res.json();
  db.exec('DELETE FROM website_removed'); // the tool always mirrors the whole website catalogue
  const removed = new Set(db.prepare('SELECT sku FROM website_removed').all().map((r) => r.sku));
  // collections as set up in Zoho Commerce (18650, 21700, 32650 ...): product name -> collection names
  const collectionsByProduct = new Map();
  for (const col of body.collections || []) {
    for (const code of col.products || []) {
      if (!collectionsByProduct.has(code)) collectionsByProduct.set(code, []);
      collectionsByProduct.get(code).push(col.name);
    }
  }
  const result = { added: 0, updated: 0, skipped: 0, images: 0, removed: 0 };
  const seen = new Set();
  let catIndex = 0;
  for (const cat of body.categories || []) {
    catIndex += 1;
    for (const item of cat.products || []) {
      const sku = String(item.SKU || item.ProductCode || '').trim();
      const name = String(item.ProductCode || '').trim();
      if (!sku || !name || name === 'T') continue;
      seen.add(sku);
      if (removed.has(sku)) { result.skipped += 1; continue; }
      const price = item.Price == null ? '' : String(item.Price);
      const details = (Array.isArray(item.Additional_Details) ? item.Additional_Details.filter(Boolean).join('\n') : '') || String(item.Description_Text || '').slice(0, 1500);
      const avail = /out of stock|^no$/i.test(String(item.Availability || '')) ? 'no' : 'yes';
      const existing = db.prepare("SELECT * FROM products WHERE sku=? AND source='website'").get(sku);
      let id;
      let images = [];
      if (existing) {
        id = existing.id;
        images = JSON.parse(existing.images || '[]');
        db.prepare("UPDATE products SET category=?,name=?,price=?,unit=?,min_quantity=?,availability=?,dimensions=?,details=?,updated_at=datetime('now') WHERE id=?")
          .run(cat.name, name, price, item.Unit || '', Number(item['Minimum Quantity']) || 1, avail, item.Product_Dimensions || '', details, id);
        result.updated += 1;
      } else {
        const r = db.prepare("INSERT INTO products (sku,category,name,price,unit,min_quantity,availability,dimensions,details,flag_for_website,flag_reference_image,source) VALUES (?,?,?,?,?,?,?,?,?,1,1,'website')")
          .run(sku, cat.name, name, price, item.Unit || '', Number(item['Minimum Quantity']) || 1, avail, item.Product_Dimensions || '', details);
        id = r.lastInsertRowid;
        result.added += 1;
      }
      const links = (Array.isArray(item.Image_Link) ? item.Image_Link : [item.Image_Link]).filter((l) => typeof l === 'string' && l.startsWith('/zimg/'));
      // The photos are re-downloaded whenever the website's list of photos for this product differs from what was
      // downloaded last time (a replaced, added, removed or reordered photo in Zoho), not only when there are none.
      const prevSrc = existing ? existing.image_src : '[]';
      if (existing && prevSrc !== JSON.stringify(links)) {
        images.forEach((f) => { try { fs.unlinkSync(path.join(uploadsDir, path.basename(f))); } catch (e) {} });
        images = [];
      }
      for (let i = 0; i < links.length && images.length < links.length; i += 1) {
        const ext = (path.extname(links[i].split('?')[0]) || '.jpg').toLowerCase().replace(/[^.a-z0-9]/g, '');
        const file = `web_${id}_${images.length + 1}_${crypto.createHash('md5').update(links[i]).digest('hex').slice(0, 8)}${ext || '.jpg'}`; // named after its source, so a replaced photo is never served from a browser's cache
        try {
          const ir = await fetch(WEBSITE_URL + links[i], { signal: AbortSignal.timeout(20000) });
          if (!ir.ok) continue;
          fs.writeFileSync(path.join(uploadsDir, file), Buffer.from(await ir.arrayBuffer()));
          images.push(file); result.images += 1;
        } catch (e) { console.error('Image import failed:', e.message); }
      }
      db.prepare('UPDATE products SET flag_reference_image=1, cat_order=? WHERE id=?').run(catIndex, id);
      db.prepare('UPDATE products SET images=?, collections=?, image_src=? WHERE id=?').run(JSON.stringify(images), JSON.stringify(collectionsByProduct.get(name) || []), images.length === links.length ? JSON.stringify(links) : '[]', id);
      syncAvailabilityFlags(id);
    }
  }
  // products that are no longer on the website are removed here too
  for (const row of db.prepare("SELECT id, sku, images FROM products WHERE source = 'website'").all()) {
    if (seen.has(row.sku)) continue;
    JSON.parse(row.images || '[]').forEach((f) => { try { fs.unlinkSync(path.join(uploadsDir, path.basename(f))); } catch (e) {} });
    db.prepare('DELETE FROM products WHERE id=?').run(row.id);
    result.removed += 1;
  }
  db.prepare("INSERT INTO sync_meta (k, v) VALUES ('last_sync', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(String(Date.now()));
  return result;
}

// When the product list was last refreshed from the website, and from where.
app.get('/api/sync-status', (req, res) => {
  const row = db.prepare("SELECT v FROM sync_meta WHERE k = 'last_sync'").get();
  res.json({ lastSync: row ? Number(row.v) : null, source: WEBSITE_URL, count: db.prepare('SELECT COUNT(*) AS n FROM products').get().n });
});

// The generator calls this every time it opens: the product list is refreshed from the website (Zoho Commerce).
app.post('/api/products/sync-if-stale', async (req, res) => {
  const row = db.prepare("SELECT v FROM sync_meta WHERE k = 'last_sync'").get();
  const age = row ? Date.now() - Number(row.v) : Infinity;
  if (age < 30 * 1000) return res.json({ success: true, synced: false, lastSync: Number(row.v) }); // a refresh every time the generator opens, at most every 30 seconds
  try { const r = await importWebsiteCatalog({}); res.json({ success: true, synced: true, lastSync: Date.now(), ...r }); }
  catch (e) { res.json({ success: false, synced: false, error: e.message }); }
});

app.post('/api/products/import-website', async (req, res) => {
  try { const r = await importWebsiteCatalog({ restore: !!(req.body && req.body.restore) }); res.json({ success: true, lastSync: Date.now(), ...r }); }
  catch (e) { res.status(502).json({ error: 'Could not load the website catalogue: ' + e.message }); }
});

// bulk remove (from this tool only); website items are remembered so a re-import does not bring them back
app.post('/api/products/bulk-delete', (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
  let n = 0;
  for (const id of ids) {
    const p = db.prepare('SELECT * FROM products WHERE id=?').get(id);
    if (!p) continue;
    JSON.parse(p.images || '[]').forEach((f) => { try { fs.unlinkSync(path.join(uploadsDir, path.basename(f))); } catch (e) {} });
    if (p.source === 'website') db.prepare('INSERT OR IGNORE INTO website_removed (sku) VALUES (?)').run(p.sku);
    db.prepare('DELETE FROM products WHERE id=?').run(id);
    n += 1;
  }
  res.json({ success: true, removed: n });
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
    const { model, size, response_format, region, referenceImages, imageUrl, noLogo } = req.body;
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
      if (!noLogo && fs.existsSync(LOGO_PATH)) {
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
// WhatsApp marketing message: short, plain, with a clear next step.
app.post('/api/anthropic/generate-whatsapp', async (req, res) => {
  try {
    const { brief, productContext, tone, language, brand } = req.body || {};
    if (!brief) return res.status(400).json({ error: 'brief is required' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(400).json({ error: 'ANTHROPIC_API_KEY not set' });
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: 'You write WhatsApp marketing messages for Arambhika, an Indian B2B manufacturer and supplier of nickel strips, copper and aluminium busbars, BMS and lithium battery components in Noida. Write one message under 700 characters. Use WhatsApp formatting (*bold* for the first line and key facts), short lines, at most two emojis, no hashtags. Include one clear next step (reply, call or visit the website). Never invent prices, stock or numbers: only use the facts given. Match the requested tone and language. Output only the message text.',
      messages: [{ role: 'user', content: 'Task: ' + brief + '\nTone: ' + (tone || 'Professional') + '\nLanguage: ' + (language || 'English') + (productContext ? '\nProduct facts: ' + productContext : '') + (brand ? '\nContact: WhatsApp ' + (brand.wa || '') + ', website ' + (brand.web || '') + ', ' + (brand.loc || '') : '') }],
    });
    res.json({ message: msg.content[0].text.trim() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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
