// Arambhika Admin Panel: the owner designs the work, the team does it, everyone can see where things stand.
//
// How it is organised (so features are easy to add or change):
//   app.js             sign-in, sessions, the shared "ctx", and loading of the modules below
//   modules/*.js       one file per feature (team, tasks, requests, customers, invoices, office, dashboard).
//                      A module is a function (app, ctx) that adds its own /api routes.
//   lib/zoho.js        read-only pulls from Zoho Books, cached for a few minutes
//   lib/followups.js   the follow-up rules (what happened -> when to follow up next)
//   public/js/*.js     one screen file per feature, registered with Panel.register() in core.js
// Everything, pages included, is behind the sign-in. Data lives in JSON files (see lib/store.js).
'use strict';
const express = require('express');
const compression = require('compression');
const crypto = require('crypto');
const path = require('path');
const { Store } = require('./lib/store');
const { createZoho } = require('./lib/zoho');
const { mergeCadence } = require('./lib/followups');
const { todayIST, str, uid, nowISO, safeEqual, checkPassword, clock } = require('./lib/util');

const MODULES = ['team', 'tasks', 'requests', 'customers', 'invoices', 'office', 'dashboard'];

function createApp({ dataDir, adminPassword, sessionSecret, zoho }) {
  if (!adminPassword) throw new Error('ADMIN_PASSWORD is not set. Refusing to start without a login password.');
  const secret = sessionSecret || crypto.randomBytes(32).toString('hex');
  const store = new Store(dataDir);
  const zohoClient = zoho || createZoho();

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(compression());
  // a photo arrives inside JSON, so the screenshot route may be big; everything else stays small
  const smallJson = express.json({ limit: '200kb' }); const bigJson = express.json({ limit: '7mb' });
  app.use((req, res, next) => (/\/screenshot$/.test(req.path) ? bigJson : smallJson)(req, res, next));
  app.use((req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

  // ---- what every module can use ----
  const ctx = {
    store, zoho: zohoClient, todayIST,
    col: (name, defaults = []) => store.list(name, defaults),
    save: (name) => store.save(name),
    users: () => store.list('users'),
    employees: () => store.list('users').filter((u) => u.active),
    userName: (id) => (id === 'admin' ? 'Admin' : ((store.list('users').find((u) => u.id === id) || {}).name || '')),
    settings() {
      const list = store.list('settings', [{}]);
      return list[0];
    },
    saveSettings: () => store.save('settings'),
    cadence() { return mergeCadence(ctx.settings().cadence); },
    // one line in the activity feed: who did what, and when
    log(user, textLine) {
      const list = store.list('activity');
      list.push({ id: uid(), at: nowISO(), userId: user.id, userName: user.name, text: str(textLine, 200) });
      if (list.length > 3000) list.splice(0, list.length - 3000);
      store.save('activity');
    },
  };

  // ---- sessions: a signed cookie holding who you are and when it expires ----
  const COOKIE = 'ap_session';
  const SESSION_HOURS = 12;
  const sign = (p) => crypto.createHmac('sha256', secret).update(p).digest('base64url');
  const issue = (id) => { const p = Buffer.from(JSON.stringify({ id, exp: Date.now() + SESSION_HOURS * 3600 * 1000 })).toString('base64url'); return p + '.' + sign(p); };
  function sessionUser(req) {
    const raw = (req.headers.cookie || '').split(';').map((x) => x.trim()).find((x) => x.startsWith(COOKIE + '='));
    if (!raw) return null;
    const [p, mac] = decodeURIComponent(raw.slice(COOKIE.length + 1)).split('.');
    if (!p || !mac || !safeEqual(mac, sign(p))) return null;
    let data; try { data = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')); } catch (e) { return null; }
    if (!data || !(data.exp > Date.now())) return null;
    if (data.id === 'admin') return { id: 'admin', name: 'Admin', username: 'admin', role: 'admin' };
    const u = ctx.users().find((x) => x.id === data.id && x.active);
    return u ? { id: u.id, name: u.name, username: u.username, role: 'employee' } : null;
  }
  const requireUser = (req, res, next) => {
    const u = sessionUser(req);
    if (u) { req.user = u; return next(); }
    if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Please sign in' });
    return res.redirect('/login.html');
  };
  ctx.requireAdmin = (req, res, next) => (req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admin only' }));
  // a state-changing call must come as JSON from this site: a form on another website cannot send that
  app.use('/api', (req, res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && !/^application\/json/i.test(req.headers['content-type'] || '') && req.path !== '/auth/logout') {
      return res.status(415).json({ error: 'JSON only' });
    }
    next();
  });

  const tries = new Map();
  app.post('/api/auth/login', (req, res) => {
    const now = Date.now();
    const key = req.ip;
    const recent = (tries.get(key) || []).filter((t) => t > now - 10 * 60 * 1000);
    if (recent.length >= 10) return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes.' });
    const username = str(req.body && req.body.username, 40).toLowerCase();
    const password = String((req.body && req.body.password) || '');
    let id = null;
    if (username === 'admin') { if (safeEqual(password, adminPassword)) id = 'admin'; }
    else { const u = ctx.users().find((x) => x.username === username && x.active); if (u && checkPassword(password, u.passHash)) id = u.id; }
    if (!id) { recent.push(now); tries.set(key, recent); return res.status(401).json({ error: 'Wrong username or password' }); }
    tries.delete(key);
    res.cookie(COOKIE, issue(id), { httpOnly: true, sameSite: 'lax', secure: req.secure || req.headers['x-forwarded-proto'] === 'https', maxAge: SESSION_HOURS * 3600 * 1000, path: '/' });
    res.json({ ok: true });
  });
  app.post('/api/auth/logout', (req, res) => { res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true }); });
  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // ---- pages and static files: only the sign-in page is open ----
  const pub = path.join(__dirname, 'public');
  const send = (file) => (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(pub, file)); };
  app.get('/login.html', (req, res, next) => (sessionUser(req) ? res.redirect('/') : send('login.html')(req, res, next)));
  app.get('/login.js', send('login.js'));
  app.get('/style.css', send('style.css'));
  app.get('/', requireUser, send('index.html'));
  app.get('/index.html', requireUser, (req, res) => res.redirect('/'));
  app.use('/js', requireUser, express.static(path.join(pub, 'js'), { index: false, dotfiles: 'deny', setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));
  app.use('/api', requireUser);

  app.get('/api/me', (req, res) => res.json({ user: req.user, today: todayIST() }));

  for (const name of MODULES) require('./modules/' + name)(app, ctx);

  app.use((req, res) => (req.originalUrl.startsWith('/api/') ? res.status(404).json({ error: 'Not found' }) : res.status(404).type('text').send('Not found')));
  return app;
}

module.exports = { createApp, todayIST, clock };
