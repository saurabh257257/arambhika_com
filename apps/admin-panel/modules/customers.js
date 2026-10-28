// Customers: the list comes from Zoho Books at runtime (nothing is copied here). The panel only remembers what the team
// adds on top: who owns each customer, when to follow up next, what happened last time, and whether they are onboarded.
// "Onboarded" is worked out automatically (the customer has been invoiced before) and the owner or team member can override it.
'use strict';
const { str, nowISO } = require('../lib/util');
const { applyFollowup, followStatus } = require('../lib/followups');

const ID_RE = /^\d{1,30}$/;
// a regular customer has been invoiced at least this many times; everybody else is occasional (or has never been invoiced)
const REGULAR_MIN_INVOICES = 2;

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
      if (i.status === 'void' || i.status === 'draft') continue;
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
    return { id: c.id, name: c.name, company: c.company, phone: c.phone, email: c.email, invoices: b.count, regular: b.count >= REGULAR_MIN_INVOICES, billed: Math.round(b.billed), lastInvoice: b.last, outstanding: Math.round(b.outstanding || c.outstanding || 0), onboarded: s.onboarded === true || s.onboarded === false ? s.onboarded : auto, onboardedAuto: auto, onboardedManual: s.onboarded === true || s.onboarded === false,
      ownerId: s.ownerId || '', ownerName: ctx.userName(s.ownerId), nextDate: s.nextDate || '', lastAt: s.lastAt || '', lastByName: s.lastByName || '', lastOutcome: s.lastOutcome || '', lastNote: s.lastNote || '', followStatus: followStatus(s.nextDate, today) };
  }

  app.get('/api/customers', async (req, res) => {
    const today = ctx.todayIST();
    let data;
    try { data = await load(req.query.refresh === '1'); } catch (err) { return res.json({ customers: [], counts: {}, error: err.message, outcomes: ctx.cadence().customer }); }
    let rows = data.list.map((c) => view(c, data.by, today));
    const counts = { total: rows.length, unassigned: rows.filter((r) => !r.ownerId).length, mine: rows.filter((r) => r.ownerId === req.user.id).length, due: rows.filter((r) => r.ownerId && (r.followStatus === 'due' || r.followStatus === 'overdue')).length };
    // who has how many customers (regular and others), for the owner's pie charts
    if (req.user.role === 'admin') {
      const mk = (id, name) => ({ id, name, regular: 0, other: 0 });
      const per = new Map([['', mk('', 'Nobody yet')], ...ctx.employees().map((u) => [u.id, mk(u.id, u.name)])]);
      for (const r of rows) { const p = per.get(r.ownerId) || per.get(''); p[r.regular ? 'regular' : 'other'] += 1; }
      counts.owners = [...per.values()];
    }
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

  // Share the customers between the active team so that nobody gets all or most of a kind: regular customers (invoiced
  // REGULAR_MIN_INVOICES times or more) are split evenly among the team, and everybody else is split evenly among them
  // separately. Inside each kind the biggest customers are handed out first, to whoever has fewer and then less business so far,
  // so the valuable ones are spread too. { all: true } first clears every current owner and starts from scratch.
  app.post('/api/customers/auto-assign', ctx.requireAdmin, async (req, res) => {
    const team = ctx.employees();
    if (!team.length) return res.status(400).json({ error: 'Add team members first' });
    let data; try { data = await load(false); } catch (err) { return res.status(502).json({ error: err.message }); }
    const redo = Boolean(req.body && req.body.all);
    const stat = (c) => data.by.get(c.id) || { count: 0, billed: 0 };
    if (redo) for (const c of data.list) { const s = stateOf(c.id); if (s) s.ownerId = ''; }
    const kinds = { regular: data.list.filter((c) => stat(c).count >= REGULAR_MIN_INVOICES), other: data.list.filter((c) => stat(c).count < REGULAR_MIN_INVOICES) };
    const total = new Map(team.map((u) => [u.id, 0])); // how many customers each person has in all
    const out = {}; let assigned = 0;
    for (const kind of Object.keys(kinds)) {
      const count = new Map(team.map((u) => [u.id, 0])); const value = new Map(team.map((u) => [u.id, 0]));
      const todo = [];
      for (const c of kinds[kind]) {
        const s = stateOf(c.id);
        if (s && s.ownerId && count.has(s.ownerId)) { count.set(s.ownerId, count.get(s.ownerId) + 1); value.set(s.ownerId, value.get(s.ownerId) + stat(c).billed); total.set(s.ownerId, total.get(s.ownerId) + 1); }
        else if (!s || !s.ownerId) todo.push(c);
      }
      todo.sort((x, y) => stat(y).billed - stat(x).billed || x.name.localeCompare(y.name));
      let n = 0;
      for (const c of todo) {
        const pick = team.slice().sort((x, y) => (count.get(x.id) - count.get(y.id)) || (value.get(x.id) - value.get(y.id)) || (total.get(x.id) - total.get(y.id)) || x.name.localeCompare(y.name))[0];
        const st = ensureState(c.id); st.ownerId = pick.id; st.updatedAt = nowISO();
        count.set(pick.id, count.get(pick.id) + 1); value.set(pick.id, value.get(pick.id) + stat(c).billed); total.set(pick.id, total.get(pick.id) + 1); n += 1;
      }
      assigned += n;
      out[kind] = { customers: kinds[kind].length, assigned: n, perPerson: team.map((u) => ({ id: u.id, name: u.name, count: count.get(u.id), billed: Math.round(value.get(u.id)) })) };
    }
    ctx.save('customerstate');
    ctx.log(req.user, (redo ? 'Re-split all customers' : 'Shared the customers without an owner') + ' between the team: ' + out.regular.customers + ' regular and ' + out.other.customers + ' others, ' + assigned + ' assigned');
    res.json({ assigned, regularMinInvoices: REGULAR_MIN_INVOICES, groups: out });
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
