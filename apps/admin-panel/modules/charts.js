// The numbers behind the Dashboard charts (owner only): team performance, new customers, the request funnel, invoice ageing.
'use strict';
const { addDays, istDate } = require('../lib/util');

module.exports = function charts(app, ctx) {
  const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => res.status(500).json({ error: err.message }));

  app.get('/api/dashboard-charts', ctx.requireAdmin, wrap(async (req, res) => {
    const today = ctx.todayIST(); const people = ctx.employees();
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));

    // 1. team performance: % of each day's daily tasks that was done (null when nothing was assigned)
    const performance = {
      days, people: people.map((u) => ({ id: u.id, name: u.name, values: days.map((d) => {
        let done = 0; let total = 0;
        for (const t of ctx.col('tasks').filter((x) => x.userId === u.id && x.schedule === 'daily' && x.date === d)) { const n = ctx.tasks.units(t); done += n.done; total += n.total; }
        return total ? Math.round(Math.min(done, total) / total * 100) : null;
      }) })),
    };

    // 2. new customers per month, last 6 months, per person, with the monthly target
    const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1 - (5 - i), 1)); return d.toISOString().slice(0, 7); });
    const nc = await ctx.newCustomers.compute();
    const newCustomers = { months, people: people.map((u) => ({ id: u.id, name: u.name, target: Number.isFinite(u.newCustomerTarget) ? u.newCustomerTarget : null,
      values: months.map((m) => nc.list.filter((c) => !c.skip && c.userId === u.id && c.soldDate.slice(0, 7) === m).length) })), zohoChecked: nc.zohoChecked };

    // 3. request funnel: how many requests reached each step, and the average time from the step before
    const reqs = ctx.requests.list(); const cutoff = addDays(today, -90);
    const recent = reqs.filter((r) => istDate(r.createdAt) >= cutoff || ctx.requests.STEPS.some((s) => !r.steps[s.key]));
    const funnel = ctx.requests.STEPS.map((s, i) => {
      const reached = recent.filter((r) => r.steps[s.key]);
      const gaps = reached.map((r) => new Date(r.steps[s.key].at) - new Date(i ? (r.steps[ctx.requests.STEPS[i - 1].key] || { at: r.createdAt }).at : r.createdAt)).filter((g) => g >= 0);
      return { key: s.key, label: s.label, count: reached.length, avgHours: gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length / 360000) / 10 : null };
    });

    // 4. unpaid invoices by how late they are (Zoho Books, read only)
    let invoices = { error: '', buckets: [], total: 0, count: 0 };
    try {
      const list = await ctx.invoicesData(false);
      const defs = [['Not due yet', (i) => i.daysOverdue === 0], ['1 to 30 days late', (i) => i.daysOverdue >= 1 && i.daysOverdue <= 30], ['31 to 60 days late', (i) => i.daysOverdue >= 31 && i.daysOverdue <= 60], ['Over 60 days late', (i) => i.daysOverdue > 60]];
      invoices.buckets = defs.map(([label, f]) => { const m = list.filter(f); return { label, count: m.length, amount: Math.round(m.reduce((s, i) => s + i.balance, 0)) }; });
      invoices.total = invoices.buckets.reduce((s, b) => s + b.amount, 0); invoices.count = list.length;
    } catch (e) { invoices.error = e.message; }

    res.json({ today, performance, newCustomers, funnel, invoices });
  }));
};
