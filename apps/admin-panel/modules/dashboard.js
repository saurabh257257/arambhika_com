// Progress and dashboards.
//
// "Today's work" for one person is the sum of these, and the percentage is simply done / total:
//   Tasks              every row, step or target of today's tasks (including what was carried forward from earlier)
//   Call follow-ups    call rows whose follow-up date has come, counted as done once the follow-up is logged
//   Customer follow-ups / Invoice follow-ups    from Zoho: the ones due today (plus up to 10 customers never called yet)
//   Customer requests  every request that is not finished yet (plus ones finished today); done = touched today
// On a day off nothing is expected, so only the things actually done count.
'use strict';
const { istDate } = require('../lib/util');
const { followStatus } = require('../lib/followups');

const NEW_CUSTOMERS_PER_DAY = 10;

module.exports = function dashboard(app, ctx) {
  const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => res.status(500).json({ error: err.message }));
  const pct = (done, total) => (total ? Math.round(Math.min(done, total) / total * 100) : null);

  async function progress(userId, date) {
    const today = ctx.todayIST();
    const out = { date, workDay: ctx.tasks.isWorkDay(date), tasks: { done: 0, total: 0 }, followups: { done: 0, total: 0 }, customers: { done: 0, total: 0 }, invoices: { done: 0, total: 0 }, requests: { done: 0, total: 0 } };
    for (const t of ctx.tasks.forUser(userId, date)) { const u = ctx.tasks.units(t); out.tasks.done += u.done; out.tasks.total += u.total; }
    if (date === today) {
      // call follow-ups
      const due = ctx.tasks.followupsDue(userId).length; const doneF = ctx.tasks.followupsDoneToday(userId);
      out.followups = { done: doneF, total: due + doneF };
      // customers
      let fresh = 0;
      for (const s of ctx.col('customerstate').filter((x) => x.ownerId === userId).sort((a, b) => a.id.localeCompare(b.id))) {
        const doneToday = istDate(s.lastAt) === today;
        const isDue = ['due', 'overdue'].includes(followStatus(s.nextDate, today));
        const isNew = !s.lastAt && !s.nextDate && fresh < NEW_CUSTOMERS_PER_DAY && (fresh += 1);
        if (doneToday) { out.customers.done += 1; out.customers.total += 1; } else if (isDue || isNew) out.customers.total += 1;
      }
      // invoices (only if Zoho answers)
      try {
        for (const i of await ctx.invoicesData(false)) {
          if (i.ownerId !== userId) continue;
          if (i.doneToday) { out.invoices.done += 1; out.invoices.total += 1; } else if (i.needs && ['due', 'overdue'].includes(i.followStatus)) out.invoices.total += 1;
        }
      } catch (e) { out.invoices.error = e.message; }
      // customer requests
      const rq = ctx.requests.stats(userId); out.requests = { done: rq.done, total: rq.total };
      if (!out.workDay) for (const k of ['followups', 'customers', 'invoices', 'requests']) out[k].total = out[k].done; // a day off: only what was actually done counts
    }
    const kinds = ['tasks', 'followups', 'customers', 'invoices', 'requests'];
    const done = kinds.reduce((s, k) => s + out[k].done, 0); const total = kinds.reduce((s, k) => s + out[k].total, 0);
    out.overall = { done, total, percent: pct(done, total), left: Math.max(total - done, 0) };
    return out;
  }
  ctx.progress = progress;

  const lastActivity = (userId) => { const a = ctx.col('activity'); for (let i = a.length - 1; i >= 0; i -= 1) if (a[i].userId === userId) return a[i].at; return ''; };
  const carriedToday = (userId) => ctx.tasks.forUser(userId, ctx.todayIST()).reduce((s, t) => s + (t.carried || 0), 0);

  // ---- a team member's own day ----
  app.get('/api/my-day', wrap(async (req, res) => {
    if (req.user.role !== 'employee') return res.status(403).json({ error: 'This is the team member view' });
    const today = ctx.todayIST();
    const p = await progress(req.user.id, today);
    const tasks = ctx.tasks.forUser(req.user.id, today).map((t) => { const u = ctx.tasks.units(t); return { id: t.id, name: t.name, kind: t.kind, schedule: t.schedule, done: u.done, total: u.total, carried: t.carried || 0, updatedAt: t.updatedAt, dueDate: t.dueDate, completedAt: t.completedAt }; });
    const reqs = ctx.requests.list().filter((r) => r.ownerId === req.user.id).map(ctx.requests.view).filter((r) => !r.complete).sort((a, b) => b.daysSinceTouched - a.daysSinceTouched).slice(0, 8);
    res.json({ progress: p, tasks, followups: ctx.tasks.followupsDue(req.user.id).slice(0, 8), requests: reqs, available: { requests: ctx.requests.list().filter((r) => !r.ownerId).length }, lastActivity: lastActivity(req.user.id) });
  }));

  // ---- the owner's view of everyone ----
  app.get('/api/dashboard', ctx.requireAdmin, wrap(async (req, res) => {
    const today = ctx.todayIST();
    const team = [];
    for (const u of ctx.employees()) {
      const p = await progress(u.id, today);
      const fu = ctx.tasks.followupsDue(u.id); const rq = ctx.requests.stats(u.id);
      team.push({ id: u.id, name: u.name, progress: p, lastActivity: lastActivity(u.id), carried: carriedToday(u.id), followupsOverdue: fu.filter((f) => f.daysLate > 0).length, followupsDue: fu.length,
        openRequests: rq.open, oldestRequestDays: rq.oldestUntouched, untouchedRequests: rq.untouched, pendingTransactions: ctx.col('transactions').filter((t) => t.userId === u.id && t.status === 'pending').length });
    }
    let inv = null; let invError = '';
    try { inv = await ctx.invoicesData(false); } catch (e) { invError = e.message; }
    const needing = inv ? inv.filter((i) => i.needs) : [];
    let cust = { total: 0, unassigned: 0 }; let custError = '';
    try { const d = await ctx.customersData(false); const owned = new Set(ctx.col('customerstate').filter((s) => s.ownerId).map((s) => s.id)); cust = { total: d.list.length, unassigned: d.list.filter((c) => !owned.has(c.id)).length, source: d.source }; } catch (e) { custError = e.message; }
    res.json({
      date: today, workDay: ctx.tasks.isWorkDay(today), team,
      alerts: {
        unassignedRequests: ctx.requests.list().filter((r) => !r.ownerId).length,
        openRequests: ctx.requests.list().filter((r) => ctx.requests.STEPS.some((s) => !r.steps[s.key])).length,
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

  // a team member's history for the owner: day by day, percent of the daily tasks done
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
      out.push({ date: d, tasks: insts.map((t) => { const u = ctx.tasks.units(t); return { id: t.id, name: t.name, done: u.done, total: u.total, carried: t.carried || 0 }; }), done, total, percent: pct(done, total), followups: follow, lastUpdate: last });
    }
    res.json({ days: out });
  }));
};
