// Office: an employee records a transaction (expense, money received, purchase) and sends it to the owner for approval.
'use strict';
const { str, text, uid, nowISO, isDate } = require('../lib/util');

const TYPES = ['expense', 'income', 'purchase', 'other'];

module.exports = function office(app, ctx) {
  const txs = () => ctx.col('transactions');

  app.get('/api/transactions', (req, res) => {
    let list = txs();
    if (req.user.role !== 'admin') list = list.filter((t) => t.userId === req.user.id);
    else if (req.query.userId) list = list.filter((t) => t.userId === req.query.userId);
    if (['pending', 'approved', 'rejected'].includes(req.query.status)) list = list.filter((t) => t.status === req.query.status);
    res.json({ transactions: [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 500).map((t) => ({ ...t, userName: ctx.userName(t.userId) })) });
  });

  function read(req) {
    const date = req.body.date || ctx.todayIST();
    if (!isDate(date)) return { error: 'Bad date' };
    if (date > ctx.todayIST()) return { error: 'The date cannot be in the future' };
    const amount = Math.round(Number(req.body.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) return { error: 'Enter the amount (more than 0)' };
    const type = TYPES.includes(req.body.type) ? req.body.type : 'expense';
    const party = str(req.body.party, 100);
    if (!party) return { error: 'Who was it paid to, or received from?' };
    return { value: { date, amount, type, party, description: text(req.body.description, 1000) } };
  }

  app.post('/api/transactions', (req, res) => {
    if (req.user.role !== 'employee') return res.status(403).json({ error: 'Team members add transactions' });
    const r = read(req); if (r.error) return res.status(400).json({ error: r.error });
    const t = { id: uid(), userId: req.user.id, ...r.value, status: 'pending', remark: '', decidedAt: '', createdAt: nowISO() };
    txs().push(t); ctx.save('transactions');
    ctx.log(req.user, 'Sent a transaction for approval: ' + t.party + ', Rs ' + t.amount);
    res.json({ transaction: t });
  });
  app.put('/api/transactions/:id', (req, res) => {
    const t = txs().find((x) => x.id === req.params.id && x.userId === req.user.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    if (t.status !== 'pending') return res.status(400).json({ error: 'Only a transaction waiting for approval can be changed' });
    const r = read(req); if (r.error) return res.status(400).json({ error: r.error });
    Object.assign(t, r.value); ctx.save('transactions');
    res.json({ transaction: t });
  });
  app.delete('/api/transactions/:id', (req, res) => {
    const list = txs(); const at = list.findIndex((x) => x.id === req.params.id && x.userId === req.user.id);
    if (at < 0) return res.status(404).json({ error: 'Not found' });
    if (list[at].status !== 'pending') return res.status(400).json({ error: 'Only a transaction waiting for approval can be removed' });
    list.splice(at, 1); ctx.save('transactions');
    res.json({ ok: true });
  });
  app.post('/api/transactions/:id/decision', ctx.requireAdmin, (req, res) => {
    const t = txs().find((x) => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    const status = req.body && req.body.status;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Approve or reject' });
    t.status = status; t.remark = text(req.body.remark, 500); t.decidedAt = nowISO();
    ctx.save('transactions');
    ctx.log(req.user, (status === 'approved' ? 'Approved' : 'Rejected') + ' Rs ' + t.amount + ' (' + t.party + ') from ' + ctx.userName(t.userId));
    res.json({ transaction: t });
  });
};
