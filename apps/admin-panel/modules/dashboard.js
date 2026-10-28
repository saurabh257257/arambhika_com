// Progress and dashboards.
//
// "Today's work" for one person is the sum of three things, and the percentage is simply done / total:
//   Tasks        every row, step or target of the tasks assigned for today
//   Follow-ups   customers and invoices they own whose follow-up is due (plus up to 10 customers never called yet),
//                counted as done once a follow-up is logged today
//   Leads        leads they picked that are new or due for a follow-up
// Orders are not in the percentage: each order shows its own progress through the six stages.
'use strict';
const { istDate } = require('../lib/util');
const { followStatus } = require('../lib/followups');

const NEW_CUSTOMERS_PER_DAY = 10;

module.exports = function dashboard(app, ctx) {
  const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => res.status(500).json({ error: err.message }));
  const pct = (done, total) => (total ? Math.round(Math.min(done, total) / total * 100) : null);

  async function progress(userId, date) {
    const today = ctx.todayIST();
    const out = { date, tasks: { done: 0, total: 0 }, customers: { done: 0, total: 0 }, invoices: { done: 0, total: 0 }, leads: { done: 0, total: 0 } };
    for (const t of ctx.tasks.forUser(userId, date)) { const u = ctx.tasks.units(t); out.tasks.done += u.done; out.tasks.total += u.total; }
    const items = { customers: [], invoices: [], leads: [] };
    if (date === today) {
      // customers
      const cs = ctx.col('customerstate').filter((s) => s.ownerId === userId);
      let fresh = 0;
      for (const s of cs.sort((a, b) => a.id.localeCompare(b.id))) {
        const doneToday = istDate(s.lastAt) === today;
        const due = ['due', 'overdue'].includes(followStatus(s.nextDate, today));
        const isNew = !s.lastAt && !s.nextDate && fresh < NEW_CUSTOMERS_PER_DAY && (fresh += 1);
        if (doneToday) { out.customers.done += 1; out.customers.total += 1; }
        else if (due || isNew) { out.customers.total += 1; items.customers.push(s.id); }
      }
      // invoices (only if Zoho answers)
      try {
        for (const i of await ctx.invoicesData(false)) {
          if (i.ownerId !== userId) continue;
          if (i.doneToday) { out.invoices.done += 1; out.invoices.total += 1; }
          else if (i.needs && ['due', 'overdue'].includes(i.followStatus)) { out.invoices.total += 1; items.invoices.push(i.id); }
        }
      } catch (e) { out.invoices.error = e.message; }
      // leads
      for (const l of ctx.leads.list().filter((x) => x.ownerId === userId)) {
        if (istDate(l.lastAt) === today) { out.leads.done += 1; out.leads.total += 1; }
        else if (ctx.leadNeedsAction(l, today)) { out.leads.total += 1; items.leads.push(l.id); }
      }
    }
    const done = out.tasks.done + out.customers.done + out.invoices.done + out.leads.done;
    const total = out.tasks.total + out.customers.total + out.invoices.total + out.leads.total;
    out.overall = { done, total, percent: pct(done, total), left: Math.max(total - done, 0) };
    out.items = items;
    return out;
  }
  ctx.progress = progress;

  const lastActivity = (userId) => { const a = ctx.col('activity'); for (let i = a.length - 1; i >= 0; i -= 1) if (a[i].userId === userId) return a[i].at; return ''; };

  // ---- a team member's own day ----
  app.get('/api/my-day', wrap(async (req, res) => {
    if (req.user.role !== 'employee') return res.status(403).json({ error: 'This is the team member view' });
    const today = ctx.todayIST();
    const p = await progress(req.user.id, today);
    const tasks = ctx.tasks.forUser(req.user.id, today).map((t) => { const u = ctx.tasks.units(t); return { id: t.id, name: t.name, kind: t.kind, done: u.done, total: u.total, updatedAt: t.updatedAt, dueDate: t.dueDate }; });
    res.json({ progress: p, tasks, available: { leads: ctx.leads.list().filter((l) => !l.ownerId).length, orders: ctx.col('orders').filter((o) => !o.ownerId).length }, lastActivity: lastActivity(req.user.id) });
  }));

  // ---- the owner's view of everyone ----
  app.get('/api/dashboard', ctx.requireAdmin, wrap(async (req, res) => {
    const today = ctx.todayIST();
    const team = [];
    for (const u of ctx.employees()) {
      const p = await progress(u.id, today);
      const orders = ctx.col('orders').filter((o) => o.ownerId === u.id);
      team.push({ id: u.id, name: u.name, progress: p, lastActivity: lastActivity(u.id), activeOrders: orders.filter((o) => !ctx.orders.STAGES.every((s) => o.stages[s.key])).length,
        pendingTransactions: ctx.col('transactions').filter((t) => t.userId === u.id && t.status === 'pending').length });
    }
    let inv = null; let invError = '';
    try { inv = await ctx.invoicesData(false); } catch (e) { invError = e.message; }
    const needing = inv ? inv.filter((i) => i.needs) : [];
    let cust = { total: 0, unassigned: 0 }; let custError = '';
    try { const d = await ctx.customersData(false); const owned = new Set(ctx.col('customerstate').filter((s) => s.ownerId).map((s) => s.id)); cust = { total: d.list.length, unassigned: d.list.filter((c) => !owned.has(c.id)).length, source: d.source }; } catch (e) { custError = e.message; }
    res.json({
      date: today, team,
      alerts: {
        unassignedLeads: ctx.leads.list().filter((l) => !l.ownerId).length,
        unassignedOrders: ctx.col('orders').filter((o) => !o.ownerId).length,
        unassignedCustomers: cust.unassigned, totalCustomers: cust.total,
        unassignedInvoices: inv ? inv.filter((i) => !i.ownerId).length : 0,
        invoicesToChase: needing.filter((i) => !i.compliant).length, invoiceCompliance: needing.length ? Math.round(needing.filter((i) => i.compliant).length / needing.length * 100) : 100, unpaidInvoices: inv ? inv.length : 0,
        pendingApprovals: ctx.col('transactions').filter((t) => t.status === 'pending').length,
        notStarted: team.filter((t) => !t.lastActivity || istDate(t.lastActivity) !== today).map((t) => t.name),
      },
      zoho: { ...ctx.zoho.status(), invoiceError: invError, customerError: custError },
    });
  }));

  // ---- Zoho connection ----
  app.get('/api/zoho/status', ctx.requireAdmin, (req, res) => res.json(ctx.zoho.status()));
  app.post('/api/zoho/refresh', ctx.requireAdmin, wrap(async (req, res) => {
    const out = {};
    for (const [k, fn] of [['invoices', () => ctx.zoho.invoices({ refresh: true })], ['customers', () => ctx.zoho.customers({ refresh: true })], ['salesOrders', () => ctx.zoho.salesOrders({ refresh: true })]]) {
      try { const d = await fn(); out[k] = { ok: true, count: Array.isArray(d) ? d.length : (d.list || []).length }; } catch (e) { out[k] = { ok: false, error: e.message }; }
    }
    ctx.log(req.user, 'Refreshed the data from Zoho');
    res.json({ result: out, status: ctx.zoho.status() });
  }));

  // an employee's history for the owner: day by day, percent of the tasks done
  app.get('/api/history', wrap(async (req, res) => {
    let userId = req.user.id;
    if (req.user.role === 'admin') { userId = String(req.query.userId || ''); if (!userId) return res.status(400).json({ error: 'Choose a team member' }); }
    const days = Math.min(Math.max(Number(req.query.days) || 14, 1), 60);
    const today = ctx.todayIST(); const out = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(Date.parse(today + 'T00:00:00Z') - i * 86400000).toISOString().slice(0, 10);
      const insts = ctx.col('tasks').filter((t) => t.userId === userId && t.schedule === 'daily' && t.date === d);
      let done = 0; let total = 0; let last = '';
      for (const t of insts) { const u = ctx.tasks.units(t); done += u.done; total += u.total; if (t.updatedAt > last) last = t.updatedAt; }
      const follow = ctx.col('followups').filter((e) => e.byId === userId && istDate(e.at) === d).length;
      out.push({ date: d, tasks: insts.map((t) => { const u = ctx.tasks.units(t); return { id: t.id, name: t.name, done: u.done, total: u.total }; }), done, total, percent: pct(done, total), followups: follow, lastUpdate: last });
    }
    res.json({ days: out });
  }));
};
