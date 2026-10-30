// Follow up with existing customers: a daily list for each team member.
//   - 3 customers a day (the number is a setting), taken from the customers that belong to that person
//   - only customers who have bought before but have NOT ordered in the last 30 days (also a setting)
//   - each comes with what they bought and at what price, written as a note
//   - the person logs what happened and the next follow-up date
//   - a customer who was not called today comes back tomorrow, ahead of new ones (the list stays at 3)
// The customers come from customers.json (the customer master list), so this needs the master list to have read Zoho.
'use strict';
const { addDays, nowISO, istDate, str, text, uid, isDate, diffDays } = require('../lib/util');

const DEFAULTS = { perDay: 3, minDays: 30 };
const FETCH_INVOICES = 3; // how many of a customer's latest invoices are opened to read the items and prices

module.exports = function custfollow(app, ctx) {
  const lists = () => ctx.col('custfollow');
  const cfg = () => { const s = ctx.settings().custFollow || {}; return { perDay: Number.isInteger(s.perDay) && s.perDay >= 1 ? s.perDay : DEFAULTS.perDay, minDays: Number.isInteger(s.minDays) && s.minDays >= 1 ? s.minDays : DEFAULTS.minDays }; };
  const money = (n) => 'Rs ' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const dmy = (d) => (d ? d.slice(8, 10) + '-' + d.slice(5, 7) + '-' + d.slice(0, 4) : '');
  const locks = new Map();

  async function lineItems(invoiceId) {
    const cache = ctx.col('invoicelines');
    const hit = cache.find((c) => c.id === invoiceId);
    if (hit) return hit.items;
    if (!ctx.zoho.invoiceLines) return null;
    try { const items = await ctx.zoho.invoiceLines(invoiceId); cache.push({ id: invoiceId, items }); ctx.save('invoicelines'); return items; } catch (e) { return null; }
  }

  // what a customer bought, newest first, with the price of each item: the note the team member reads before calling
  async function historyOf(rec) {
    const inv = rec.invoices.filter((i) => !['void', 'draft'].includes(i.status)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    const history = [];
    for (let n = 0; n < inv.length; n += 1) {
      const i = inv[n];
      const items = n < FETCH_INVOICES ? await lineItems(i.id) : null;
      history.push({ date: i.date, number: i.number, total: i.total, status: i.status, items: items || [] });
    }
    return history;
  }
  const noteOf = (history) => (history.length ? history.map((h) => dmy(h.date) + '  ' + h.number + '  ' + money(h.total) + (h.status === 'paid' ? '' : ' (' + h.status + ')') +
    (h.items.length ? '\n' + h.items.map((l) => '   - ' + l.quantity + ' x ' + l.name + ' @ ' + money(l.rate) + ' = ' + money(l.total)).join('\n') : '')).join('\n') : 'No purchases found.');

  // customers that belong to this person, who bought before, and whose last order is older than the limit
  function candidates(userId, today, taken, c) {
    const states = ctx.col('customerstate'); const st = (id) => states.find((s) => s.id === id) || {};
    const blocked = new Map(); // customers called recently: not offered again before the follow-up date they were given
    for (const e of lists()) for (const r of e.rows) if (r.calledAt) { const until = r.followUpDate || addDays(istDate(r.calledAt), 30); if (!blocked.has(r.customerId) || blocked.get(r.customerId) < until) blocked.set(r.customerId, until); }
    return ctx.col('customers').filter((r) => r.stage === 'customer' && r.zohoId && st(r.zohoId).ownerId === userId && !st(r.zohoId).excluded && !taken.has(r.zohoId) && !((blocked.get(r.zohoId) || '') > today))
      .map((r) => {
        const inv = r.invoices.filter((i) => !['void', 'draft'].includes(i.status));
        const dates = inv.map((i) => i.date).concat(r.orders.map((o) => o.date)).filter(Boolean).sort();
        return { r, bought: inv.length, last: dates[dates.length - 1] || '' };
      })
      .filter((x) => x.bought > 0 && x.last && diffDays(today, x.last) >= c.minDays)
      .sort((a, b) => b.r.totals.billed - a.r.totals.billed);
  }

  async function build(userId, today, entry) {
    const c = cfg(); const L = lists();
    const prev = L.filter((e) => e.userId === userId && e.date < today).sort((a, b) => a.date.localeCompare(b.date)).pop();
    const rows = prev ? prev.rows.filter((r) => !r.calledAt).map((r) => ({ ...r, id: uid(), rolledFrom: r.rolledFrom || prev.date })) : []; // not called yesterday: they come first today
    const taken = new Set(rows.map((r) => r.customerId));
    for (const x of candidates(userId, today, taken, c).slice(0, Math.max(0, c.perDay - rows.length))) {
      const history = await historyOf(x.r);
      rows.push({ id: uid(), customerId: x.r.zohoId, name: x.r.name, phone: x.r.phone, company: x.r.company, lastPurchaseOn: x.last, daysSince: diffDays(today, x.last), billed: x.r.totals.billed,
        history, note: noteOf(history), rolledFrom: '', outcome: '', outcomeLabel: '', followUpDate: '', callNote: '', calledAt: '', calledByName: '' });
    }
    if (!entry) { entry = { id: uid(), userId, date: today, createdAt: nowISO(), rows }; L.push(entry); } else entry.rows = rows;
    ctx.save('custfollow');
    return entry;
  }

  // today's list for one person: made the first time it is asked for, and again while it is still empty (the customer data may not have been ready)
  function today(userId) {
    const day = ctx.todayIST();
    if (!ctx.tasks.isWorkDay(day)) return Promise.resolve({ rows: [], date: day });
    const key = userId + day;
    if (locks.has(key)) return locks.get(key);
    const p = (async () => {
      const entry = lists().find((e) => e.userId === userId && e.date === day);
      if (entry && entry.rows.length) return entry;
      return build(userId, day, entry);
    })().finally(() => locks.delete(key));
    locks.set(key, p);
    return p;
  }
  const summary = (entry, day) => ({ total: entry.rows.length, done: entry.rows.filter((r) => r.calledAt && istDate(r.calledAt) === day).length });
  ctx.custFollow = { today, summary, cfg };

  const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => res.status(500).json({ error: err.message }));

  app.get('/api/cust-followups', wrap(async (req, res) => {
    let userId = req.user.id;
    if (req.user.role === 'admin') { userId = String(req.query.userId || ''); if (!userId) return res.status(400).json({ error: 'Choose a team member' }); }
    const day = ctx.todayIST(); const entry = await today(userId);
    res.json({ date: day, ...cfg(), workDay: ctx.tasks.isWorkDay(day), rows: entry.rows, summary: summary(entry, day), outcomes: ctx.cadence().customer });
  }));

  // log the call: what happened, a note, and when to follow up next (suggested from the rules, editable)
  app.post('/api/cust-followups/:id/call', wrap(async (req, res) => {
    const day = ctx.todayIST();
    const entry = lists().find((e) => e.userId === req.user.id && e.date === day);
    const row = entry && entry.rows.find((r) => r.id === req.params.id);
    if (!row) return res.status(404).json({ error: 'That customer is not on your list today' });
    if (row.calledAt) return res.status(400).json({ error: 'You already logged this call' });
    const rule = ctx.cadence().customer.find((o) => o.key === (req.body && req.body.outcome));
    if (!rule) return res.status(400).json({ error: 'Choose what happened' });
    let next = req.body.nextDate ? String(req.body.nextDate) : '';
    if (next && (!isDate(next) || next <= day)) return res.status(400).json({ error: 'The next follow-up must be a date after today' });
    if (!next && rule.days) next = addDays(day, rule.days);
    if (!next && rule.askDate) return res.status(400).json({ error: 'Pick the follow-up date' });
    Object.assign(row, { outcome: rule.key, outcomeLabel: rule.label, followUpDate: next, callNote: text(req.body.note, 1000), calledAt: nowISO(), calledByName: req.user.name });
    ctx.save('custfollow');
    ctx.log(req.user, 'Customer follow-up: ' + row.name + ' (' + rule.label + (next ? ', next ' + next : '') + ')');
    res.json({ ok: true, row, summary: summary(entry, day) });
  }));
};
