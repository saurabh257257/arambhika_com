// Invoices: unpaid invoices come from Zoho Books at runtime. Each one has an owner (the invoice's own, or the customer's owner)
// and a follow-up date. The owner can see at a glance which invoices are being chased properly and which are being forgotten.
// When Zoho shows an invoice as paid, it disappears from here by itself.
'use strict';
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
    const needs = daysToDue <= leadDays; // overdue, or due within the next few days
    let status = 'later';
    if (s.nextDate) status = followStatus(s.nextDate, today);
    else if (needs) status = 'overdue';
    const doneToday = istDate(s.lastAt) === today;
    return { id: i.id, number: i.number, customerId: i.customerId, customerName: i.customerName, phone: i.phone, date: i.date, dueDate: i.dueDate, total: i.total, balance: i.balance, zohoStatus: i.status,
      daysOverdue: daysToDue < 0 ? -daysToDue : 0, daysToDue: daysToDue === 999 ? null : daysToDue, needs, ownerId, ownerName: ctx.userName(ownerId), ownerExplicit: Boolean(s.ownerId),
      nextDate: s.nextDate || '', lastAt: s.lastAt || '', lastByName: s.lastByName || '', lastOutcome: s.lastOutcome || '', lastNote: s.lastNote || '', neverFollowed: !s.lastAt,
      followStatus: status, compliant: needs ? (status === 'ok' || doneToday) : true, doneToday };
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
    const needing = rows.filter((r) => r.needs);
    const summary = { unpaid: rows.length, outstanding: Math.round(rows.reduce((s, r) => s + r.balance, 0)), overdue: rows.filter((r) => r.daysOverdue > 0).length, needing: needing.length, compliant: needing.filter((r) => r.compliant).length,
      percent: needing.length ? Math.round(needing.filter((r) => r.compliant).length / needing.length * 100) : 100, unassigned: rows.filter((r) => !r.ownerId).length, neverFollowed: needing.filter((r) => r.neverFollowed).length };
    if (req.user.role !== 'admin') rows = rows.filter((r) => !r.ownerId || r.ownerId === req.user.id);
    const f = req.query.filter;
    if (f === 'mine') rows = rows.filter((r) => r.ownerId === req.user.id);
    if (f === 'unassigned') rows = rows.filter((r) => !r.ownerId);
    if (f === 'needs') rows = rows.filter((r) => r.needs && !r.compliant);
    if (f === 'overdue') rows = rows.filter((r) => r.daysOverdue > 0);
    if (req.user.role === 'admin' && req.query.userId) rows = rows.filter((r) => r.ownerId === req.query.userId);
    const q = str(req.query.q, 40).toLowerCase();
    if (q) rows = rows.filter((r) => (r.number + ' ' + r.customerName + ' ' + r.phone).toLowerCase().includes(q));
    const rank = { overdue: 0, due: 1, ok: 2, later: 3 };
    rows.sort((a, b) => (rank[a.followStatus] - rank[b.followStatus]) || b.daysOverdue - a.daysOverdue);
    res.json({ invoices: rows.slice(0, 300), summary, outcomes: ctx.cadence().invoice });
  });

  const idOk = (req, res) => { if (!ID_RE.test(req.params.id)) { res.status(400).json({ error: 'Bad invoice' }); return false; } return true; };

  app.post('/api/invoices/:id/pick', (req, res) => {
    if (req.user.role !== 'employee') return res.status(403).json({ error: 'Team members pick invoices; the owner assigns them' });
    if (!idOk(req, res)) return;
    const s = ensureState(req.params.id);
    if (s.ownerId) return res.status(400).json({ error: s.ownerId === req.user.id ? 'You already picked this invoice' : ctx.userName(s.ownerId) + ' already picked this invoice' });
    s.ownerId = req.user.id; s.updatedAt = nowISO(); ctx.save('invoicestate');
    ctx.log(req.user, 'Picked invoice ' + req.params.id);
    res.json({ ok: true });
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

  app.get('/api/invoices/:id/history', (req, res) => {
    if (!idOk(req, res)) return;
    res.json({ history: logs().filter((e) => e.kind === 'invoice' && e.refId === req.params.id).sort((a, b) => b.at.localeCompare(a.at)) });
  });
};
