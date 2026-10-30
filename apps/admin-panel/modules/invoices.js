// Invoices: unpaid invoices come from Zoho Books at runtime. Each one has an owner (the invoice's own, or the customer's owner)
// and a follow-up date. The owner can see at a glance which invoices are being chased properly and which are being forgotten.
// When Zoho shows an invoice as paid, it disappears from here by itself.
'use strict';
const files = require('../lib/files');
const { str, nowISO, diffDays, istDate } = require('../lib/util');
const { applyFollowup, followStatus } = require('../lib/followups');

const ID_RE = /^\d{1,30}$/;

module.exports = function invoices(app, ctx) {
  const states = () => ctx.col('invoicestate');
  const cstates = () => ctx.col('customerstate');
  const logs = () => ctx.col('followups');
  const stateOf = (id) => states().find((s) => s.id === id);
  const ensureState = (id) => {
    let s = stateOf(id);
    if (!s) { s = { id, ownerId: '', nextDate: '', lastAt: '', lastBy: '', lastByName: '', lastOutcome: '', lastNote: '', updatedAt: '' }; states().push(s); }
    return s;
  };
  const unpaid = (i) => i.balance > 0 && !['void', 'draft', 'paid'].includes(i.status);

  function view(i, today, leadDays) {
    const s = stateOf(i.id) || {};
    const cs = cstates().find((c) => c.id === i.customerId);
    const ownerId = s.ownerId || (cs && cs.ownerId) || '';
    const daysToDue = i.dueDate ? diffDays(i.dueDate, today) : 999;
    const claim = s.paidClaim || null; // the customer says they paid: the team member marked it with a photo, and Zoho will confirm
    const needs = !claim && daysToDue <= leadDays; // overdue, or due within the next few days
    let status = 'later';
    if (claim) status = 'paidclaim';
    else if (s.nextDate) status = followStatus(s.nextDate, today);
    else if (needs) status = 'overdue';
    const doneToday = istDate(s.lastAt) === today || Boolean(claim && istDate(claim.at) === today);
    return { id: i.id, number: i.number, customerId: i.customerId, customerName: i.customerName, phone: i.phone, date: i.date, dueDate: i.dueDate, total: i.total, balance: i.balance, zohoStatus: i.status,
      daysOverdue: daysToDue < 0 ? -daysToDue : 0, daysToDue: daysToDue === 999 ? null : daysToDue, needs, ownerId, ownerName: ctx.userName(ownerId), ownerExplicit: Boolean(s.ownerId),
      nextDate: s.nextDate || '', lastAt: s.lastAt || '', lastByName: s.lastByName || '', lastOutcome: s.lastOutcome || '', lastNote: s.lastNote || '', neverFollowed: !s.lastAt,
      followStatus: status, compliant: needs ? (status === 'ok' || doneToday) : true, doneToday, paidClaim: claim };
  }
  async function load(refresh) {
    const all = await ctx.zoho.invoices({ refresh });
    const today = ctx.todayIST(); const lead = ctx.settings().invoiceLeadDays === undefined ? 3 : ctx.settings().invoiceLeadDays;
    return all.filter(unpaid).map((i) => view(i, today, lead));
  }
  ctx.invoicesData = load;

  app.get('/api/invoices', async (req, res) => {
    let rows;
    try { rows = await load(req.query.refresh === '1'); } catch (err) { return res.json({ invoices: [], summary: {}, error: err.message, outcomes: ctx.cadence().invoice }); }
    // a team member only ever sees (and is only counted on) the invoices that belong to them; the owner sees all
    if (req.user.role !== 'admin') rows = rows.filter((r) => r.ownerId === req.user.id);
    const needing = rows.filter((r) => r.needs);
    const summary = { unpaid: rows.length, outstanding: Math.round(rows.reduce((s, r) => s + r.balance, 0)), overdue: rows.filter((r) => r.daysOverdue > 0).length, needing: needing.length, compliant: needing.filter((r) => r.compliant).length,
      percent: needing.length ? Math.round(needing.filter((r) => r.compliant).length / needing.length * 100) : 100, unassigned: rows.filter((r) => !r.ownerId).length, neverFollowed: needing.filter((r) => r.neverFollowed).length };
    const f = req.query.filter;
    if (f === 'mine') rows = rows.filter((r) => r.ownerId === req.user.id);
    if (f === 'unassigned') rows = rows.filter((r) => !r.ownerId);
    if (f === 'needs') rows = rows.filter((r) => r.needs && !r.compliant);
    if (f === 'overdue') rows = rows.filter((r) => r.daysOverdue > 0);
    if (req.user.role === 'admin' && req.query.userId) rows = rows.filter((r) => r.ownerId === req.query.userId);
    const q = str(req.query.q, 40).toLowerCase();
    if (q) rows = rows.filter((r) => (r.number + ' ' + r.customerName + ' ' + r.phone).toLowerCase().includes(q));
    const rank = { overdue: 0, due: 1, ok: 2, later: 3, paidclaim: 4 };
    rows.sort((a, b) => (rank[a.followStatus] - rank[b.followStatus]) || b.daysOverdue - a.daysOverdue);
    res.json({ invoices: rows.slice(0, 300), summary, outcomes: ctx.cadence().invoice });
  });

  const idOk = (req, res) => { if (!ID_RE.test(req.params.id)) { res.status(400).json({ error: 'Bad invoice' }); return false; } return true; };

  // "the customer paid": the owner of the invoice (or the owner of the panel) attaches a photo of the payment or the invoice.
  // Zoho is not changed (the panel only reads it); the invoice shows as paid here until Zoho marks it paid and it drops off the list.
  app.post('/api/invoices/:id/paid', async (req, res) => {
    if (!idOk(req, res)) return;
    let inv;
    try { inv = (await load(false)).find((r) => r.id === req.params.id); } catch (err) { return res.status(502).json({ error: err.message }); }
    if (!inv) return res.status(404).json({ error: 'That invoice is not unpaid any more' });
    if (req.user.role !== 'admin' && inv.ownerId !== req.user.id) return res.status(404).json({ error: 'Only the owner of this invoice can mark it paid' });
    const s = ensureState(req.params.id);
    if (s.paidClaim && s.paidClaim.proofs.length >= 5) return res.status(400).json({ error: 'That is enough photos for one invoice' });
    const saved = files.saveDataUrl(ctx.store.dir, req.body && req.body.dataUrl);
    if (saved.error) return res.status(400).json({ error: saved.error });
    const at = nowISO(); const proof = { name: saved.name, at, byName: req.user.name };
    if (s.paidClaim) s.paidClaim.proofs.push(proof);
    else s.paidClaim = { at, byId: req.user.id, byName: req.user.name, proofs: [proof] };
    s.updatedAt = at; ctx.save('invoicestate');
    ctx.log(req.user, 'Invoice ' + inv.number + ' (' + inv.customerName + ') marked paid by the customer, with a photo');
    res.json({ ok: true, paidClaim: s.paidClaim });
  });
  app.delete('/api/invoices/:id/paid', (req, res) => {
    if (!idOk(req, res)) return;
    const s = stateOf(req.params.id);
    if (!s || !s.paidClaim) return res.status(404).json({ error: 'Not marked paid' });
    if (req.user.role !== 'admin' && s.paidClaim.byId !== req.user.id) return res.status(404).json({ error: 'Only the person who marked it can undo it' });
    s.paidClaim = null; s.updatedAt = nowISO(); ctx.save('invoicestate');
    ctx.log(req.user, 'Undid "paid" on invoice ' + req.params.id);
    res.json({ ok: true });
  });

  app.post('/api/invoices/:id/pick', (req, res) => {
    res.status(403).json({ error: 'The owner assigns invoices (they follow the customer, or are given to you directly)' });
  });

  app.post('/api/invoices/:id/assign', ctx.requireAdmin, (req, res) => {
    if (!idOk(req, res)) return;
    const to = req.body.ownerId || '';
    if (to && !ctx.employees().some((u) => u.id === to)) return res.status(400).json({ error: 'Choose a team member' });
    const s = ensureState(req.params.id); s.ownerId = to; s.updatedAt = nowISO(); ctx.save('invoicestate');
    ctx.log(req.user, 'Assigned invoice ' + req.params.id + ' to ' + (to ? ctx.userName(to) : 'nobody'));
    res.json({ ok: true });
  });

  app.post('/api/invoices/:id/followup', async (req, res) => {
    if (!idOk(req, res)) return;
    let inv;
    try { inv = (await load(false)).find((r) => r.id === req.params.id); } catch (err) { return res.status(502).json({ error: err.message }); }
    if (!inv) return res.status(404).json({ error: 'That invoice is not unpaid any more' });
    if (inv.ownerId !== req.user.id) return res.status(404).json({ error: 'Only the owner of this invoice can log a follow-up' });
    const s = ensureState(req.params.id);
    try {
      const entry = applyFollowup(s, { user: req.user, kind: 'invoice', label: inv.number + ' ' + inv.customerName, refId: req.params.id, outcome: req.body.outcome, note: req.body.note, nextDate: req.body.nextDate, cadence: ctx.cadence(), today: ctx.todayIST() });
      logs().push(entry); ctx.save('followups'); ctx.save('invoicestate');
      ctx.log(req.user, 'Invoice ' + inv.number + ': ' + entry.outcomeLabel + (entry.nextDate ? ', next on ' + entry.nextDate : ''));
      res.json({ ok: true, nextDate: entry.nextDate });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.get('/api/invoices/:id/history', async (req, res) => {
    if (!idOk(req, res)) return;
    if (req.user.role !== 'admin') {
      let mine = null; try { mine = (await load(false)).find((r) => r.id === req.params.id); } catch (e) { /* no Zoho: nothing to show */ }
      if (!mine || mine.ownerId !== req.user.id) return res.json({ history: [] });
    }
    res.json({ history: logs().filter((e) => e.kind === 'invoice' && e.refId === req.params.id).sort((a, b) => b.at.localeCompare(a.at)) });
  });
};
