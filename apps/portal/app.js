// The portal: sign in, then view customers and what has happened with each. Only the admin can create members.
'use strict';
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const compression = require('compression');
const { open, TYPES } = require('./lib/db');
const mcp = require('./lib/mcp');
const oauth = require('./lib/oauth');

const safeEqual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function createApp({ dataDir, adminPassword, sessionSecret }) {
  if (!adminPassword) throw new Error('ADMIN_PASSWORD is not set. Refusing to start without a login password.');
  const secret = sessionSecret || crypto.randomBytes(32).toString('hex');
  const repo = open(dataDir);

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
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && !/^application\/json/i.test(req.headers['content-type'] || '')) return res.status(415).json({ error: 'JSON only' });
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
  app.get('/health', (req, res) => res.json({ status: 'ok' }));

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
  app.all('/mcp', (req, res) => {
    if (req.method !== 'POST') return res.status(405).set('Allow', 'POST').json({ error: 'Use POST' });
    const t = Date.now(), recent = (tries.get('mcp' + req.ip) || []).filter((x) => x > t - 10 * 60 * 1000);
    if (recent.length >= 30) return res.status(429).json({ error: 'Too many wrong keys. Please wait a few minutes.' });
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const m = repo.memberByKey(bearer) || repo.memberByAccessToken(bearer);
    if (!m) { recent.push(t); tries.set('mcp' + req.ip, recent); return res.status(401).set('WWW-Authenticate', 'Bearer resource_metadata="' + req.protocol + '://' + req.get('host') + '/.well-known/oauth-protected-resource"').json({ error: 'Missing or wrong key. Make a new one under My connection in the portal.' }); }
    tries.delete('mcp' + req.ip);
    const body = req.body;
    if (Array.isArray(body)) { const out = body.map((x) => mcp.handle(repo, m, x)).filter(Boolean); return out.length ? res.json(out) : res.status(202).end(); }
    const out = mcp.handle(repo, m, body);
    return out ? res.json(out) : res.status(202).end();
  });

  app.use('/api', requireUser);

  app.get('/api/me', (req, res) => res.json({ user: req.user, types: TYPES }));

  // ---- members (admin page) ----
  app.get('/api/people', (req, res) => res.json({ people: repo.members().filter((m) => m.active).map((m) => ({ id: m.id, name: m.name })) }));
  app.get('/api/members', requireAdmin, (req, res) => res.json({ members: repo.members().map((m) => ({ ...m, hasKey: !!repo.keyInfo(m.id) })), activity: repo.activity(50) }));
  app.post('/api/members/:id/revoke-key', requireAdmin, (req, res) => answer(res, repo.revokeKey(req.params.id, req.user.id)));
  // each member makes their own key (shown once); the admin has no member record, so makes themselves a member to connect
  app.get('/api/my-connection', (req, res) => res.json({ canConnect: req.user.id !== 'admin', key: req.user.id === 'admin' ? null : repo.keyInfo(req.user.id) }));
  app.post('/api/my-connection/key', (req, res) => (req.user.id === 'admin' ? res.status(400).json({ error: 'The admin sign-in cannot connect. Create a member for yourself under Members.' }) : res.json(repo.createKey(req.user.id))));
  const answer = (res, r, body) => (r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(body || { ok: true }));
  app.post('/api/members', requireAdmin, (req, res) => { const r = repo.createMember(req.body || {}, req.user.id); answer(res, r, { member: r.member }); });
  app.post('/api/members/:id/password', requireAdmin, (req, res) => answer(res, repo.setPassword(req.params.id, (req.body || {}).password, req.user.id)));
  app.patch('/api/members/:id', requireAdmin, (req, res) => answer(res, repo.setActive(req.params.id, !!(req.body || {}).active, req.user.id)));

  // ---- customers (view only) ----
  app.get('/api/customers', (req, res) => res.json({ customers: repo.customers({ q: req.query.q, owner: String(req.query.owner || '') }) }));
  app.get('/api/customers/:id', (req, res) => {
    const c = repo.customer(req.params.id);
    return c ? res.json({ customer: c }) : res.status(404).json({ error: 'Customer not found' });
  });
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
  app.repo = repo;
  return app;
}

module.exports = { createApp };
