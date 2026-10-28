// Customer requests: a customer messages (usually on WhatsApp), a team member logs them by hand and works the request through
// six steps, each a checkbox with a time and a name:
//   ask what is required > quote sent and payment asked > payment received (with screenshot) > material ready > dispatched > sent successfully
// A request that is not finished shows up again every day for its owner until the last step is ticked.
// New website orders from Zoho Books appear here by themselves (source "website") and their payment / dispatch / delivery steps
// tick from Zoho, so everything a customer has asked for lives in one list.
'use strict';
const fs = require('fs');
const files = require('../lib/files');
const { str, text, uid, nowISO, istDate, diffDays, isDate, PHONE_RE } = require('../lib/util');

const STEPS = [
  { key: 'ask', label: 'Asked what is required' },
  { key: 'quote', label: 'Quote sent and payment asked' },
  { key: 'payment', label: 'Payment received', needsPhoto: true },
  { key: 'ready', label: 'Material ready' },
  { key: 'dispatched', label: 'Material dispatched' },
  { key: 'done', label: 'Sent successfully' },
];
const SOURCES = ['WhatsApp', 'Call', 'Walk-in', 'Website', 'Other'];
const RECENT_DAYS = 60;
const MAX_PHOTOS = 5;

module.exports = function requests(app, ctx) {
  const list = () => ctx.col('requests');
  const skipped = () => ctx.col('requestsdeleted'); // website orders the owner deleted: { id: zohoSoId }
  const dataDir = ctx.store.dir;

  function view(r) {
    const today = ctx.todayIST();
    const done = STEPS.filter((s) => r.steps[s.key]).length;
    const next = STEPS.find((s) => !r.steps[s.key]);
    const touched = r.lastTouchedAt || r.createdAt;
    const complete = !next;
    const daysSinceTouched = Math.max(0, diffDays(today, istDate(touched)));
    return { ...r, ownerName: ctx.userName(r.ownerId), progress: { done, total: STEPS.length, percent: Math.round(done / STEPS.length * 100) }, nextStep: next ? next.label : 'Complete', complete,
      daysOpen: Math.max(0, diffDays(today, istDate(r.createdAt))), daysSinceTouched, touchedToday: istDate(touched) === today,
      needsAttention: !complete && daysSinceTouched >= 1 && ctx.tasks.isWorkDay(today), followUpDue: Boolean(r.nextDate && r.nextDate <= today && !complete) };
  }
  const isOpen = (r) => STEPS.some((s) => !r.steps[s.key]);

  // what a person has to do with their requests today: every open one, plus any finished today. Done = touched today.
  function stats(userId) {
    const today = ctx.todayIST(); const mine = list().filter((r) => r.ownerId === userId);
    const rel = mine.filter((r) => isOpen(r) || istDate(r.lastTouchedAt) === today);
    const touched = (r) => istDate(r.lastTouchedAt) === today;
    return { total: rel.length, done: rel.filter(touched).length, open: mine.filter(isOpen).length, oldestUntouched: mine.filter(isOpen).reduce((m, r) => Math.max(m, diffDays(today, istDate(r.lastTouchedAt || r.createdAt))), 0),
      untouched: mine.filter((r) => isOpen(r) && !touched(r)).length };
  }
  ctx.requests = { stats, list, STEPS, view };

  function readFields(b, existing = {}) {
    const pick = (k) => (b[k] !== undefined ? b[k] : existing[k]);
    const customerName = str(pick('customerName'), 100);
    if (!customerName) return { error: 'Enter the customer name' };
    const phone = str(pick('phone'), 20);
    if (phone && !PHONE_RE.test(phone)) return { error: 'That phone number does not look right' };
    const amt = pick('amount') === undefined || pick('amount') === '' || pick('amount') === null ? 0 : Math.round(Number(pick('amount')) * 100) / 100;
    if (!Number.isFinite(amt) || amt < 0 || amt > 1e9) return { error: 'Amount must be a number' };
    const source = SOURCES.includes(pick('source')) ? pick('source') : (existing.source || 'WhatsApp');
    return { value: { customerName, phone, company: str(pick('company'), 100), request: text(pick('request'), 1000), source, amount: amt } };
  }

  function create({ user, fields, ownerId, zoho }) {
    const at = (zoho && zoho.at) || nowISO();
    const r = { id: uid(), ...fields, ownerId: ownerId || '', pickedAt: ownerId ? nowISO() : '', steps: {}, screenshots: [], notes: [], nextDate: '', lastTouchedAt: at, createdAt: at, createdByName: zoho ? 'Zoho' : (user ? user.name : ''), updatedAt: at, zohoSoId: zoho ? zoho.id : '', zohoSoNumber: zoho ? zoho.number : '' };
    if (zoho) { r.steps.ask = { at, by: 'Website' }; r.steps.quote = { at, by: 'Website' }; }
    list().push(r); ctx.save('requests');
    if (user) ctx.log(user, 'Logged a customer request from ' + r.customerName + (r.ownerId ? ' (owner: ' + ctx.userName(r.ownerId) + ')' : ' (waiting to be picked)'));
    return r;
  }

  // ---- website orders from Zoho Books ----
  async function syncFromZoho(refresh) {
    if (!ctx.zoho.configured) return { ok: false, error: 'Zoho is not connected to this panel yet' };
    try {
      const sos = await ctx.zoho.salesOrders({ refresh });
      const today = ctx.todayIST(); const rows = list(); let changed = false;
      for (const so of sos) {
        if (skipped().some((x) => x.id === so.id)) continue; // the owner deleted this one, so it does not come back
        let r = rows.find((x) => x.zohoSoId === so.id);
        const fulfilled = ['fulfilled', 'delivered'].includes(so.shipped);
        if (!r) {
          if (!so.date || diffDays(today, so.date) > RECENT_DAYS || so.status === 'void' || fulfilled) continue;
          const fields = { customerName: str(so.customerName, 100) || 'Website customer', phone: '', company: '', request: 'Website order ' + so.number, source: 'Website', amount: so.total };
          r = create({ user: null, fields, ownerId: '', zoho: { id: so.id, number: so.number, at: so.createdTime ? new Date(so.createdTime).toISOString() : nowISO() } });
          changed = true;
        }
        const tick = (key, yes) => { if (yes && !r.steps[key]) { r.steps[key] = { at: nowISO(), by: 'Zoho' }; r.lastTouchedAt = nowISO(); r.updatedAt = r.lastTouchedAt; changed = true; } };
        const shipped = ['shipped', 'fulfilled', 'delivered', 'partially_shipped'].includes(so.shipped);
        tick('payment', so.paid === 'paid');
        tick('ready', shipped); // it cannot have shipped unless the material was ready
        tick('dispatched', shipped);
        tick('done', fulfilled);
      }
      if (changed) ctx.save('requests');
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  }

  const find = (req) => list().find((x) => x.id === req.params.id && (req.user.role === 'admin' || x.ownerId === req.user.id));

  app.get('/api/requests', async (req, res) => {
    const zoho = await syncFromZoho(req.query.refresh === '1');
    let rows = list();
    if (req.user.role !== 'admin') rows = rows.filter((r) => !r.ownerId || r.ownerId === req.user.id);
    const f = req.query.filter || 'open';
    if (f === 'mine') rows = rows.filter((r) => r.ownerId === req.user.id);
    if (f === 'unassigned') rows = rows.filter((r) => !r.ownerId);
    if (req.user.role === 'admin' && req.query.userId) rows = rows.filter((r) => r.ownerId === req.query.userId);
    const out = rows.map(view);
    const shown = f === 'all' || f === 'done' ? out.filter((r) => f === 'all' || r.complete) : out.filter((r) => !r.complete);
    shown.sort((a, b) => (a.complete - b.complete) || (a.ownerId ? 1 : 0) - (b.ownerId ? 1 : 0) || b.daysSinceTouched - a.daysSinceTouched || a.createdAt.localeCompare(b.createdAt));
    res.json({ requests: shown.slice(0, 300), steps: STEPS, sources: SOURCES, zoho });
  });

  // the existing customers a request can be linked to (from Zoho, cached): just the names and phones, sorted
  app.get('/api/customer-options', async (req, res) => {
    try {
      const d = await ctx.customersData(false);
      res.json({ customers: d.list.map((c) => ({ id: c.id, name: c.name, company: c.company, phone: c.phone })).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 1000) });
    } catch (err) { res.json({ customers: [], error: 'Zoho did not answer: ' + err.message }); }
  });

  app.post('/api/requests', async (req, res) => {
    const body = { ...(req.body || {}) };
    let customerType = 'new'; let customerId = '';
    if (body.customerType === 'existing') {
      customerType = 'existing'; customerId = String(body.customerId || '');
      if (!/^\d{1,30}$/.test(customerId)) return res.status(400).json({ error: 'Choose the customer from the list' });
      let found = null;
      try { found = (await ctx.customersData(false)).list.find((c) => c.id === customerId); } catch (err) { return res.status(400).json({ error: 'Zoho is not answering, so the customer list cannot be used right now. Try again in a minute, or log them as a new customer.' }); }
      if (!found) return res.status(400).json({ error: 'That customer was not found in Zoho. Refresh the page and choose again.' });
      // the customer's details come from Zoho; anything typed in the form wins
      body.customerName = body.customerName || found.name; body.phone = body.phone !== undefined && body.phone !== '' ? body.phone : found.phone; body.company = body.company || found.company;
    }
    const r = readFields(body); if (r.error) return res.status(400).json({ error: r.error });
    r.value.customerType = customerType; r.value.customerId = customerId;
    let ownerId = '';
    if (req.user.role === 'employee') ownerId = req.user.id; // a request you log yourself is yours
    else if (req.body.ownerId) { if (!ctx.employees().some((u) => u.id === req.body.ownerId)) return res.status(400).json({ error: 'Choose a team member' }); ownerId = req.body.ownerId; }
    const made = create({ user: req.user, fields: r.value, ownerId });
    if (/^d{4}-d{2}-d{2}$/.test(String(req.body.nextDate || ''))) { made.nextDate = req.body.nextDate; ctx.save('requests'); }
    res.json({ request: view(made) });
  });

  app.patch('/api/requests/:id', (req, res) => {
    const r = find(req); if (!r) return res.status(404).json({ error: 'Request not found' });
    const f = readFields(req.body || {}, r); if (f.error) return res.status(400).json({ error: f.error });
    Object.assign(r, f.value); r.updatedAt = nowISO(); ctx.save('requests');
    res.json({ request: view(r) });
  });

  app.post('/api/requests/:id/pick', (req, res) => {
    if (req.user.role !== 'employee') return res.status(403).json({ error: 'Team members pick requests; the owner assigns them' });
    const r = list().find((x) => x.id === req.params.id);
    if (!r) return res.status(404).json({ error: 'Request not found' });
    if (r.ownerId) return res.status(400).json({ error: r.ownerId === req.user.id ? 'You already picked this request' : ctx.userName(r.ownerId) + ' already picked this request' });
    r.ownerId = req.user.id; r.pickedAt = nowISO(); r.lastTouchedAt = r.pickedAt; r.updatedAt = r.pickedAt; ctx.save('requests');
    ctx.log(req.user, 'Picked the request from ' + r.customerName);
    res.json({ request: view(r) });
  });

  app.post('/api/requests/:id/assign', ctx.requireAdmin, (req, res) => {
    const r = list().find((x) => x.id === req.params.id);
    if (!r) return res.status(404).json({ error: 'Request not found' });
    const to = req.body.ownerId || '';
    if (to && !ctx.employees().some((u) => u.id === to)) return res.status(400).json({ error: 'Choose a team member' });
    r.ownerId = to; r.pickedAt = to ? nowISO() : ''; r.updatedAt = nowISO(); ctx.save('requests');
    ctx.log(req.user, 'Assigned the request from ' + r.customerName + ' to ' + (to ? ctx.userName(to) : 'nobody'));
    res.json({ request: view(r) });
  });

  // tick or untick a step; the time and the person are written next to it. Payment needs its screenshot first.
  app.put('/api/requests/:id/steps/:step', (req, res) => {
    const r = find(req); if (!r) return res.status(404).json({ error: 'Only the person who owns this request can update it' });
    const step = STEPS.find((s) => s.key === req.params.step);
    if (!step) return res.status(400).json({ error: 'Unknown step' });
    if (req.body.done) {
      if (step.needsPhoto && !r.screenshots.length) return res.status(400).json({ error: 'Upload the payment screenshot first' });
      r.steps[step.key] = { at: nowISO(), by: req.user.name };
    } else delete r.steps[step.key];
    r.lastTouchedAt = nowISO(); r.updatedAt = r.lastTouchedAt; ctx.save('requests');
    ctx.log(req.user, (req.body.done ? 'Ticked "' : 'Unticked "') + step.label + '" for ' + r.customerName);
    res.json({ request: view(r) });
  });

  // a note about what happened with the customer, and when to get back to them
  app.post('/api/requests/:id/note', (req, res) => {
    const r = find(req); if (!r) return res.status(404).json({ error: 'Request not found' });
    const body = text(req.body.text, 1000);
    if (body.length < 2) return res.status(400).json({ error: 'Write what happened' });
    const next = req.body.nextDate ? String(req.body.nextDate) : '';
    if (next && (!isDate(next) || next < ctx.todayIST())) return res.status(400).json({ error: 'The next follow-up cannot be in the past' });
    r.notes.push({ at: nowISO(), byName: req.user.name, text: body, nextDate: next });
    r.nextDate = next; r.lastTouchedAt = nowISO(); r.updatedAt = r.lastTouchedAt; ctx.save('requests');
    ctx.log(req.user, 'Note on the request from ' + r.customerName + (next ? ', follow up on ' + next : ''));
    res.json({ request: view(r) });
  });

  // the owner can delete a request for good (wrong entry, test, duplicate). Its screenshots go too, and a website order is
  // remembered so the next Zoho check does not bring it back.
  app.delete('/api/requests/:id', ctx.requireAdmin, (req, res) => {
    const rows = list(); const i = rows.findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'Request not found' });
    const r = rows[i]; rows.splice(i, 1);
    if (r.zohoSoId) { skipped().push({ id: r.zohoSoId }); ctx.save('requestsdeleted'); }
    for (const p of r.screenshots || []) { const fp = files.filePath(dataDir, p.name); if (fp) { try { fs.unlinkSync(fp); } catch (e) { /* already gone */ } } }
    ctx.save('requests');
    ctx.log(req.user, 'Deleted the customer request from ' + r.customerName + (r.request ? ' (' + String(r.request).slice(0, 60) + ')' : ''));
    res.json({ ok: true });
  });

  app.post('/api/requests/:id/screenshot', (req, res) => {
    const r = find(req); if (!r) return res.status(404).json({ error: 'Request not found' });
    if (r.screenshots.length >= MAX_PHOTOS) return res.status(400).json({ error: 'At most ' + MAX_PHOTOS + ' photos per request' });
    const saved = files.saveDataUrl(dataDir, req.body && req.body.dataUrl);
    if (saved.error) return res.status(400).json({ error: saved.error });
    r.screenshots.push({ name: saved.name, at: nowISO(), byName: req.user.name });
    r.lastTouchedAt = nowISO(); r.updatedAt = r.lastTouchedAt; ctx.save('requests');
    ctx.log(req.user, 'Uploaded a screenshot for ' + r.customerName);
    res.json({ request: view(r) });
  });

  // saved photos: only for signed-in people
  app.get('/api/files/:name', (req, res) => {
    const p = files.filePath(dataDir, req.params.name);
    if (!p || !fs.existsSync(p)) return res.status(404).json({ error: 'Not found' });
    res.set({ 'Content-Type': files.contentType(req.params.name), 'Cache-Control': 'private, max-age=3600' });
    fs.createReadStream(p).pipe(res);
  });
};
