// Customers: the list comes from Zoho Books at runtime (nothing is copied here). The panel only remembers what the team
// adds on top: who owns each customer, when to follow up next, what happened last time, and whether they are onboarded.
// "Onboarded" is worked out automatically (the customer has been invoiced before) and the owner or team member can override it.
'use strict';
const { str, nowISO } = require('../lib/util');
const { applyFollowup, followStatus } = require('../lib/followups');

const ID_RE = /^\d{1,30}$/;

module.exports = function customers(app, ctx) {
  const states = () => ctx.col('customerstate');
  const logs = () => ctx.col('followups');
  const stateOf = (id) => states().find((s) => s.id === id);
  const ensureState = (id) => {
    let s = stateOf(id);
    if (!s) { s = { id, ownerId: '', nextDate: '', lastAt: '', lastBy: '', lastByName: '', lastOutcome: '', lastNote: '', onboarded: null, updatedAt: '' }; states().push(s); }
    return s;
  };

  // customers with their invoice history and our own follow-up details
  async function load(refresh) {
    const [c, inv] = await Promise.all([ctx.zoho.customers({ refresh }), ctx.zoho.invoices({ refresh }).catch(() => [])]);
    const by = new Map();
    for (const i of inv) {
      const b = by.get(i.customerId) || { count: 0, billed: 0, last: '', outstanding: 0 };
      b.count += 1; b.billed += i.total; if (i.date > b.last) b.last = i.date;
      if (i.balance > 0 && i.status !== 'void' && i.status !== 'draft') b.outstanding += i.balance;
      by.set(i.customerId, b);
    }
    return { source: c.source, note: c.note || '', by, list: c.list };
  }
  ctx.customersData = load;

  function view(c, by, today) {
    const s = stateOf(c.id) || {};
    const b = by.get(c.id) || { count: 0, billed: 0, last: '', outstanding: 0 };
    const auto = b.count > 0;
    return { id: c.id, name: c.name, company: c.company, phone: c.phone, email: c.email, invoices: b.count, billed: Math.round(b.billed), lastInvoice: b.last, outstanding: Math.round(b.outstanding || c.outstanding || 0), onboarded: s.onboarded === true || s.onboarded === false ? s.onboarded : auto, onboardedAuto: auto, onboardedManual: s.onboarded === true || s.onboarded === false,
      ownerId: s.ownerId || '', ownerName: ctx.userName(s.ownerId), nextDate: s.nextDate || '', lastAt: s.lastAt || '', lastByName: s.lastByName || '', lastOutcome: s.lastOutcome || '', lastNote: s.lastNote || '', followStatus: followStatus(s.nextDate, today) };
  }

  app.get('/api/customers', async (req, res) => {
    const today = ctx.todayIST();
    let data;
    try { data = await load(req.query.refresh === '1'); } catch (err) { return res.json({ customers: [], counts: {}, error: err.message, outcomes: ctx.cadence().customer }); }
    let rows = data.list.map((c) => view(c, data.by, today));
    const counts = { total: rows.length, unassigned: rows.filter((r) => !r.ownerId).length, mine: rows.filter((r) => r.ownerId === req.user.id).length, due: rows.filter((r) => r.ownerId && (r.followStatus === 'due' || r.followStatus === 'overdue')).length };
    if (req.user.role !== 'admin') rows = rows.filter((r) => !r.ownerId || r.ownerId === req.user.id);
    const f = req.query.filter;
    if (f === 'mine') rows = rows.filter((r) => r.ownerId === req.user.id);
    if (f === 'unassigned') rows = rows.filter((r) => !r.ownerId);
    if (f === 'due') rows = rows.filter((r) => r.ownerId && (r.followStatus === 'due' || r.followStatus === 'overdue') && (req.user.role === 'admin' || r.ownerId === req.user.id));
    if (f === 'notonboarded') rows = rows.filter((r) => !r.onboarded);
    if (req.user.role === 'admin' && req.query.userId) rows = rows.filter((r) => r.ownerId === req.query.userId);
    const q = str(req.query.q, 40).toLowerCase();
    if (q) rows = rows.filter((r) => (r.name + ' ' + r.company + ' ' + r.phone + ' ' + r.email).toLowerCase().includes(q));
    const rank = { overdue: 0, due: 1, none: 2, ok: 3 };
    rows.sort((a, b) => (rank[a.followStatus] - rank[b.followStatus]) || a.name.localeCompare(b.name));
    res.json({ customers: rows.slice(0, 300), counts, source: data.source, note: data.note, outcomes: ctx.cadence().customer });
  });

  const idOk = (req, res) => { if (!ID_RE.test(req.params.id)) { res.status(400).json({ error: 'Bad customer' }); return false; } return true; };

  app.post('/api/customers/:id/pick', async (req, res) => {
    if (req.user.role !== 'employee') return res.status(403).json({ error: 'Team members pick customers; the owner assigns them' });
    if (!idOk(req, res)) return;
    const s = ensureState(req.params.id);
    if (s.ownerId) return res.status(400).json({ error: s.ownerId === req.user.id ? 'You already picked this customer' : ctx.userName(s.ownerId) + ' already picked this customer' });
    s.ownerId = req.user.id; s.updatedAt = nowISO(); ctx.save('customerstate');
    ctx.log(req.user, 'Picked customer ' + req.params.id);
    res.json({ ok: true });
  });

  app.post('/api/customers/:id/assign', ctx.requireAdmin, (req, res) => {
    if (!idOk(req, res)) return;
    const to = req.body.ownerId || '';
    if (to && !ctx.employees().some((u) => u.id === to)) return res.status(400).json({ error: 'Choose a team member' });
    const s = ensureState(req.params.id); s.ownerId = to; s.updatedAt = nowISO(); ctx.save('customerstate');
    ctx.log(req.user, 'Assigned customer ' + req.params.id + ' to ' + (to ? ctx.userName(to) : 'nobody'));
    res.json({ ok: true });
  });

  // spread every customer without an owner evenly across the active team
  app.post('/api/customers/auto-assign', ctx.requireAdmin, async (req, res) => {
    const team = ctx.employees();
    if (!team.length) return res.status(400).json({ error: 'Add team members first' });
    let data; try { data = await load(false); } catch (err) { return res.status(502).json({ error: err.message }); }
    const loads = new Map(team.map((u) => [u.id, states().filter((s) => s.ownerId === u.id).length]));
    let n = 0;
    for (const c of data.list) {
      if (stateOf(c.id) && stateOf(c.id).ownerId) continue;
      const [id] = [...loads.entries()].sort((a, b) => a[1] - b[1])[0];
      ensureState(c.id).ownerId = id; ensureState(c.id).updatedAt = nowISO(); loads.set(id, loads.get(id) + 1); n += 1;
    }
    ctx.save('customerstate');
    ctx.log(req.user, 'Shared ' + n + ' customers evenly across the team');
    res.json({ assigned: n });
  });

  app.patch('/api/customers/:id', (req, res) => {
    if (!idOk(req, res)) return;
    const s = stateOf(req.params.id);
    if (req.user.role !== 'admin' && !(s && s.ownerId === req.user.id)) return res.status(404).json({ error: 'Customer not found' });
    const v = req.body.onboarded;
    if (!(v === true || v === false || v === null)) return res.status(400).json({ error: 'Onboarded: yes, no, or automatic' });
    const st = ensureState(req.params.id); st.onboarded = v; st.updatedAt = nowISO(); ctx.save('customerstate');
    res.json({ ok: true });
  });

  app.post('/api/customers/:id/followup', async (req, res) => {
    if (!idOk(req, res)) return;
    const s = stateOf(req.params.id);
    if (!s || s.ownerId !== req.user.id) return res.status(404).json({ error: 'Only the person who owns this customer can log a follow-up' });
    let name = req.params.id;
    try { const d = await load(false); const c = d.list.find((x) => x.id === req.params.id); if (c) name = c.name; } catch (e) { /* the log still works without the name */ }
    try {
      const entry = applyFollowup(s, { user: req.user, kind: 'customer', label: name, refId: req.params.id, outcome: req.body.outcome, note: req.body.note, nextDate: req.body.nextDate, cadence: ctx.cadence(), today: ctx.todayIST() });
      if (req.body.outcome === 'ordered') s.onboarded = true;
      logs().push(entry); ctx.save('followups'); ctx.save('customerstate');
      ctx.log(req.user, 'Customer ' + name + ': ' + entry.outcomeLabel + (entry.nextDate ? ', next on ' + entry.nextDate : ''));
      res.json({ ok: true, nextDate: entry.nextDate });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.get('/api/customers/:id/history', (req, res) => {
    if (!idOk(req, res)) return;
    const s = stateOf(req.params.id);
    if (req.user.role !== 'admin' && !(s && (!s.ownerId || s.ownerId === req.user.id))) return res.json({ history: [] });
    res.json({ history: logs().filter((e) => e.kind === 'customer' && e.refId === req.params.id).sort((a, b) => b.at.localeCompare(a.at)) });
  });
};
