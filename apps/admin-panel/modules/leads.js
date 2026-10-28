// Leads: a new enquiry lands here with no owner; one team member picks it (or the owner assigns it), follows it up,
// and when it turns into an order it moves on to the Orders pipeline.
'use strict';
const { str, text, uid, nowISO, PHONE_RE } = require('../lib/util');
const { applyFollowup, followStatus } = require('../lib/followups');

const STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'];

module.exports = function leads(app, ctx) {
  const list = () => ctx.col('leads');
  const logs = () => ctx.col('followups');
  const closed = (l) => l.status === 'won' || l.status === 'lost';

  const view = (l, today) => ({ ...l, ownerName: ctx.userName(l.ownerId), followStatus: closed(l) ? 'closed' : (l.status === 'new' && !l.lastAt ? 'new' : followStatus(l.nextDate, today)) });
  // things the person still has to do: never contacted, or the follow-up date has come
  ctx.leadNeedsAction = (l, today) => !closed(l) && ((l.status === 'new' && !l.lastAt) || (l.nextDate && l.nextDate <= today));

  function readFields(b, existing = {}) {
    const name = str(b.name !== undefined ? b.name : existing.name, 80);
    if (!name) return { error: 'Enter the name or company' };
    const phone = str(b.phone !== undefined ? b.phone : existing.phone, 20);
    if (phone && !PHONE_RE.test(phone)) return { error: 'That phone number does not look right' };
    return { value: { name, phone, email: str(b.email !== undefined ? b.email : existing.email, 80), company: str(b.company !== undefined ? b.company : existing.company, 80), source: str(b.source !== undefined ? b.source : existing.source, 40), need: text(b.need !== undefined ? b.need : existing.need, 500) } };
  }

  app.get('/api/leads', (req, res) => {
    const today = ctx.todayIST();
    let rows = list();
    if (req.user.role !== 'admin') rows = rows.filter((l) => !l.ownerId || l.ownerId === req.user.id);
    if (req.query.filter === 'unassigned') rows = rows.filter((l) => !l.ownerId);
    if (req.query.filter === 'mine') rows = rows.filter((l) => l.ownerId === req.user.id);
    if (STATUSES.includes(req.query.status)) rows = rows.filter((l) => l.status === req.query.status);
    if (req.user.role === 'admin' && req.query.userId) rows = rows.filter((l) => l.ownerId === req.query.userId);
    const order = { new: 0, overdue: 1, due: 2, none: 3, ok: 4, closed: 5 };
    const out = rows.map((l) => view(l, today)).sort((a, b) => (order[a.followStatus] - order[b.followStatus]) || b.createdAt.localeCompare(a.createdAt));
    res.json({ leads: out, statuses: STATUSES, outcomes: ctx.cadence().lead });
  });

  app.post('/api/leads', (req, res) => {
    const r = readFields(req.body || {}); if (r.error) return res.status(400).json({ error: r.error });
    let ownerId = '';
    if (req.user.role === 'employee') ownerId = req.user.id; // a lead you add yourself is yours
    else if (req.body.ownerId) { if (!ctx.employees().some((u) => u.id === req.body.ownerId)) return res.status(400).json({ error: 'Choose a team member' }); ownerId = req.body.ownerId; }
    const at = nowISO();
    const l = { id: uid(), ...r.value, ownerId, status: 'new', nextDate: '', lastAt: '', lastBy: '', lastByName: '', lastOutcome: '', lastNote: '', createdAt: at, createdByName: req.user.name, updatedAt: at, pickedAt: ownerId ? at : '' };
    list().push(l); ctx.save('leads');
    ctx.log(req.user, 'Added lead ' + l.name + (ownerId ? ' (owner: ' + ctx.userName(ownerId) + ')' : ' (waiting to be picked)'));
    res.json({ lead: view(l, ctx.todayIST()) });
  });

  app.post('/api/leads/:id/pick', (req, res) => {
    if (req.user.role !== 'employee') return res.status(403).json({ error: 'Team members pick leads; the owner assigns them' });
    const l = list().find((x) => x.id === req.params.id);
    if (!l) return res.status(404).json({ error: 'Lead not found' });
    if (l.ownerId) return res.status(400).json({ error: l.ownerId === req.user.id ? 'You already picked this lead' : ctx.userName(l.ownerId) + ' already picked this lead' });
    l.ownerId = req.user.id; l.pickedAt = nowISO(); l.updatedAt = l.pickedAt;
    ctx.save('leads');
    ctx.log(req.user, 'Picked lead ' + l.name);
    res.json({ lead: view(l, ctx.todayIST()) });
  });

  app.post('/api/leads/:id/assign', ctx.requireAdmin, (req, res) => {
    const l = list().find((x) => x.id === req.params.id);
    if (!l) return res.status(404).json({ error: 'Lead not found' });
    const to = req.body.ownerId || '';
    if (to && !ctx.employees().some((u) => u.id === to)) return res.status(400).json({ error: 'Choose a team member' });
    l.ownerId = to; l.pickedAt = to ? nowISO() : ''; l.updatedAt = nowISO();
    ctx.save('leads');
    ctx.log(req.user, 'Assigned lead ' + l.name + ' to ' + (to ? ctx.userName(to) : 'nobody'));
    res.json({ lead: view(l, ctx.todayIST()) });
  });

  app.patch('/api/leads/:id', (req, res) => {
    const l = list().find((x) => x.id === req.params.id && (req.user.role === 'admin' || x.ownerId === req.user.id));
    if (!l) return res.status(404).json({ error: 'Lead not found' });
    const r = readFields(req.body || {}, l); if (r.error) return res.status(400).json({ error: r.error });
    Object.assign(l, r.value); l.updatedAt = nowISO();
    ctx.save('leads');
    res.json({ lead: view(l, ctx.todayIST()) });
  });

  app.post('/api/leads/:id/followup', (req, res) => {
    const l = list().find((x) => x.id === req.params.id && x.ownerId === req.user.id);
    if (!l) return res.status(404).json({ error: 'Only the person who picked this lead can log a follow-up' });
    try {
      const entry = applyFollowup(l, { user: req.user, kind: 'lead', label: l.name, refId: l.id, outcome: req.body.outcome, note: req.body.note, nextDate: req.body.nextDate, cadence: ctx.cadence(), today: ctx.todayIST() });
      logs().push(entry); ctx.save('followups'); ctx.save('leads');
      ctx.log(req.user, 'Lead ' + l.name + ': ' + entry.outcomeLabel + (entry.nextDate ? ', next on ' + entry.nextDate : ''));
      res.json({ lead: view(l, ctx.todayIST()) });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.get('/api/leads/:id/history', (req, res) => {
    const l = list().find((x) => x.id === req.params.id && (req.user.role === 'admin' || !x.ownerId || x.ownerId === req.user.id));
    if (!l) return res.status(404).json({ error: 'Lead not found' });
    res.json({ history: logs().filter((e) => e.kind === 'lead' && e.refId === l.id).sort((a, b) => b.at.localeCompare(a.at)) });
  });

  // a lead that is going to buy becomes an order in the pipeline
  app.post('/api/leads/:id/order', (req, res) => {
    const l = list().find((x) => x.id === req.params.id && (req.user.role === 'admin' || x.ownerId === req.user.id));
    if (!l) return res.status(404).json({ error: 'Lead not found' });
    const order = ctx.orders.create({ user: req.user, customerName: l.name, phone: l.phone, amount: req.body.amount, note: l.need, ownerId: l.ownerId, leadId: l.id });
    if (order.error) return res.status(400).json({ error: order.error });
    l.status = 'won'; l.nextDate = ''; l.updatedAt = nowISO(); ctx.save('leads');
    res.json({ order: order.value });
  });

  ctx.leads = { list, closed };
};
