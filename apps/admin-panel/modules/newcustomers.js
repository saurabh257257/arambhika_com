// New customers sold: for each team member, how many brand-new customers they brought in.
// A customer counts once: when their first request is delivered (step 6), for the owner of that request.
// "New" means no earlier invoice for them in Zoho Books (if Zoho is connected) and not marked "not new" by the owner.
// Customers are matched by phone number (last 10 digits), or by name and company when there is no phone.
'use strict';
const { istDate, weekStart, str } = require('../lib/util');

const digits = (s) => String(s || '').replace(/\D/g, '');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const keyOf = (r) => (digits(r.phone).length >= 7 ? 'p' + digits(r.phone).slice(-10) : 'n' + norm(r.customerName) + '|' + norm(r.company));

module.exports = function newCustomers(app, ctx) {
  const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => res.status(500).json({ error: err.message }));

  // every customer whose first delivered request exists, with why they are or are not counted
  async function compute() {
    let invoices = []; let zohoChecked = false; let zohoError = '';
    if (ctx.zoho.configured) { try { invoices = await ctx.zoho.invoices({}); zohoChecked = true; } catch (e) { zohoError = e.message; } }
    const firstInvoice = new Map(); // customer key -> date of their earliest invoice
    for (const i of invoices) {
      if (!i.date) continue;
      for (const k of [digits(i.phone).length >= 7 ? 'p' + digits(i.phone).slice(-10) : '', 'n' + norm(i.customerName) + '|']) {
        if (k && k !== 'n|' && (!firstInvoice.has(k) || i.date < firstInvoice.get(k))) firstInvoice.set(k, i.date);
      }
    }
    const groups = new Map();
    for (const r of ctx.requests.list()) { const k = keyOf(r); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
    const out = [];
    for (const [key, reqs] of groups) {
      const delivered = reqs.filter((r) => r.steps.done).sort((a, b) => a.steps.done.at.localeCompare(b.steps.done.at));
      if (!delivered.length) continue;
      const sold = delivered[0];
      const firstAsked = istDate(reqs.map((r) => r.createdAt).sort()[0]);
      const before = [key, 'n' + norm(sold.customerName) + '|'].map((k) => firstInvoice.get(k)).filter(Boolean).sort()[0];
      const userId = sold.creditTo || sold.ownerId;
      let skip = '';
      if (reqs.some((r) => r.notNew)) skip = 'Marked as not new by you';
      else if (before && before < firstAsked) skip = 'Already a customer in Zoho (invoice dated ' + before + ')';
      out.push({ key, requestId: sold.id, customerName: sold.customerName, company: sold.company, phone: sold.phone, source: sold.source, amount: sold.amount || 0,
        soldAt: sold.steps.done.at, soldDate: istDate(sold.steps.done.at), userId, userName: ctx.userName(userId), skip, requests: reqs.length });
    }
    return { list: out, zohoChecked, zohoError };
  }

  ctx.newCustomers = { compute };

  app.get('/api/new-customers', wrap(async (req, res) => {
    const today = ctx.todayIST();
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : today.slice(0, 7);
    const { list, zohoChecked, zohoError } = await compute();
    const isAdmin = req.user.role === 'admin';
    const people = (isAdmin ? ctx.employees() : ctx.employees().filter((u) => u.id === req.user.id));
    const counted = list.filter((c) => !c.skip && people.some((p) => p.id === c.userId));
    const wk = weekStart(today);
    const rows = (c) => c.soldDate.slice(0, 7) === month;
    res.json({
      month, today, zohoChecked, zohoError,
      people: people.map((u) => {
        const mine = counted.filter((c) => c.userId === u.id);
        return { id: u.id, name: u.name, target: Number.isFinite(u.newCustomerTarget) ? u.newCustomerTarget : null,
          month: mine.filter(rows).length, week: mine.filter((c) => c.soldDate >= wk).length, today: mine.filter((c) => c.soldDate === today).length, allTime: mine.length };
      }),
      customers: counted.filter(rows).sort((a, b) => b.soldAt.localeCompare(a.soldAt)),
      skipped: isAdmin ? list.filter((c) => c.skip && rows(c)).sort((a, b) => b.soldAt.localeCompare(a.soldAt)) : [],
    });
  }));

  // the owner's correction: "not a new customer", or give the credit to the other person
  app.post('/api/new-customers/:requestId/override', ctx.requireAdmin, (req, res) => {
    const r = ctx.requests.list().find((x) => x.id === req.params.requestId);
    if (!r) return res.status(404).json({ error: 'Not found' });
    const b = req.body || {};
    const set = (k, v) => { for (const x of ctx.requests.list()) if (keyOf(x) === keyOf(r)) x[k] = v; };
    if (b.notNew !== undefined) set('notNew', Boolean(b.notNew));
    if (b.creditTo !== undefined) {
      const id = str(b.creditTo, 60);
      if (id && !ctx.employees().some((u) => u.id === id)) return res.status(400).json({ error: 'Choose a team member' });
      set('creditTo', id);
    }
    ctx.save('requests');
    ctx.log(req.user, 'Changed the new-customer count for ' + r.customerName);
    res.json({ ok: true });
  });
};
