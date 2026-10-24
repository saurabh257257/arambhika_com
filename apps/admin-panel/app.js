// Arambhika Admin Panel: daily routine tracking, tasks and sub-tasks, and office transactions for approval.
// Two kinds of people: the admin (sign-in with ADMIN_PASSWORD) and employees (created by the admin).
// Everything, pages included, is behind the sign-in. Data lives in JSON files (see lib/store.js).
'use strict';
const express = require('express');
const compression = require('compression');
const crypto = require('crypto');
const path = require('path');
const { Store } = require('./lib/store');

const DEFAULT_ROUTINE = [
  { id: 'calls', name: 'Call people', unit: 'calls', target: 10, type: 'calls' },
  { id: 'instagram', name: 'Post Instagram ads', unit: 'posts', target: 1, type: 'count' },
  { id: 'website', name: 'Post on the website', unit: 'posts', target: 1, type: 'count' },
  { id: 'invoices', name: 'Maintain invoices', unit: 'invoices', target: 1, type: 'count' },
];
const TX_TYPES = ['expense', 'income', 'purchase', 'other'];
const PRIORITIES = ['low', 'normal', 'high'];
const STATUSES = ['todo', 'doing', 'done'];
const EDIT_WINDOW_DAYS = 30;

const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const str = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const text = (v, max) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max);
const uid = () => crypto.randomUUID();

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function checkPassword(pw, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex');
  const b = crypto.scryptSync(String(pw), salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function createApp({ dataDir, adminPassword, sessionSecret }) {
  if (!adminPassword) throw new Error('ADMIN_PASSWORD is not set. Refusing to start without a login password.');
  const secret = sessionSecret || crypto.randomBytes(32).toString('hex');
  const store = new Store(dataDir);
  const users = () => store.list('users');
  const routine = () => store.list('routine', DEFAULT_ROUTINE);
  const entries = () => store.list('entries');
  const calls = () => store.list('calls');
  const tasks = () => store.list('tasks');
  const txs = () => store.list('transactions');

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(compression());
  app.use(express.json({ limit: '200kb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

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
    const u = users().find((x) => x.id === data.id && x.active);
    return u ? { id: u.id, name: u.name, username: u.username, role: 'employee' } : null;
  }
  const requireUser = (req, res, next) => {
    const u = sessionUser(req);
    if (u) { req.user = u; return next(); }
    if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Please sign in' });
    return res.redirect('/login.html');
  };
  const requireAdmin = (req, res, next) => (req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admin only' }));
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
    else { const u = users().find((x) => x.username === username && x.active); if (u && checkPassword(password, u.passHash)) id = u.id; }
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
  app.get('/panel.js', requireUser, send('panel.js'));
  app.use('/api', requireUser);

  app.get('/api/me', (req, res) => res.json({ user: req.user, today: todayIST(), editWindowDays: EDIT_WINDOW_DAYS }));

  // ---- helpers ----
  const employees = () => users().filter((u) => u.active);
  const pubUser = (u) => ({ id: u.id, name: u.name, username: u.username, active: u.active, createdAt: u.createdAt });
  const targetUser = (req) => {
    const wanted = req.query.userId || (req.body && req.body.userId);
    if (req.user.role !== 'admin') return req.user.id;
    return wanted && wanted !== 'admin' ? String(wanted) : null;
  };
  const canEditDate = (req, date) => {
    if (!isDate(date)) return 'Date must look like 2026-10-24';
    const t = todayIST();
    if (date > t) return 'You cannot record a future date';
    if (date < addDays(t, -EDIT_WINDOW_DAYS)) return 'That day is too old to change';
    return '';
  };

  // ---- routine (the list of daily jobs and targets) ----
  app.get('/api/routine', (req, res) => res.json({ items: routine() }));
  app.put('/api/routine', requireAdmin, (req, res) => {
    const incoming = Array.isArray(req.body && req.body.items) ? req.body.items.slice(0, 20) : null;
    if (!incoming || !incoming.length) return res.status(400).json({ error: 'The routine needs at least one job' });
    const old = new Map(routine().map((i) => [i.id, i]));
    const next = [];
    for (const it of incoming) {
      const name = str(it.name, 60);
      const target = Math.round(Number(it.target));
      if (!name) return res.status(400).json({ error: 'Every job needs a name' });
      if (!Number.isFinite(target) || target < 0 || target > 10000) return res.status(400).json({ error: 'Target must be a number from 0 to 10000' });
      const prev = old.get(it.id);
      next.push({ id: prev ? prev.id : 'job-' + uid().slice(0, 8), name, unit: str(it.unit, 20) || 'done', target, type: prev ? prev.type : 'count' });
    }
    if (!next.some((i) => i.type === 'calls') && old.has('calls')) next.unshift(old.get('calls')); // the calls job cannot be removed
    const list = routine(); list.length = 0; list.push(...next); store.save('routine');
    res.json({ items: list });
  });

  // ---- daily record ----
  function dayRecord(userId, date) {
    const dayCalls = calls().filter((c) => c.userId === userId && c.date === date);
    const items = routine().map((it) => {
      const e = entries().find((x) => x.userId === userId && x.date === date && x.itemId === it.id);
      const count = it.type === 'calls' ? dayCalls.length : (e ? e.count : 0);
      return { id: it.id, name: it.name, unit: it.unit, target: it.target, type: it.type, count, notes: e ? e.notes : '', done: count >= it.target && it.target > 0 };
    });
    return { date, userId, items, calls: dayCalls.sort((a, b) => a.createdAt.localeCompare(b.createdAt)) };
  }
  app.get('/api/daily', (req, res) => {
    const userId = targetUser(req);
    if (!userId) return res.status(400).json({ error: 'Choose an employee' });
    const date = req.query.date || todayIST();
    if (!isDate(date)) return res.status(400).json({ error: 'Bad date' });
    res.json(dayRecord(userId, date));
  });
  app.put('/api/daily', (req, res) => {
    if (req.user.role !== 'employee') return res.status(403).json({ error: 'Employees record their own work' });
    const { date, itemId } = req.body || {};
    const problem = canEditDate(req, date); if (problem) return res.status(400).json({ error: problem });
    const item = routine().find((i) => i.id === itemId);
    if (!item || item.type === 'calls') return res.status(400).json({ error: 'Unknown job' });
    const count = Math.round(Number(req.body.count));
    if (!Number.isFinite(count) || count < 0 || count > 100000) return res.status(400).json({ error: 'Count must be a number' });
    let e = entries().find((x) => x.userId === req.user.id && x.date === date && x.itemId === itemId);
    if (!e) { e = { id: uid(), userId: req.user.id, date, itemId }; entries().push(e); }
    e.count = count; e.notes = text(req.body.notes, 2000); e.updatedAt = new Date().toISOString();
    store.save('entries');
    res.json(dayRecord(req.user.id, date));
  });
  app.post('/api/calls', (req, res) => {
    if (req.user.role !== 'employee') return res.status(403).json({ error: 'Employees record their own calls' });
    const { date } = req.body || {};
    const problem = canEditDate(req, date); if (problem) return res.status(400).json({ error: problem });
    const person = str(req.body.person, 80);
    if (!person) return res.status(400).json({ error: 'Who did you call?' });
    const phone = str(req.body.phone, 20);
    if (phone && !/^[0-9+\-() ]{5,20}$/.test(phone)) return res.status(400).json({ error: 'That phone number does not look right' });
    calls().push({ id: uid(), userId: req.user.id, date, person, phone, outcome: str(req.body.outcome, 30) || 'Spoke', note: text(req.body.note, 1000), createdAt: new Date().toISOString() });
    store.save('calls');
    res.json(dayRecord(req.user.id, date));
  });
  app.delete('/api/calls/:id', (req, res) => {
    const list = calls(); const at = list.findIndex((c) => c.id === req.params.id && c.userId === req.user.id);
    if (at < 0) return res.status(404).json({ error: 'Not found' });
    const date = list[at].date;
    const problem = canEditDate(req, date); if (problem) return res.status(400).json({ error: problem });
    list.splice(at, 1); store.save('calls');
    res.json(dayRecord(req.user.id, date));
  });

  // previous days, newest first: each job's count against its target
  app.get('/api/history', (req, res) => {
    const userId = targetUser(req);
    if (!userId) return res.status(400).json({ error: 'Choose an employee' });
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 120);
    const t = todayIST();
    const out = [];
    for (let i = 0; i < days; i += 1) {
      const date = addDays(t, -i);
      const rec = dayRecord(userId, date);
      const any = rec.items.some((x) => x.count > 0 || x.notes);
      out.push({ date, active: any, items: rec.items.map((x) => ({ id: x.id, name: x.name, count: x.count, target: x.target, done: x.done })), allDone: rec.items.every((x) => x.target === 0 || x.done) });
    }
    res.json({ days: out });
  });

  // ---- tasks and sub-tasks ----
  const taskView = (t) => ({ ...t });
  const visibleTasks = (user) => {
    const all = tasks();
    if (user.role === 'admin') return all;
    return all.filter((t) => t.assigneeId === user.id);
  };
  app.get('/api/tasks', (req, res) => res.json({ tasks: visibleTasks(req.user).map(taskView) }));
  app.post('/api/tasks', requireAdmin, (req, res) => {
    const title = str(req.body.title, 120);
    if (!title) return res.status(400).json({ error: 'The task needs a title' });
    let parent = null;
    if (req.body.parentId) { parent = tasks().find((t) => t.id === req.body.parentId); if (!parent || parent.parentId) return res.status(400).json({ error: 'Sub-tasks go under a main task' }); }
    const assigneeId = req.body.assigneeId || (parent && parent.assigneeId) || '';
    if (!employees().some((u) => u.id === assigneeId)) return res.status(400).json({ error: 'Choose an employee to assign it to' });
    const due = req.body.due ? String(req.body.due) : '';
    if (due && !isDate(due)) return res.status(400).json({ error: 'Bad due date' });
    const priority = PRIORITIES.includes(req.body.priority) ? req.body.priority : 'normal';
    const t = { id: uid(), title, description: text(req.body.description, 2000), assigneeId, due, priority, status: 'todo', parentId: parent ? parent.id : '', note: '', createdAt: new Date().toISOString(), doneAt: '' };
    tasks().push(t); store.save('tasks');
    res.json({ task: taskView(t) });
  });
  app.patch('/api/tasks/:id', (req, res) => {
    const t = tasks().find((x) => x.id === req.params.id);
    if (!t || (req.user.role !== 'admin' && t.assigneeId !== req.user.id)) return res.status(404).json({ error: 'Task not found' });
    const b = req.body || {};
    if (b.status !== undefined) {
      if (!STATUSES.includes(b.status)) return res.status(400).json({ error: 'Bad status' });
      t.status = b.status; t.doneAt = b.status === 'done' ? new Date().toISOString() : '';
    }
    if (b.note !== undefined) t.note = text(b.note, 1000);
    if (req.user.role === 'admin') {
      if (b.title !== undefined) { const v = str(b.title, 120); if (!v) return res.status(400).json({ error: 'The task needs a title' }); t.title = v; }
      if (b.description !== undefined) t.description = text(b.description, 2000);
      if (b.priority !== undefined && PRIORITIES.includes(b.priority)) t.priority = b.priority;
      if (b.due !== undefined) { if (b.due && !isDate(b.due)) return res.status(400).json({ error: 'Bad due date' }); t.due = b.due ? String(b.due) : ''; }
      if (b.assigneeId !== undefined) {
        if (!employees().some((u) => u.id === b.assigneeId)) return res.status(400).json({ error: 'Choose an employee' });
        t.assigneeId = b.assigneeId;
        if (!t.parentId) tasks().filter((s) => s.parentId === t.id).forEach((s) => { s.assigneeId = b.assigneeId; });
      }
    }
    store.save('tasks');
    res.json({ task: taskView(t) });
  });
  app.delete('/api/tasks/:id', requireAdmin, (req, res) => {
    const list = tasks(); const at = list.findIndex((x) => x.id === req.params.id);
    if (at < 0) return res.status(404).json({ error: 'Task not found' });
    const id = list[at].id;
    for (let i = list.length - 1; i >= 0; i -= 1) if (list[i].id === id || list[i].parentId === id) list.splice(i, 1);
    store.save('tasks');
    res.json({ ok: true });
  });

  // ---- office: transactions sent for approval ----
  app.get('/api/transactions', (req, res) => {
    let list = txs();
    if (req.user.role !== 'admin') list = list.filter((t) => t.userId === req.user.id);
    else if (req.query.userId) list = list.filter((t) => t.userId === req.query.userId);
    if (['pending', 'approved', 'rejected'].includes(req.query.status)) list = list.filter((t) => t.status === req.query.status);
    const names = new Map(users().map((u) => [u.id, u.name]));
    res.json({ transactions: [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 500).map((t) => ({ ...t, userName: names.get(t.userId) || '' })) });
  });
  function readTx(req) {
    const date = req.body.date || todayIST();
    if (!isDate(date)) return { error: 'Bad date' };
    if (date > todayIST()) return { error: 'The date cannot be in the future' };
    const amount = Math.round(Number(req.body.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) return { error: 'Enter the amount (more than 0)' };
    const type = TX_TYPES.includes(req.body.type) ? req.body.type : 'expense';
    const party = str(req.body.party, 100);
    if (!party) return { error: 'Who was it paid to, or received from?' };
    return { value: { date, amount, type, party, description: text(req.body.description, 1000) } };
  }
  app.post('/api/transactions', (req, res) => {
    if (req.user.role !== 'employee') return res.status(403).json({ error: 'Employees add transactions' });
    const r = readTx(req); if (r.error) return res.status(400).json({ error: r.error });
    const t = { id: uid(), userId: req.user.id, ...r.value, status: 'pending', remark: '', decidedAt: '', createdAt: new Date().toISOString() };
    txs().push(t); store.save('transactions');
    res.json({ transaction: t });
  });
  app.put('/api/transactions/:id', (req, res) => {
    const t = txs().find((x) => x.id === req.params.id && x.userId === req.user.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    if (t.status !== 'pending') return res.status(400).json({ error: 'Only a transaction waiting for approval can be changed' });
    const r = readTx(req); if (r.error) return res.status(400).json({ error: r.error });
    Object.assign(t, r.value); store.save('transactions');
    res.json({ transaction: t });
  });
  app.delete('/api/transactions/:id', (req, res) => {
    const list = txs(); const at = list.findIndex((x) => x.id === req.params.id && x.userId === req.user.id);
    if (at < 0) return res.status(404).json({ error: 'Not found' });
    if (list[at].status !== 'pending') return res.status(400).json({ error: 'Only a transaction waiting for approval can be removed' });
    list.splice(at, 1); store.save('transactions');
    res.json({ ok: true });
  });
  app.post('/api/transactions/:id/decision', requireAdmin, (req, res) => {
    const t = txs().find((x) => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    const status = req.body && req.body.status;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Approve or reject' });
    t.status = status; t.remark = text(req.body.remark, 500); t.decidedAt = new Date().toISOString();
    store.save('transactions');
    res.json({ transaction: t });
  });

  // ---- team (admin) ----
  app.get('/api/users', requireAdmin, (req, res) => res.json({ users: users().map(pubUser) }));
  app.post('/api/users', requireAdmin, (req, res) => {
    const name = str(req.body.name, 60);
    const username = str(req.body.username, 40).toLowerCase();
    const password = String(req.body.password || '');
    if (!name) return res.status(400).json({ error: 'Enter the name' });
    if (!/^[a-z0-9._-]{3,30}$/.test(username) || username === 'admin') return res.status(400).json({ error: 'Username: 3 to 30 letters or numbers (not "admin")' });
    if (password.length < 8) return res.status(400).json({ error: 'The password needs at least 8 characters' });
    if (users().some((u) => u.username === username)) return res.status(400).json({ error: 'That username is taken' });
    const u = { id: uid(), name, username, passHash: hashPassword(password), active: true, createdAt: new Date().toISOString() };
    users().push(u); store.save('users');
    res.json({ user: pubUser(u) });
  });
  app.patch('/api/users/:id', requireAdmin, (req, res) => {
    const u = users().find((x) => x.id === req.params.id);
    if (!u) return res.status(404).json({ error: 'Not found' });
    if (req.body.name !== undefined) { const n = str(req.body.name, 60); if (!n) return res.status(400).json({ error: 'Enter the name' }); u.name = n; }
    if (req.body.password !== undefined) { if (String(req.body.password).length < 8) return res.status(400).json({ error: 'The password needs at least 8 characters' }); u.passHash = hashPassword(String(req.body.password)); }
    if (req.body.active !== undefined) u.active = Boolean(req.body.active);
    store.save('users');
    res.json({ user: pubUser(u) });
  });

  // ---- admin overview ----
  app.get('/api/overview', requireAdmin, (req, res) => {
    const date = req.query.date && isDate(req.query.date) ? req.query.date : todayIST();
    const t = todayIST();
    const rows = employees().map((u) => {
      const rec = dayRecord(u.id, date);
      const mine = tasks().filter((x) => x.assigneeId === u.id && x.status !== 'done');
      return {
        user: pubUser(u), items: rec.items.map((i) => ({ id: i.id, name: i.name, count: i.count, target: i.target, done: i.done })),
        openTasks: mine.length, overdueTasks: mine.filter((x) => x.due && x.due < t).length,
        pendingTransactions: txs().filter((x) => x.userId === u.id && x.status === 'pending').length,
      };
    });
    res.json({ date, employees: rows, pendingApprovals: txs().filter((x) => x.status === 'pending').length });
  });

  app.use((req, res) => (req.originalUrl.startsWith('/api/') ? res.status(404).json({ error: 'Not found' }) : res.status(404).type('text').send('Not found')));
  return app;
}

module.exports = { createApp, todayIST };
