// Orders pipeline: Lead received > Quotation created > Invoice created > Payment received > Item dispatched > Item delivered.
// Every order has one owner (whoever picked it) and every stage is ticked with a time and a name.
// New website orders appear by themselves from Zoho Books sales orders, and their invoice / payment / dispatch / delivery
// stages are ticked from what Zoho says. Quotations and anything else are ticked by hand.
'use strict';
const { str, text, uid, nowISO, PHONE_RE, diffDays } = require('../lib/util');

const STAGES = [
  { key: 'lead', label: 'Lead received' },
  { key: 'quotation', label: 'Quotation created' },
  { key: 'invoice', label: 'Invoice created' },
  { key: 'payment', label: 'Payment received' },
  { key: 'dispatched', label: 'Item dispatched' },
  { key: 'delivered', label: 'Item delivered' },
];
const RECENT_DAYS = 60;

module.exports = function orders(app, ctx) {
  const list = () => ctx.col('orders');

  function view(o) {
    const done = STAGES.filter((s) => o.stages[s.key]).length;
    const next = STAGES.find((s) => !o.stages[s.key]);
    return { ...o, ownerName: ctx.userName(o.ownerId), progress: { done, total: STAGES.length, percent: Math.round(done / STAGES.length * 100) }, nextStage: next ? next.label : 'Complete', complete: !next };
  }

  function create({ user, customerName, phone, amount, note, ownerId, leadId, source, zoho }) {
    const name = str(customerName, 100);
    if (!name) return { error: 'Enter the customer name' };
    const ph = str(phone, 20);
    if (ph && !PHONE_RE.test(ph)) return { error: 'That phone number does not look right' };
    const amt = amount === undefined || amount === '' || amount === null ? 0 : Math.round(Number(amount) * 100) / 100;
    if (!Number.isFinite(amt) || amt < 0 || amt > 1e9) return { error: 'Amount must be a number' };
    const at = (zoho && zoho.at) || nowISO();
    const o = { id: uid(), customerName: name, phone: ph, amount: amt, note: text(note, 1000), ownerId: ownerId || '', pickedAt: ownerId ? nowISO() : '', source: source || (leadId ? 'lead' : 'manual'), leadId: leadId || '', zohoSoId: zoho ? zoho.id : '', zohoSoNumber: zoho ? zoho.number : '', stages: { lead: { at, by: zoho ? 'Zoho' : (user ? user.name : '') } }, createdAt: nowISO(), createdByName: zoho ? 'Zoho' : (user ? user.name : ''), updatedAt: nowISO(), updatedByName: user ? user.name : '' };
    list().push(o); ctx.save('orders');
    if (user) ctx.log(user, 'Added order for ' + name + (o.ownerId ? ' (owner: ' + ctx.userName(o.ownerId) + ')' : ' (waiting to be picked)'));
    return { value: view(o) };
  }
  ctx.orders = { create, list, STAGES };

  // ---- pull new sales orders and their progress from Zoho ----
  let lastSyncError = '';
  async function syncFromZoho(refresh) {
    if (!ctx.zoho.configured) return { ok: false, error: 'Zoho is not connected to this panel yet' };
    try {
      const sos = await ctx.zoho.salesOrders({ refresh });
      const today = ctx.todayIST();
      const rows = list();
      let changed = false;
      for (const so of sos) {
        let o = rows.find((x) => x.zohoSoId === so.id);
        if (!o) {
          if (!so.date || diffDays(today, so.date) > RECENT_DAYS || so.status === 'void') continue;
          const r = create({ user: null, customerName: so.customerName, amount: so.total, note: 'Sales order ' + so.number + ' from Zoho', source: 'zoho', zoho: { id: so.id, number: so.number, at: so.createdTime ? new Date(so.createdTime).toISOString() : nowISO() } });
          if (r.error) continue;
          o = rows.find((x) => x.zohoSoId === so.id); changed = true;
        }
        const tick = (key, yes) => { if (yes && !o.stages[key]) { o.stages[key] = { at: nowISO(), by: 'Zoho' }; o.updatedAt = nowISO(); changed = true; } };
        tick('invoice', so.invoiced === 'invoiced' || so.invoiced === 'partially_invoiced');
        tick('payment', so.paid === 'paid');
        tick('dispatched', ['shipped', 'fulfilled', 'delivered', 'partially_shipped'].includes(so.shipped));
        tick('delivered', ['fulfilled', 'delivered'].includes(so.shipped));
      }
      if (changed) ctx.save('orders');
      lastSyncError = '';
      return { ok: true };
    } catch (err) { lastSyncError = err.message; return { ok: false, error: err.message }; }
  }

  app.get('/api/orders', async (req, res) => {
    const zoho = await syncFromZoho(req.query.refresh === '1');
    let rows = list();
    if (req.user.role !== 'admin') rows = rows.filter((o) => !o.ownerId || o.ownerId === req.user.id);
    if (req.query.filter === 'unassigned') rows = rows.filter((o) => !o.ownerId);
    if (req.query.filter === 'mine') rows = rows.filter((o) => o.ownerId === req.user.id);
    if (req.user.role === 'admin' && req.query.userId) rows = rows.filter((o) => o.ownerId === req.query.userId);
    const out = rows.map(view);
    const active = req.query.filter === 'all' ? out : out.filter((o) => !o.complete);
    active.sort((a, b) => (a.ownerId ? 1 : 0) - (b.ownerId ? 1 : 0) || b.createdAt.localeCompare(a.createdAt));
    res.json({ orders: active.slice(0, 300), stages: STAGES, zoho });
  });

  app.post('/api/orders', (req, res) => {
    let ownerId = '';
    if (req.user.role === 'employee') ownerId = req.user.id;
    else if (req.body.ownerId) { if (!ctx.employees().some((u) => u.id === req.body.ownerId)) return res.status(400).json({ error: 'Choose a team member' }); ownerId = req.body.ownerId; }
    const r = create({ user: req.user, customerName: req.body.customerName, phone: req.body.phone, amount: req.body.amount, note: req.body.note, ownerId });
    if (r.error) return res.status(400).json({ error: r.error });
    res.json({ order: r.value });
  });

  app.post('/api/orders/:id/pick', (req, res) => {
    if (req.user.role !== 'employee') return res.status(403).json({ error: 'Team members pick orders; the owner assigns them' });
    const o = list().find((x) => x.id === req.params.id);
    if (!o) return res.status(404).json({ error: 'Order not found' });
    if (o.ownerId) return res.status(400).json({ error: o.ownerId === req.user.id ? 'You already picked this order' : ctx.userName(o.ownerId) + ' already picked this order' });
    o.ownerId = req.user.id; o.pickedAt = nowISO(); o.updatedAt = o.pickedAt; o.updatedByName = req.user.name;
    ctx.save('orders');
    ctx.log(req.user, 'Picked the order for ' + o.customerName);
    res.json({ order: view(o) });
  });

  app.post('/api/orders/:id/assign', ctx.requireAdmin, (req, res) => {
    const o = list().find((x) => x.id === req.params.id);
    if (!o) return res.status(404).json({ error: 'Order not found' });
    const to = req.body.ownerId || '';
    if (to && !ctx.employees().some((u) => u.id === to)) return res.status(400).json({ error: 'Choose a team member' });
    o.ownerId = to; o.pickedAt = to ? nowISO() : ''; o.updatedAt = nowISO(); o.updatedByName = req.user.name;
    ctx.save('orders');
    ctx.log(req.user, 'Assigned the order for ' + o.customerName + ' to ' + (to ? ctx.userName(to) : 'nobody'));
    res.json({ order: view(o) });
  });

  // tick or untick a stage; the time and the person are written next to it
  app.put('/api/orders/:id/stages/:stage', (req, res) => {
    const o = list().find((x) => x.id === req.params.id && (req.user.role === 'admin' || x.ownerId === req.user.id));
    if (!o) return res.status(404).json({ error: 'Only the person who picked this order can update it' });
    const stage = STAGES.find((s) => s.key === req.params.stage);
    if (!stage) return res.status(400).json({ error: 'Unknown stage' });
    if (req.body.done) o.stages[stage.key] = { at: nowISO(), by: req.user.name }; else delete o.stages[stage.key];
    o.updatedAt = nowISO(); o.updatedByName = req.user.name;
    ctx.save('orders');
    ctx.log(req.user, (req.body.done ? 'Ticked "' : 'Unticked "') + stage.label + '" for ' + o.customerName);
    res.json({ order: view(o) });
  });

  app.patch('/api/orders/:id', (req, res) => {
    const o = list().find((x) => x.id === req.params.id && (req.user.role === 'admin' || x.ownerId === req.user.id));
    if (!o) return res.status(404).json({ error: 'Order not found' });
    if (req.body.note !== undefined) o.note = text(req.body.note, 1000);
    if (req.body.amount !== undefined) { const a = Number(req.body.amount); if (!Number.isFinite(a) || a < 0 || a > 1e9) return res.status(400).json({ error: 'Amount must be a number' }); o.amount = Math.round(a * 100) / 100; }
    if (req.body.phone !== undefined) { const p = str(req.body.phone, 20); if (p && !PHONE_RE.test(p)) return res.status(400).json({ error: 'That phone number does not look right' }); o.phone = p; }
    o.updatedAt = nowISO(); o.updatedByName = req.user.name;
    ctx.save('orders');
    res.json({ order: view(o) });
  });
  ctx.orders.lastError = () => lastSyncError;
};
