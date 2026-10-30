// Team members (the owner creates them and sets their passwords), the follow-up rules, and the activity feed.
'use strict';
const fs = require('fs');
const path = require('path');
const files = require('../lib/files');
const { str, uid, hashPassword, nowISO } = require('../lib/util');
const { KINDS, mergeCadence } = require('../lib/followups');

module.exports = function team(app, ctx) {
  const pub = (u) => ({ id: u.id, name: u.name, username: u.username, active: u.active, createdAt: u.createdAt, newCustomerTarget: Number.isFinite(u.newCustomerTarget) ? u.newCustomerTarget : null });

  app.get('/api/users', (req, res) => {
    // everyone may see the names (to know who is on the team); only the admin sees account details
    if (req.user.role === 'admin') return res.json({ users: ctx.users().map(pub) });
    res.json({ users: ctx.employees().map((u) => ({ id: u.id, name: u.name })) });
  });

  app.post('/api/users', ctx.requireAdmin, (req, res) => {
    const name = str(req.body.name, 60);
    const username = str(req.body.username, 40).toLowerCase();
    const password = String(req.body.password || '');
    if (!name) return res.status(400).json({ error: 'Enter the name' });
    if (!/^[a-z0-9._-]{3,30}$/.test(username) || username === 'admin') return res.status(400).json({ error: 'Username: 3 to 30 letters or numbers (not "admin")' });
    if (password.length < 8) return res.status(400).json({ error: 'The password needs at least 8 characters' });
    if (ctx.users().some((u) => u.username === username)) return res.status(400).json({ error: 'That username is taken' });
    const u = { id: uid(), name, username, passHash: hashPassword(password), active: true, createdAt: nowISO() };
    ctx.users().push(u); ctx.save('users');
    ctx.log(req.user, 'Added team member ' + name);
    res.json({ user: pub(u) });
  });

  app.patch('/api/users/:id', ctx.requireAdmin, (req, res) => {
    const u = ctx.users().find((x) => x.id === req.params.id);
    if (!u) return res.status(404).json({ error: 'Not found' });
    if (req.body.name !== undefined) { const n = str(req.body.name, 60); if (!n) return res.status(400).json({ error: 'Enter the name' }); u.name = n; }
    if (req.body.password !== undefined) {
      if (String(req.body.password).length < 8) return res.status(400).json({ error: 'The password needs at least 8 characters' });
      u.passHash = hashPassword(String(req.body.password));
      ctx.log(req.user, 'Changed the password of ' + u.name);
    }
    if (req.body.active !== undefined) { u.active = Boolean(req.body.active); ctx.log(req.user, (u.active ? 'Switched on ' : 'Switched off ') + u.name); }
    if (req.body.newCustomerTarget !== undefined) {
      const n = req.body.newCustomerTarget === '' || req.body.newCustomerTarget === null ? null : Math.round(Number(req.body.newCustomerTarget));
      if (n !== null && !(n >= 0 && n <= 1000)) return res.status(400).json({ error: 'The target is a number of customers per month' });
      if (n === null) delete u.newCustomerTarget; else u.newCustomerTarget = n;
    }
    ctx.save('users');
    res.json({ user: pub(u) });
  });

  // ---- follow-up rules: what happened -> days until the next follow-up ----
  const workDays = () => (Array.isArray(ctx.settings().workDays) && ctx.settings().workDays.length ? ctx.settings().workDays : [1, 2, 3, 4, 5, 6]);
  app.get('/api/settings', (req, res) => res.json({ cadence: ctx.cadence(), invoiceLeadDays: ctx.settings().invoiceLeadDays || 3, workDays: workDays(), custFollow: ctx.custFollow ? ctx.custFollow.cfg() : { perDay: 3, minDays: 30 } }));
  app.put('/api/settings', ctx.requireAdmin, (req, res) => {
    const s = ctx.settings();
    const incoming = req.body && req.body.cadence;
    if (incoming) {
      const saved = {};
      for (const kind of KINDS) {
        saved[kind] = [];
        for (const rule of (Array.isArray(incoming[kind]) ? incoming[kind] : [])) {
          const days = rule.days === null || rule.days === '' ? null : Number(rule.days);
          if (days !== null && (!Number.isInteger(days) || days < 1 || days > 365)) return res.status(400).json({ error: 'Days must be a whole number from 1 to 365 (or empty for "no more follow-up")' });
          saved[kind].push({ key: String(rule.key), days });
        }
      }
      s.cadence = saved;
    }
    if (req.body.invoiceLeadDays !== undefined) {
      const n = Number(req.body.invoiceLeadDays);
      if (!Number.isInteger(n) || n < 0 || n > 30) return res.status(400).json({ error: 'Days before the due date: 0 to 30' });
      s.invoiceLeadDays = n;
    }
    if (req.body.custFollow !== undefined) {
      const perDay = Number(req.body.custFollow.perDay), minDays = Number(req.body.custFollow.minDays);
      if (!Number.isInteger(perDay) || perDay < 1 || perDay > 20) return res.status(400).json({ error: 'Customers a day: 1 to 20' });
      if (!Number.isInteger(minDays) || minDays < 1 || minDays > 365) return res.status(400).json({ error: 'Days without an order: 1 to 365' });
      s.custFollow = { perDay, minDays };
    }
    if (req.body.workDays !== undefined) {
      const days = [...new Set((Array.isArray(req.body.workDays) ? req.body.workDays : []).map(Number))];
      if (!days.length || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return res.status(400).json({ error: 'Choose at least one working day' });
      s.workDays = days.sort((a, b) => a - b);
    }
    ctx.saveSettings();
    ctx.log(req.user, 'Changed the follow-up rules and working days');
    res.json({ cadence: mergeCadence(s.cadence), invoiceLeadDays: s.invoiceLeadDays || 3, workDays: workDays() });
  });

  // ---- hand-over reset (owner only): clear test or old work so the team starts clean ----
  // What can be cleared. The designed tasks, team members, customers, rules and Zoho data are never touched.
  const RESETTABLE = { tasks: { label: 'Task work and history', collections: ['tasks'] }, requests: { label: 'Customer requests', collections: ['requests'] }, activity: { label: 'Activity feed and office transactions', collections: ['activity', 'transactions'] } };
  app.get('/api/reset/preview', ctx.requireAdmin, (req, res) => {
    res.json({ items: Object.entries(RESETTABLE).map(([key, r]) => ({ key, label: r.label, count: r.collections.reduce((n, c) => n + ctx.col(c).length, 0) })) });
  });
  app.post('/api/reset', ctx.requireAdmin, (req, res) => {
    if ((req.body && req.body.confirm) !== 'RESET') return res.status(400).json({ error: 'Type RESET to confirm' });
    const what = (Array.isArray(req.body.what) ? req.body.what : []).filter((k) => RESETTABLE[k]);
    if (!what.length) return res.status(400).json({ error: 'Choose what to clear' });
    // a copy of every file about to be emptied is kept, so a mistake can be undone by hand
    const dir = path.join(ctx.store.dir, 'backups', nowISO().replace(/[:.]/g, '-'));
    fs.mkdirSync(dir, { recursive: true });
    const names = what.flatMap((k) => RESETTABLE[k].collections);
    for (const n of names) { try { fs.copyFileSync(ctx.store.file(n), path.join(dir, n + '.json')); } catch (e) { /* nothing saved yet */ } }
    const cleared = {};
    if (what.includes('requests')) for (const r of ctx.col('requests')) for (const p of r.screenshots || []) { const f = files.filePath(ctx.store.dir, p.name); if (f) { try { fs.renameSync(f, path.join(dir, p.name)); } catch (e) { /* already gone */ } } }
    for (const n of names) { const c = ctx.col(n); cleared[n] = c.length; c.length = 0; ctx.save(n); }
    if (ctx.master) ctx.master.rebuild();
    ctx.log(req.user, 'Reset for the hand-over: cleared ' + what.map((k) => RESETTABLE[k].label.toLowerCase()).join(', '));
    res.json({ ok: true, cleared, backup: path.basename(dir) });
  });

  // ---- activity feed (admin): who updated what, and when ----
  app.get('/api/activity', ctx.requireAdmin, (req, res) => {
    let list = ctx.col('activity');
    if (req.query.userId) list = list.filter((a) => a.userId === req.query.userId);
    res.json({ activity: [...list].reverse().slice(0, Math.min(Number(req.query.limit) || 100, 300)) });
  });
};
