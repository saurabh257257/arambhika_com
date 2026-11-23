// The portal: sign in, then view customers and what has happened with each. Only the admin can create members.
'use strict';
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const compression = require('compression');
const { open, TYPES } = require('./lib/db');
const mcp = require('./lib/mcp');
const oauth = require('./lib/oauth');
const books = require('./lib/books');
const { writeZip } = require('./lib/zip');
const { createSync } = require('./lib/items-sync');

const safeEqual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function createApp({ dataDir, adminPassword, sessionSecret, fetchFn, startSync = false }) {
  if (!adminPassword) throw new Error('ADMIN_PASSWORD is not set. Refusing to start without a login password.');
  const secret = sessionSecret || crypto.randomBytes(32).toString('hex');
  const repo = open(dataDir);
  const itemSync = createSync(repo, { fetchFn: fetchFn || fetch });
  const ctx = { repo };
  if (startSync) itemSync.start();

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(compression());
  // the MCP endpoint may carry a small file (base64), so it gets a bigger limit than everything else
  const smallJson = express.json({ limit: '100kb' }), mcpJson = express.json({ limit: '8mb' });
  app.use((req, res, next) => (req.path === '/mcp' ? mcpJson : smallJson)(req, res, next));
  app.use((req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN'); res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

  // ---- sessions: a signed cookie that holds who you are and when it ends ----
  const COOKIE = 'pt_session', HOURS = 12;
  const sign = (p) => crypto.createHmac('sha256', secret).update(p).digest('base64url');
  const issue = (uid) => { const p = Buffer.from(JSON.stringify({ id: uid, exp: Date.now() + HOURS * 3600 * 1000 })).toString('base64url'); return p + '.' + sign(p); };
  function sessionUser(req) {
    const raw = (req.headers.cookie || '').split(';').map((x) => x.trim()).find((x) => x.startsWith(COOKIE + '='));
    if (!raw) return null;
    const [p, mac] = decodeURIComponent(raw.slice(COOKIE.length + 1)).split('.');
    if (!p || !mac || !safeEqual(mac, sign(p))) return null;
    let d; try { d = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')); } catch (e) { return null; }
    if (!d || !(d.exp > Date.now())) return null;
    if (d.id === 'admin') return { id: 'admin', name: 'Admin', role: 'admin' };
    const m = repo.member(d.id);
    return m && m.active ? { id: m.id, name: m.name, role: m.role } : null; // a switched-off member is out at once
  }
  const requireUser = (req, res, next) => {
    const u = sessionUser(req);
    if (u) { req.user = u; return next(); }
    return req.originalUrl.startsWith('/api/') ? res.status(401).json({ error: 'Please sign in' }) : res.redirect('/login.html');
  };
  const requireAdmin = (req, res, next) => (req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admin only' }));
  app.use('/api', (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.path !== '/upload' && !/^application\/json/i.test(req.headers['content-type'] || '')) return res.status(415).json({ error: 'JSON only' });
    next();
  });

  const tries = new Map();
  app.post('/api/auth/login', (req, res) => {
    const t = Date.now(), recent = (tries.get(req.ip) || []).filter((x) => x > t - 10 * 60 * 1000);
    if (recent.length >= 10) return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes.' });
    const username = String((req.body && req.body.username) || '').trim().toLowerCase(), password = String((req.body && req.body.password) || '');
    let uid = null;
    if (username === 'admin') { if (safeEqual(password, adminPassword)) uid = 'admin'; }
    else { const m = repo.login(username, password); if (m) uid = m.id; }
    if (!uid) { recent.push(t); tries.set(req.ip, recent); return res.status(401).json({ error: 'Wrong username or password' }); }
    tries.delete(req.ip);
    res.cookie(COOKIE, issue(uid), { httpOnly: true, sameSite: 'lax', secure: req.secure || req.headers['x-forwarded-proto'] === 'https', maxAge: HOURS * 3600 * 1000, path: '/' });
    res.json({ ok: true });
  });
  app.post('/api/auth/logout', (req, res) => { res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true }); });
  app.get('/health', (req, res) => res.json({ status: 'ok', tools: mcp.TOOLS.length, schema: mcp.schemaHash() }));

  // ---- pages: only the sign-in page is open ----
  const pub = path.join(__dirname, 'public');
  const send = (f) => (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(pub, f)); };
  app.get('/login.html', (req, res, next) => (sessionUser(req) ? res.redirect('/') : send('login.html')(req, res, next)));
  app.get('/login.js', send('login.js'));
  app.get('/style.css', send('style.css'));
  app.get('/', requireUser, send('index.html'));
  app.get('/index.html', requireUser, (req, res) => res.redirect('/'));
  app.get('/portal.js', requireUser, send('portal.js'));

  oauth.install(app, repo, tries);

  // ---- MCP: signed in with a member's own key, or the token the Claude apps get after signing in (not the browser cookie) ----
  app.all(['/mcp', '/mcp/v2', '/mcp/u/:username'], async (req, res) => {
    if (req.method !== 'POST') return res.status(405).set('Allow', 'POST').json({ error: 'Use POST' });
    const t = Date.now(), recent = (tries.get('mcp' + req.ip) || []).filter((x) => x > t - 10 * 60 * 1000);
    if (recent.length >= 30) return res.status(429).json({ error: 'Too many wrong keys. Please wait a few minutes.' });
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const m = repo.memberByKey(bearer) || repo.memberByAccessToken(bearer);
    if (!m) { recent.push(t); tries.set('mcp' + req.ip, recent); return res.status(401).set('WWW-Authenticate', 'Bearer resource_metadata="' + req.protocol + '://' + req.get('host') + '/.well-known/oauth-protected-resource' + req.path + '"').json({ error: 'Missing or wrong key. Make a new one under My connection in the portal.' }); }
    tries.delete('mcp' + req.ip);
    // a personal address (/mcp/u/<username>) only serves that one member, so a shared Claude account cannot save under someone else's name
    if (req.params.username && String(req.params.username).toLowerCase() !== m.username) return res.status(403).json({ error: 'This connector is for ' + String(req.params.username).toLowerCase() + ' but it is signed in as ' + m.username + '. Remove the connector and add it again, signing in as ' + String(req.params.username).toLowerCase() + '.' });
    const body = req.body;
    if (Array.isArray(body)) { const out = (await Promise.all(body.map((x) => mcp.handle(ctx, m, x)))).filter(Boolean); return out.length ? res.json(out) : res.status(202).end(); }
    const out = await mcp.handle(ctx, m, body);
    return out ? res.json(out) : res.status(202).end();
  });

  app.use('/api', requireUser);

  app.get('/api/me', (req, res) => res.json({ user: req.user, types: TYPES }));

  // ---- members (admin page) ----
  // the team (for the basket tabs and the assignment dropdowns), with how many customers each basket holds
  app.get('/api/people', (req, res) => { const b = repo.baskets(); res.json({ people: repo.members().filter((m) => m.active).map((m) => ({ id: m.id, name: m.name, username: m.username, customers: b.per.get(m.id) || 0 })), unassigned: b.unassigned }); });
  app.get('/api/members', requireAdmin, (req, res) => res.json({ members: repo.members().map((m) => ({ ...m, hasKey: !!repo.keyInfo(m.id) })), activity: repo.activity(50) }));
  app.post('/api/members/:id/revoke-key', requireAdmin, (req, res) => answer(res, repo.revokeKey(req.params.id, req.user.id)));
  // each member makes their own key (shown once); the admin has no member record, so makes themselves a member to connect
  app.get('/api/my-connection', (req, res) => res.json({ canConnect: req.user.id !== 'admin', key: req.user.id === 'admin' ? null : repo.keyInfo(req.user.id) }));
  app.post('/api/my-connection/key', (req, res) => (req.user.id === 'admin' ? res.status(400).json({ error: 'The admin sign-in cannot connect. Create a member for yourself under Members.' }) : res.json(repo.createKey(req.user.id))));
  const answer = (res, r, body) => (r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(body || { ok: true }));
  app.post('/api/members', requireAdmin, (req, res) => { const r = repo.createMember(req.body || {}, req.user.id); answer(res, r, { member: r.member }); });
  app.post('/api/members/:id/password', requireAdmin, (req, res) => answer(res, repo.setPassword(req.params.id, (req.body || {}).password, req.user.id)));
  app.delete('/api/members/:id', requireAdmin, (req, res) => { const r = repo.deleteMember(req.params.id, (req.body || {}).confirm, req.user.id); answer(res, r, r); });
  app.patch('/api/members/:id', requireAdmin, (req, res) => answer(res, repo.setActive(req.params.id, !!(req.body || {}).active, req.user.id)));

  // ---- adding a file from the page: the original bytes go straight in. kind is customer, vendor or item; key is the mobile number or item id.
  // The custom header cannot be sent by another website, so only this page can use it. ----
  app.post('/api/upload', express.raw({ type: () => true, limit: '51mb' }), (req, res) => {
    if (req.headers['x-portal-upload'] !== '1') return res.status(400).json({ error: 'Not an upload from the portal page' });
    const q = req.query, buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0), kind = String(q.kind || '');
    if (kind === 'uploads') { const u = repo.addUploadFile({ name: q.name, folderId: q.key, buffer }, req.user); return u.error ? res.status(u.status || 400).json({ error: u.error }) : res.json({ ok: true, name: u.file.name }); }
    if (buffer.length > 10 * 1024 * 1024) return res.status(400).json({ error: 'The file is too big (10 MB at most)' });
    const r = kind === 'customer' ? repo.addFile({ mobile: q.key, name: q.name, note: q.note, buffer }, req.user.id) : repo.addAttachment({ kind, key: q.key, name: q.name, note: q.note, buffer }, req.user.id);
    return r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json({ ok: true, name: (r.file || r.attachment).name });
  });

  // ---- Uploads: shared folders and files for the whole team (everyone signed in, the admin too, can add, rename, remove and download) ----
  app.get('/api/uploads', (req, res) => res.json({ ...repo.uploadsTree(), maxMb: repo.UPLOAD_MAX / 1048576 }));
  app.post('/api/uploads/folders', (req, res) => { const r = repo.addUploadFolder((req.body || {}).name, (req.body || {}).parentId, req.user); answer(res, r, r); });
  app.patch('/api/uploads/folders/:id', (req, res) => answer(res, repo.renameUploadFolder(req.params.id, (req.body || {}).name, req.user)));
  app.delete('/api/uploads/folders/:id', (req, res) => answer(res, repo.deleteUploadFolder(req.params.id, req.user)));
  app.patch('/api/uploads/files/:id', (req, res) => answer(res, repo.renameUploadFile(req.params.id, (req.body || {}).name, req.user)));
  app.delete('/api/uploads/files/:id', (req, res) => answer(res, repo.deleteUploadFile(req.params.id, req.user)));
  const attach = (name) => 'attachment; filename="' + String(name).replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '') + '"; filename*=UTF-8\'\'' + encodeURIComponent(name);
  app.get('/api/uploads/files/:id/download', (req, res) => {
    const f = repo.uploadFile(req.params.id);
    if (!f || !require('fs').existsSync(f.path)) return res.status(404).json({ error: 'File not found' });
    res.set({ 'Content-Type': 'application/octet-stream', 'Content-Length': String(f.size), 'Cache-Control': 'private, no-store', 'Content-Disposition': attach(f.name) });
    require('fs').createReadStream(f.path).pipe(res);
  });
  app.get('/api/uploads/folders/:id/download', async (req, res) => {
    const z = repo.uploadZipEntries(req.params.id);
    if (!z) return res.status(404).json({ error: 'Folder not found' });
    z.entries = z.entries.filter((e) => e.dir || require('fs').existsSync(e.file));
    res.set({ 'Content-Type': 'application/zip', 'Cache-Control': 'private, no-store', 'Content-Disposition': attach(z.name + '.zip') });
    try { await writeZip(res, z.entries); } catch (e) { res.destroy(); }
  });

  // ---- customers (view only) ----
  app.get('/api/customers', (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    let rows = repo.customers({ q: req.query.q, owner: String(req.query.owner || ''), buyer: String(req.query.buyer || ''), business: String(req.query.business || ''), state: String(req.query.state || '') })
      .map((c) => ({ ...c, attention: books.attention(repo, c, today) }));
    if (req.query.attention === '1') rows = rows.filter((c) => c.attention.some((a) => a.tone !== 'info'));
    res.json({ customers: rows, options: { buyer_types: repo.BUYER_TYPES, businesses: repo.BUSINESSES, states: repo.states() } });
  });
  app.get('/api/customers/:mobile', (req, res) => {
    const c = repo.customer(req.params.mobile);
    return c ? res.json({ customer: c }) : res.status(404).json({ error: 'Customer not found' });
  });
  app.delete('/api/customers/:mobile/contacts/:contact', requireAdmin, (req, res) => { const r = repo.removeContact(req.params.mobile, req.params.contact, req.user.id); answer(res, r, r); });
  // who looks after this customer: admin only. owner is a member id, or empty for nobody. (Who created the customer never changes.)
  app.patch('/api/customers/:mobile/assign', requireAdmin, (req, res) => {
    if (!repo.customer(req.params.mobile)) return res.status(404).json({ error: 'Customer not found' });
    const r = repo.assignCustomer(req.params.mobile, (req.body || {}).owner || null, req.user.id); answer(res, r, r);
  });
  // admin only, and the admin has to send the customer's mobile number back as a confirmation
  app.delete('/api/customers/:mobile', requireAdmin, (req, res) => {
    const c = repo.customer(req.params.mobile);
    if (!c) return res.status(404).json({ error: 'Customer not found' });
    if (String((req.body || {}).confirm || '') !== c.mobile) return res.status(400).json({ error: 'Type the customer\'s mobile number to confirm' });
    const r = repo.deleteCustomer(c.mobile, req.user.id); answer(res, r, r);
  });
  // what Claude saved from Zoho Books for this customer (purchases, orders, quotes) and what to do next
  app.get('/api/customers/:mobile/books', (req, res) => {
    if (!repo.customer(req.params.mobile)) return res.status(404).json({ error: 'Customer not found' });
    res.json(books.forCustomer(repo, req.params.mobile, new Date().toISOString().slice(0, 10)));
  });

  // ---- vendors ----
  app.get('/api/vendors', (req, res) => res.json({ vendors: repo.vendors({ q: req.query.q }) }));
  // admin only, with the vendor's mobile number typed back as confirmation
  app.delete('/api/vendors/:mobile', requireAdmin, (req, res) => {
    const v = repo.vendor(req.params.mobile);
    if (!v) return res.status(404).json({ error: 'Vendor not found' });
    if (String((req.body || {}).confirm || '') !== v.mobile) return res.status(400).json({ error: 'Type the vendor\'s mobile number to confirm' });
    const r = repo.deleteVendor(v.mobile, req.user.id); answer(res, r, r);
  });
  // suppliers page: updates across all vendors and items, newest first, and the items grouped by collection
  app.get('/api/sourcing/log', (req, res) => res.json({ log: repo.events({ limit: Math.min(Number(req.query.limit) || 40, 100) }) }));
  app.get('/api/collections', (req, res) => res.json({ collections: repo.collections(), status: itemSync.status() }));
  // files attached to a vendor or an item: pictures show in the page, anything else is only ever a download
  app.get('/api/attachments/:id', (req, res) => {
    const a = repo.attachment(req.params.id), p = repo.filePath(req.params.id);
    if (!a || !p || !require('fs').existsSync(p)) return res.status(404).json({ error: 'File not found' });
    const inline = /^image\/(png|jpeg|webp|gif)$/.test(a.mime) && req.query.download !== '1';
    res.set({ 'Content-Type': inline ? a.mime : 'application/octet-stream', 'Cache-Control': 'private, no-store', 'Content-Disposition': (inline ? 'inline' : 'attachment') + '; filename="' + a.name.replace(/[^\x20-\x7e]/g, '_') + '"' });
    require('fs').createReadStream(p).pipe(res);
  });
  app.delete('/api/attachments/:id', requireAdmin, (req, res) => { const r = repo.deleteAttachment(req.params.id, req.user.id); answer(res, r, r); });
  app.delete('/api/notes/:id', requireAdmin, (req, res) => { const r = repo.deleteNote(req.params.id, req.user.id); answer(res, r, r); });
  app.get('/api/vendors/:mobile', (req, res) => {
    const v = repo.vendor(req.params.mobile);
    return v ? res.json({ vendor: v }) : res.status(404).json({ error: 'Vendor not found' });
  });

  // ---- items (from Zoho Commerce) ----
  app.get('/api/items', (req, res) => res.json({ items: repo.items({ q: req.query.q, category: String(req.query.category || ''), inStock: req.query.stock === '1' }), categories: repo.itemCategories(), status: itemSync.status() }));
  app.get('/api/items/:id', (req, res) => {
    const i = repo.item(req.params.id);
    return i ? res.json({ item: i }) : res.status(404).json({ error: 'Item not found' });
  });
  app.post('/api/items/sync', async (req, res) => { const r = await itemSync.syncNow(); res.json({ result: r, status: itemSync.status() }); });

  // pictures show in the page; anything else is only ever sent as a download
  const INLINE = /^image\/(png|jpeg|webp|gif)$/;
  app.get('/api/files/:id', (req, res) => {
    const f = repo.file(req.params.id), p = repo.filePath(req.params.id);
    if (!f || !p || !require('fs').existsSync(p)) return res.status(404).json({ error: 'File not found' });
    const inline = INLINE.test(f.mime) && req.query.download !== '1';
    res.set({ 'Content-Type': inline ? f.mime : 'application/octet-stream', 'Cache-Control': 'private, no-store',
      'Content-Disposition': (inline ? 'inline' : 'attachment') + '; filename="' + f.name.replace(/[^\x20-\x7e]/g, '_') + '"' });
    require('fs').createReadStream(p).pipe(res);
  });

  app.use((req, res) => (req.originalUrl.startsWith('/api/') ? res.status(404).json({ error: 'Not found' }) : res.status(404).type('text').send('Not found')));
  app.repo = repo; app.itemSync = itemSync;
  app.on('close', () => itemSync.stop());
  return app;
}

module.exports = { createApp };
