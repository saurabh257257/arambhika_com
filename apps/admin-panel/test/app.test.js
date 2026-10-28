'use strict';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp, todayIST } = require('../app');
const { addDays } = require('../lib/util');

const ROOT = path.join(__dirname, '..');
const today = todayIST();

// ---- helpers ----
function client(base) {
  let cookie = '';
  const call = async (method, url, body, headers = {}) => {
    const res = await fetch(base + url, { method, redirect: 'manual', headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (set.length) { const c = set[0].split(';')[0]; cookie = c.endsWith('=') ? '' : c; }
    const type = res.headers.get('content-type') || '';
    return { status: res.status, data: type.includes('json') ? await res.json() : await res.text(), location: res.headers.get('location') };
  };
  return { get: (u) => call('GET', u), post: (u, b) => call('POST', u, b === undefined ? {} : b), put: (u, b) => call('PUT', u, b), patch: (u, b) => call('PATCH', u, b), del: (u) => call('DELETE', u), raw: call };
}
async function boot(zoho) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-panel-'));
  const app = createApp({ dataDir: dir, adminPassword: 'admin-secret-1', sessionSecret: 'test-secret', zoho });
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  return { dir, base: 'http://127.0.0.1:' + server.address().port, stop: () => new Promise((r) => server.close(r)) };
}

// a pretend Zoho: the tests change `data` to show a new customer, a paid invoice or an outage
function pretendZoho() {
  const data = {
    fail: false, contactsAllowed: true,
    contacts: [
      { id: '1001', name: 'Shakti Batteries', company: 'Shakti Batteries', phone: '9811111111', email: 'a@x.in' },
      { id: '1002', name: 'Volt Works', company: '', phone: '9822222222', email: '' },
      { id: '1003', name: 'Green Cells', company: '', phone: '9833333333', email: '' },
      { id: '1004', name: 'New Prospect', company: '', phone: '9844444444', email: '' },
    ],
    invoices: [
      { id: '9001', number: 'INV-1', customerId: '1001', customerName: 'Shakti Batteries', date: addDays(today, -40), dueDate: addDays(today, -10), total: 5900, balance: 5900, status: 'overdue', phone: '9811111111', email: '' },
      { id: '9002', number: 'INV-2', customerId: '1002', customerName: 'Volt Works', date: addDays(today, -5), dueDate: addDays(today, 30), total: 800, balance: 800, status: 'sent', phone: '9822222222', email: '' },
      { id: '9003', number: 'INV-3', customerId: '1001', customerName: 'Shakti Batteries', date: addDays(today, -90), dueDate: addDays(today, -60), total: 3000, balance: 0, status: 'paid', phone: '', email: '' },
      { id: '9004', number: 'INV-4', customerId: '1003', customerName: 'Green Cells', date: addDays(today, -3), dueDate: addDays(today, 2), total: 100, balance: 100, status: 'sent', phone: '9833333333', email: '' },
    ],
    salesOrders: [
      { id: '7001', number: 'SO-100', customerName: 'Web Buyer', date: today, createdTime: new Date().toISOString(), total: 1180, status: 'open', invoiced: 'invoiced', paid: 'paid', shipped: 'pending' },
      { id: '7002', number: 'SO-001', customerName: 'Old Buyer', date: addDays(today, -200), createdTime: '2026-01-01T00:00:00+0530', total: 10, status: 'closed', invoiced: 'invoiced', paid: 'paid', shipped: 'fulfilled' },
    ],
  };
  const guard = async (fn) => { if (data.fail) throw new Error('Zoho is down'); return fn(); };
  return {
    data, configured: true,
    invoices: () => guard(() => data.invoices.map((i) => ({ ...i }))),
    salesOrders: () => guard(() => data.salesOrders.map((o) => ({ ...o }))),
    customers: () => guard(() => {
      if (data.contactsAllowed) return { source: 'contacts', list: data.contacts.map((c) => ({ ...c, outstanding: 0 })) };
      const by = new Map();
      for (const i of data.invoices) if (!by.has(i.customerId)) by.set(i.customerId, { id: i.customerId, name: i.customerName, company: '', phone: i.phone, email: '', outstanding: 0 });
      return { source: 'invoices', list: [...by.values()], note: 'Customers are rebuilt from invoices' };
    }),
    status: () => ({ configured: true, invoices: { count: data.invoices.length, error: '' }, customers: { count: data.contacts.length, error: '' }, salesOrders: { count: data.salesOrders.length, error: '' } }),
  };
}

// an owner and two team members, signed in
async function team(zoho) {
  const s = await boot(zoho);
  const admin = client(s.base), ann = client(s.base), raj = client(s.base);
  await admin.post('/api/auth/login', { username: 'admin', password: 'admin-secret-1' });
  const annId = (await admin.post('/api/users', { name: 'Ann', username: 'ann', password: 'ann-password-1' })).data.user.id;
  const rajId = (await admin.post('/api/users', { name: 'Raj', username: 'raj', password: 'raj-password-1' })).data.user.id;
  await ann.post('/api/auth/login', { username: 'ann', password: 'ann-password-1' });
  await raj.post('/api/auth/login', { username: 'raj', password: 'raj-password-1' });
  return { s, admin, ann, raj, annId, rajId };
}

// ======================================================================
describe('locked to staff', () => {
  let s;
  before(async () => { s = await boot(pretendZoho()); });
  after(() => s.stop());

  test('every page and API needs a sign-in; only the login page is open', async () => {
    const c = client(s.base);
    for (const u of ['/api/me', '/api/tasks', '/api/templates', '/api/leads', '/api/orders', '/api/customers', '/api/invoices', '/api/transactions', '/api/users', '/api/dashboard', '/api/my-day', '/api/activity', '/api/settings', '/api/zoho/status']) {
      assert.equal((await c.get(u)).status, 401, u);
    }
    for (const u of ['/', '/index.html', '/js/core.js']) { const r = await c.get(u); assert.equal(r.status, 302, u); assert.equal(r.location, '/login.html'); }
    assert.equal((await c.get('/login.html')).status, 200);
    assert.equal((await c.get('/package.json')).status, 404);
    assert.equal((await c.get('/app.js')).status, 404, 'the server source is never served');
    assert.match((await c.get('/health')).data.status, /ok/);
  });
  test('refuses to start without a password', () => { assert.throws(() => createApp({ dataDir: s.dir, adminPassword: '' }), /ADMIN_PASSWORD/); });
  test('forged or tampered cookies and non-JSON writes are refused', async () => {
    const c = client(s.base);
    const forged = Buffer.from(JSON.stringify({ id: 'admin', exp: Date.now() + 1e9 })).toString('base64url') + '.AAAA';
    assert.equal((await c.raw('GET', '/api/me', undefined, { Cookie: 'ap_session=' + forged })).status, 401);
    assert.equal((await fetch(s.base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' })).status, 415);
  });
  test('wrong passwords are refused and repeated tries are slowed down', async () => {
    const c = client(s.base);
    assert.equal((await c.post('/api/auth/login', { username: 'admin', password: 'nope' })).status, 401);
    let last; for (let i = 0; i < 12; i++) last = await c.post('/api/auth/login', { username: 'admin', password: 'nope' + i });
    assert.equal(last.status, 429);
  });
});

// ======================================================================
describe('the team, the task designer and the daily work', () => {
  let s, admin, ann, raj, annId, rajId;
  before(async () => { ({ s, admin, ann, raj, annId, rajId } = await team(pretendZoho())); });
  after(() => s.stop());

  test('the owner adds members with passwords (stored hashed); members cannot do owner things', async () => {
    assert.equal((await admin.post('/api/users', { name: 'X', username: 'ann', password: 'longenough1' })).status, 400, 'username is unique');
    assert.equal((await admin.post('/api/users', { name: 'X', username: 'admin', password: 'longenough1' })).status, 400);
    assert.equal((await admin.post('/api/users', { name: 'X', username: 'xx1', password: 'short' })).status, 400);
    const file = fs.readFileSync(path.join(s.dir, 'users.json'), 'utf8');
    assert.ok(!file.includes('ann-password-1') && file.includes('passHash'));
    assert.deepEqual((await ann.get('/api/users')).data.users.map((u) => Object.keys(u).sort().join()), ['id,name', 'id,name']);
    for (const [m, u, b] of [['get', '/api/templates'], ['post', '/api/templates', {}], ['get', '/api/dashboard'], ['get', '/api/activity'], ['put', '/api/settings', {}], ['post', '/api/zoho/refresh', {}], ['post', '/api/customers/auto-assign', {}]]) {
      assert.equal((await ann[m](u, b)).status, 403, m + ' ' + u);
    }
  });

  test('"Call 10 people": the owner sets the number and 10 blank rows appear for each person', async () => {
    const r = await admin.post('/api/templates', { name: 'Call 10 people', kind: 'rows', rowCount: 10, assignees: [annId, rajId], instructions: 'Call old customers' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.template.columns.map((c) => c.label), ['Name', 'Phone', 'Result', 'Note']);
    const mine = (await ann.get('/api/tasks')).data.tasks;
    assert.equal(mine.length, 1);
    assert.equal(mine[0].rows.length, 10);
    assert.deepEqual(mine[0].progress, { done: 0, total: 10, percent: 0 });
    assert.equal((await raj.get('/api/tasks')).data.tasks[0].rows.length, 10, 'each person gets their own copy');
    assert.equal((await admin.get('/api/tasks')).status, 400, 'the owner picks whose work to look at');
    assert.equal((await admin.get('/api/tasks?userId=' + annId)).data.tasks.length, 1);
  });

  test('filling the cells: time and name are recorded, bad values are refused, percent follows', async () => {
    const id = (await ann.get('/api/tasks')).data.tasks[0].id;
    const ok = await ann.put('/api/tasks/' + id + '/rows/0', { values: { name: 'Mr Gupta', phone: '9876543210', result: 'Interested', note: 'Wants a quote' } });
    assert.equal(ok.status, 200);
    const t = ok.data.task;
    assert.equal(t.progress.done, 1); assert.equal(t.progress.percent, 10);
    assert.ok(t.rows[0].updatedAt && t.rows[0].updatedByName === 'Ann', 'the row carries a timestamp and who did it');
    assert.ok(t.updatedAt && t.updatedByName === 'Ann');
    assert.equal((await ann.put('/api/tasks/' + id + '/rows/1', { values: { name: 'X', phone: 'abc' } })).status, 400);
    assert.equal((await ann.put('/api/tasks/' + id + '/rows/1', { values: { name: 'X', result: 'Sleeping' } })).status, 400);
    assert.equal((await ann.put('/api/tasks/' + id + '/rows/99', { values: { name: 'X' } })).status, 404);
    assert.equal((await raj.put('/api/tasks/' + id + '/rows/2', { values: { name: 'X' } })).status, 404, 'cannot touch somebody else\'s task');
    assert.equal((await admin.put('/api/tasks/' + id + '/rows/2', { values: { name: 'X' } })).status, 404, 'the owner watches, the team member does the work');
    for (let i = 1; i < 10; i++) await ann.put('/api/tasks/' + id + '/rows/' + i, { values: { name: 'Person ' + i } });
    const done = (await ann.get('/api/tasks')).data.tasks[0];
    assert.equal(done.progress.percent, 100); assert.ok(done.completedAt);
    await ann.put('/api/tasks/' + id + '/rows/3', { values: { name: '' } });
    assert.equal((await ann.get('/api/tasks')).data.tasks[0].completedAt, '', 'emptying a row reopens the task');
  });

  test('a checklist (task with sub-tasks), a counter, and a one-time task that stays until done', async () => {
    await admin.post('/api/templates', { name: 'Open the shop', kind: 'checklist', steps: ['Switch on lights', 'Check stock register', 'Reply to WhatsApp'], assignees: [annId] });
    await admin.post('/api/templates', { name: 'Post Instagram photos', kind: 'count', target: 3, unit: 'photos', assignees: [annId, rajId] });
    await admin.post('/api/templates', { name: 'Maintain inventory', kind: 'checklist', steps: ['Count BMS', 'Count nickel strips'], assignees: [rajId], schedule: 'once', dueDate: addDays(today, 3) });
    const tasks = (await ann.get('/api/tasks')).data.tasks;
    assert.deepEqual(tasks.map((t) => t.name).sort(), ['Call 10 people', 'Open the shop', 'Post Instagram photos']);
    const list = tasks.find((t) => t.name === 'Open the shop');
    const step = await ann.put('/api/tasks/' + list.id + '/steps/1', { done: true });
    assert.equal(step.data.task.progress.done, 1); assert.ok(step.data.task.steps[1].doneAt);
    const insta = tasks.find((t) => t.name === 'Post Instagram photos');
    const c = await ann.put('/api/tasks/' + insta.id + '/count', { count: 2, notes: 'https://instagram.com/p/abc' });
    assert.equal(c.data.task.progress.percent, 67); assert.equal(c.data.task.notes, 'https://instagram.com/p/abc');
    assert.equal((await ann.put('/api/tasks/' + insta.id + '/count', { count: 'many' })).status, 400);
    const rajTasks = (await raj.get('/api/tasks')).data.tasks;
    assert.ok(rajTasks.some((t) => t.name === 'Maintain inventory' && t.schedule === 'once'));
    assert.equal((await ann.get('/api/tasks')).data.tasks.some((t) => t.name === 'Maintain inventory'), false);
  });

  test('changing a design later does not rewrite work already started; switching it off keeps the record', async () => {
    const tpl = (await admin.get('/api/templates')).data.templates.find((t) => t.name === 'Call 10 people');
    assert.equal((await admin.put('/api/templates/' + tpl.id, { rowCount: 5 })).data.template.rowCount, 5);
    assert.equal((await ann.get('/api/tasks')).data.tasks.find((t) => t.name === 'Call 10 people').rows.length, 10);
    assert.equal((await admin.put('/api/templates/' + tpl.id, { rowCount: 0 })).status, 400);
    assert.equal((await admin.post('/api/templates', { name: 'x', kind: 'rows', rowCount: 3, assignees: ['nobody'] })).status, 400);
    assert.equal((await admin.post('/api/templates', { name: 'x', kind: 'rows', rowCount: 3, assignees: [] })).status, 400);
    assert.equal((await admin.post('/api/templates', { name: 'x', kind: 'rows', rowCount: 3, assignees: [annId], columns: [{ label: 'Result', type: 'choice' }] })).status, 400, 'a choice column needs its choices');
    assert.equal((await admin.del('/api/templates/' + tpl.id)).status, 200);
    assert.equal((await admin.get('/api/templates')).data.templates.find((t) => t.id === tpl.id).active, false);
    assert.ok((await ann.get('/api/tasks')).data.tasks.some((t) => t.name === 'Call 10 people'), 'today\'s work stays visible');
  });

  test('custom columns, and a day-by-day history', async () => {
    const r = await admin.post('/api/templates', { name: 'Visit dealers', kind: 'rows', rowCount: 2, assignees: [rajId], columns: [{ label: 'Dealer', type: 'text', required: true }, { label: 'Visit date', type: 'date' }, { label: 'Stage', type: 'choice', options: 'Hot, Warm, Cold' }] });
    assert.equal(r.status, 200);
    const t = (await raj.get('/api/tasks')).data.tasks.find((x) => x.name === 'Visit dealers');
    assert.deepEqual(t.columns.map((c) => c.key), ['dealer', 'visit_date', 'stage']);
    assert.equal((await raj.put('/api/tasks/' + t.id + '/rows/0', { values: { dealer: 'ABC', visit_date: 'tomorrow' } })).status, 400);
    assert.equal((await raj.put('/api/tasks/' + t.id + '/rows/0', { values: { dealer: 'ABC', visit_date: today, stage: 'Hot' } })).status, 200);
    const h = (await admin.get('/api/history?userId=' + rajId + '&days=3')).data.days;
    assert.equal(h.length, 3); assert.equal(h[0].date, today); assert.ok(h[0].done >= 1); assert.ok(h[0].lastUpdate);
  });

  test('the owner sees who did what and when; members do not', async () => {
    const a = (await admin.get('/api/activity')).data.activity;
    assert.ok(a.some((x) => x.userName === 'Ann' && /Call 10 people/.test(x.text) && x.at));
    assert.ok(a.some((x) => x.userName === 'Admin' && /Designed the task/.test(x.text)));
    assert.equal((await admin.get('/api/activity?userId=' + rajId)).data.activity.every((x) => x.userId === rajId), true);
    assert.equal((await ann.get('/api/activity')).status, 403);
  });

  test('a switched-off member is locked out immediately; a new password works', async () => {
    assert.equal((await admin.patch('/api/users/' + rajId, { active: false })).data.user.active, false);
    assert.equal((await raj.get('/api/me')).status, 401);
    assert.equal((await client(s.base).post('/api/auth/login', { username: 'raj', password: 'raj-password-1' })).status, 401);
    await admin.patch('/api/users/' + rajId, { active: true, password: 'new-password-9' });
    assert.equal((await client(s.base).post('/api/auth/login', { username: 'raj', password: 'new-password-9' })).status, 200);
  });
});

// ======================================================================
describe('leads: who is picking', () => {
  let s, admin, ann, raj, annId, rajId, leadId;
  before(async () => { ({ s, admin, ann, raj, annId, rajId } = await team(pretendZoho())); });
  after(() => s.stop());

  test('a new lead waits for somebody to pick it; only one person can', async () => {
    leadId = (await admin.post('/api/leads', { name: 'Sun Power Pvt Ltd', phone: '9876500000', source: 'WhatsApp', need: 'BMS 16S' })).data.lead.id;
    assert.equal((await admin.post('/api/leads', { name: '' })).status, 400);
    assert.equal((await admin.post('/api/leads', { name: 'X', phone: 'abc' })).status, 400);
    assert.equal((await ann.get('/api/leads')).data.leads.length, 1);
    assert.equal((await ann.get('/api/leads')).data.leads[0].followStatus, 'new');
    assert.equal((await admin.post('/api/leads/' + leadId + '/pick')).status, 403, 'the owner assigns, he does not pick');
    assert.equal((await ann.post('/api/leads/' + leadId + '/pick')).status, 200);
    const again = await raj.post('/api/leads/' + leadId + '/pick');
    assert.equal(again.status, 400); assert.match(again.data.error, /Ann already picked/);
    assert.equal((await raj.get('/api/leads')).data.leads.length, 0, 'picked leads are private to their owner');
    assert.equal((await raj.post('/api/leads/' + leadId + '/followup', { outcome: 'contacted' })).status, 404);
  });

  test('follow-ups set the status and the next date from the rules', async () => {
    assert.equal((await ann.post('/api/leads/' + leadId + '/followup', { outcome: 'dancing' })).status, 400);
    const q = (await ann.post('/api/leads/' + leadId + '/followup', { outcome: 'quote', note: 'Sent 16S quote' })).data.lead;
    assert.equal(q.status, 'quoted'); assert.equal(q.nextDate, addDays(today, 3)); assert.equal(q.lastByName, 'Ann'); assert.ok(q.lastAt);
    assert.equal((await ann.post('/api/leads/' + leadId + '/followup', { outcome: 'noanswer', nextDate: addDays(today, 10) })).data.lead.nextDate, addDays(today, 10), 'the person can pick another date');
    assert.equal((await ann.post('/api/leads/' + leadId + '/followup', { outcome: 'noanswer', nextDate: addDays(today, -1) })).status, 400);
    const h = (await ann.get('/api/leads/' + leadId + '/history')).data.history;
    assert.equal(h.length, 2); assert.equal(h[0].byName, 'Ann');
  });

  test('a lead that will buy becomes an order; the lead is marked won', async () => {
    const r = await ann.post('/api/leads/' + leadId + '/order', { amount: 25000 });
    assert.equal(r.status, 200);
    assert.equal(r.data.order.customerName, 'Sun Power Pvt Ltd'); assert.equal(r.data.order.ownerId, annId);
    assert.equal(r.data.order.progress.done, 1);
    const l = (await ann.get('/api/leads')).data.leads[0];
    assert.equal(l.status, 'won'); assert.equal(l.nextDate, '');
  });

  test('the owner can assign a lead to anybody, and members can add their own', async () => {
    const l2 = (await admin.post('/api/leads', { name: 'Hot Lead' })).data.lead.id;
    assert.equal((await admin.post('/api/leads/' + l2 + '/assign', { ownerId: rajId })).data.lead.ownerName, 'Raj');
    assert.equal((await raj.get('/api/leads')).data.leads.length, 1);
    assert.equal((await raj.post('/api/leads', { name: 'Self found', phone: '9811100000' })).data.lead.ownerId, rajId);
    assert.equal((await ann.post('/api/leads/' + l2 + '/assign', { ownerId: annId })).status, 403);
  });
});

// ======================================================================
describe('orders: the six stages and the Zoho sync', () => {
  let s, z, admin, ann, raj, annId;
  before(async () => { z = pretendZoho(); ({ s, admin, ann, raj, annId } = await team(z)); });
  after(() => s.stop());

  test('a new website order appears by itself, ticked from what Zoho says, waiting to be picked', async () => {
    const r = (await ann.get('/api/orders')).data;
    assert.equal(r.zoho.ok, true);
    assert.equal(r.orders.length, 1, 'the 200 day old order is not pulled in');
    const o = r.orders[0];
    assert.equal(o.customerName, 'Web Buyer'); assert.equal(o.amount, 1180); assert.equal(o.ownerId, '');
    assert.deepEqual(Object.keys(o.stages).sort(), ['invoice', 'lead', 'payment']);
    assert.equal(o.stages.payment.by, 'Zoho'); assert.ok(o.stages.payment.at);
    assert.equal(o.nextStage, 'Quotation created'); assert.equal(o.progress.percent, 50);
    assert.equal((await ann.get('/api/orders')).data.orders.length, 1, 'syncing again does not duplicate');
  });

  test('one person picks it; stages are ticked with time and name; Zoho progress is picked up later', async () => {
    const id = (await ann.get('/api/orders')).data.orders[0].id;
    assert.equal((await ann.post('/api/orders/' + id + '/pick')).status, 200);
    assert.equal((await raj.post('/api/orders/' + id + '/pick')).status, 400);
    assert.equal((await raj.put('/api/orders/' + id + '/stages/quotation', { done: true })).status, 404);
    const t = (await ann.put('/api/orders/' + id + '/stages/quotation', { done: true })).data.order;
    assert.equal(t.stages.quotation.by, 'Ann'); assert.equal(t.progress.done, 4);
    assert.equal((await ann.put('/api/orders/' + id + '/stages/teleport', { done: true })).status, 400);
    z.data.salesOrders[0].shipped = 'fulfilled';
    const full = (await ann.get('/api/orders?filter=all')).data.orders.find((o) => o.id === id);
    assert.ok(full.stages.dispatched && full.stages.delivered, 'shipped and delivered come from Zoho');
    assert.equal(full.progress.percent, 100); assert.equal(full.complete, true);
    assert.equal((await ann.get('/api/orders')).data.orders.length, 0, 'finished orders leave the active list');
  });

  test('orders can also be added by hand and assigned by the owner', async () => {
    assert.equal((await ann.post('/api/orders', { customerName: '' })).status, 400);
    const o = (await ann.post('/api/orders', { customerName: 'Walk-in', phone: '9899999999', amount: 500 })).data.order;
    assert.equal(o.ownerId, annId);
    const o2 = (await admin.post('/api/orders', { customerName: 'Phone order' })).data.order;
    assert.equal(o2.ownerId, '');
    assert.equal((await admin.post('/api/orders/' + o2.id + '/assign', { ownerId: annId })).data.order.ownerName, 'Ann');
    assert.equal((await ann.post('/api/orders/' + o2.id + '/assign', { ownerId: annId })).status, 403);
  });

  test('when Zoho is down the pipeline still works', async () => {
    z.data.fail = true;
    const r = await ann.get('/api/orders');
    assert.equal(r.status, 200); assert.equal(r.data.zoho.ok, false); assert.match(r.data.zoho.error, /Zoho is down/);
    assert.ok(r.data.orders.length >= 2);
    z.data.fail = false;
  });
});

// ======================================================================
describe('customers from Zoho: owner, cadence and onboarded', () => {
  let s, z, admin, ann, raj;
  before(async () => { z = pretendZoho(); ({ s, admin, ann, raj } = await team(z)); });
  after(() => s.stop());

  test('the list is pulled from Zoho at runtime; onboarded is worked out from invoices', async () => {
    const r = (await admin.get('/api/customers')).data;
    assert.equal(r.customers.length, 4); assert.equal(r.source, 'contacts');
    const by = Object.fromEntries(r.customers.map((c) => [c.id, c]));
    assert.equal(by['1001'].onboarded, true); assert.equal(by['1001'].invoices, 2); assert.equal(by['1001'].outstanding, 5900); assert.equal(by['1001'].billed, 8900);
    assert.equal(by['1004'].onboarded, false); assert.equal(by['1004'].invoices, 0);
    z.data.contacts.push({ id: '1005', name: 'Added in Zoho a minute ago', company: '', phone: '', email: '' });
    assert.equal((await admin.get('/api/customers?refresh=1')).data.customers.length, 5, 'a new Zoho customer shows up without any import');
  });

  test('the owner shares customers evenly; each member sees their own', async () => {
    const r = (await admin.post('/api/customers/auto-assign')).data;
    assert.equal(r.assigned, 5);
    const a = (await ann.get('/api/customers')).data; const b = (await raj.get('/api/customers')).data;
    assert.equal(a.customers.length + b.customers.length, 5);
    assert.ok(Math.abs(a.customers.length - b.customers.length) <= 1);
    assert.equal((await admin.post('/api/customers/auto-assign')).data.assigned, 0, 'nothing left to share');
    assert.equal((await ann.post('/api/customers/auto-assign')).status, 403);
  });

  test('a follow-up decides the next date; "order placed" onboards; the member can override onboarded', async () => {
    const c = (await ann.get('/api/customers?filter=mine')).data.customers[0];
    assert.equal((await raj.post('/api/customers/' + c.id + '/followup', { outcome: 'noanswer' })).status, 404, 'only the owner follows up');
    const f = await ann.post('/api/customers/' + c.id + '/followup', { outcome: 'noanswer', note: 'Phone off' });
    assert.equal(f.data.nextDate, addDays(today, 1));
    let after = (await ann.get('/api/customers?filter=mine')).data.customers.find((x) => x.id === c.id);
    assert.equal(after.followStatus, 'ok'); assert.equal(after.lastByName, 'Ann'); assert.ok(after.lastAt); assert.equal(after.lastOutcome, 'noanswer');
    assert.equal((await ann.post('/api/customers/' + c.id + '/followup', { outcome: 'ordered' })).data.nextDate, addDays(today, 30));
    after = (await ann.get('/api/customers?filter=mine')).data.customers.find((x) => x.id === c.id);
    assert.equal(after.onboarded, true);
    assert.equal((await ann.patch('/api/customers/' + c.id, { onboarded: false })).status, 200);
    assert.equal((await ann.get('/api/customers?filter=mine')).data.customers.find((x) => x.id === c.id).onboarded, false);
    assert.equal((await ann.patch('/api/customers/' + c.id, { onboarded: null })).status, 200);
    assert.equal((await ann.post('/api/customers/abc/followup', { outcome: 'noanswer' })).status, 400);
    const h = (await ann.get('/api/customers/' + c.id + '/history')).data.history;
    assert.equal(h.length, 2); assert.equal(h[0].outcome, 'ordered');
  });

  test('the owner changes the rules: "no answer" now means 2 days', async () => {
    const cad = (await admin.get('/api/settings')).data.cadence;
    cad.customer.find((r) => r.key === 'noanswer').days = 2;
    assert.equal((await admin.put('/api/settings', { cadence: cad })).status, 200);
    const c = (await ann.get('/api/customers?filter=mine')).data.customers.find((x) => x.followStatus === 'none');
    assert.equal((await ann.post('/api/customers/' + c.id + '/followup', { outcome: 'noanswer' })).data.nextDate, addDays(today, 2));
    cad.customer.find((r) => r.key === 'noanswer').days = 0;
    assert.equal((await admin.put('/api/settings', { cadence: cad })).status, 400);
    assert.equal((await admin.put('/api/settings', { invoiceLeadDays: 99 })).status, 400);
  });

  test('if the saved Zoho login cannot read contacts, customers are rebuilt from invoices', async () => {
    z.data.contactsAllowed = false;
    const r = (await admin.get('/api/customers?refresh=1')).data;
    assert.equal(r.source, 'invoices'); assert.match(r.note, /rebuilt from invoices/);
    assert.deepEqual(r.customers.map((c) => c.id).sort(), ['1001', '1002', '1003']);
    z.data.contactsAllowed = true;
  });

  test('when Zoho is down the screen says so instead of failing', async () => {
    z.data.fail = true;
    const r = await admin.get('/api/customers');
    assert.equal(r.status, 200); assert.match(r.data.error, /Zoho is down/); assert.deepEqual(r.data.customers, []);
    z.data.fail = false;
  });
});

// ======================================================================
describe('invoices: are we following up properly?', () => {
  let s, z, admin, ann, raj, annId, rajId;
  before(async () => { z = pretendZoho(); ({ s, admin, ann, raj, annId, rajId } = await team(z)); });
  after(() => s.stop());

  test('only unpaid invoices are listed, with how late they are and whether anyone is chasing them', async () => {
    const r = (await admin.get('/api/invoices')).data;
    assert.deepEqual(r.invoices.map((i) => i.number).sort(), ['INV-1', 'INV-2', 'INV-4'], 'the paid invoice is not listed');
    const inv1 = r.invoices.find((i) => i.number === 'INV-1');
    assert.equal(inv1.daysOverdue, 10); assert.equal(inv1.followStatus, 'overdue'); assert.equal(inv1.neverFollowed, true); assert.equal(inv1.needs, true);
    assert.equal(r.invoices.find((i) => i.number === 'INV-2').needs, false, 'not due for a month: nothing to chase yet');
    assert.equal(r.invoices.find((i) => i.number === 'INV-4').needs, true, 'due in 2 days: chase now');
    assert.equal(r.summary.unpaid, 3); assert.equal(r.summary.outstanding, 6800); assert.equal(r.summary.needing, 2); assert.equal(r.summary.compliant, 0); assert.equal(r.summary.percent, 0);
  });

  test('an invoice belongs to its own owner, or else to its customer\'s owner', async () => {
    await admin.post('/api/customers/1001/assign', { ownerId: annId });
    assert.equal((await ann.get('/api/invoices')).data.invoices.find((i) => i.number === 'INV-1').ownerName, 'Ann');
    assert.equal((await admin.post('/api/invoices/9001/assign', { ownerId: rajId })).status, 200);
    assert.equal((await admin.get('/api/invoices')).data.invoices.find((i) => i.number === 'INV-1').ownerName, 'Raj', 'the invoice\'s own owner wins');
    assert.equal((await ann.get('/api/invoices')).data.invoices.some((i) => i.number === 'INV-1'), false);
    assert.equal((await raj.post('/api/invoices/9004/pick')).status, 200);
    assert.equal((await ann.post('/api/invoices/9004/pick')).status, 400);
  });

  test('follow-ups: a promise needs a date; a reminder sets the next date; the compliance figure moves', async () => {
    assert.equal((await ann.post('/api/invoices/9001/followup', { outcome: 'reminded' })).status, 404, 'only the owner');
    assert.equal((await raj.post('/api/invoices/9001/followup', { outcome: 'promised' })).status, 400);
    const promised = addDays(today, 5);
    assert.equal((await raj.post('/api/invoices/9001/followup', { outcome: 'promised', nextDate: promised, note: 'Will pay on Friday' })).data.nextDate, promised);
    assert.equal((await raj.post('/api/invoices/9004/followup', { outcome: 'reminded' })).data.nextDate, addDays(today, 2));
    const r = (await admin.get('/api/invoices')).data;
    assert.equal(r.summary.compliant, 2); assert.equal(r.summary.percent, 100);
    const inv1 = r.invoices.find((i) => i.number === 'INV-1');
    assert.equal(inv1.followStatus, 'ok'); assert.equal(inv1.lastByName, 'Raj'); assert.equal(inv1.nextDate, promised); assert.equal(inv1.lastOutcome, 'promised');
    const h = (await raj.get('/api/invoices/9001/history')).data.history;
    assert.equal(h.length, 1); assert.equal(h[0].note, 'Will pay on Friday');
  });

  test('a paid invoice disappears by itself', async () => {
    z.data.invoices = z.data.invoices.map((i) => (i.id === '9001' ? { ...i, balance: 0, status: 'paid' } : i));
    const r = (await admin.get('/api/invoices')).data;
    assert.equal(r.invoices.some((i) => i.number === 'INV-1'), false);
    assert.equal(r.summary.unpaid, 2);
  });

  test('when Zoho is down the screen says so', async () => {
    z.data.fail = true;
    const r = await admin.get('/api/invoices');
    assert.equal(r.status, 200); assert.match(r.data.error, /Zoho is down/);
    z.data.fail = false;
  });
});

// ======================================================================
describe('"how much is done": the percentage, and the owner\'s dashboard', () => {
  let s, z, admin, ann, raj, annId, rajId;
  before(async () => { z = pretendZoho(); ({ s, admin, ann, raj, annId, rajId } = await team(z)); });
  after(() => s.stop());

  test('tasks + follow-ups + leads are added up into one percentage', async () => {
    await admin.post('/api/templates', { name: 'Call 10 people', kind: 'rows', rowCount: 10, assignees: [annId, rajId] });
    const start = (await ann.get('/api/my-day')).data;
    assert.deepEqual(start.progress.overall, { done: 0, total: 10, percent: 0, left: 10 });
    const id = (await ann.get('/api/tasks')).data.tasks[0].id;
    for (let i = 0; i < 3; i++) await ann.put('/api/tasks/' + id + '/rows/' + i, { values: { name: 'P' + i } });
    await admin.post('/api/customers/1001/assign', { ownerId: annId });
    await admin.post('/api/customers/1002/assign', { ownerId: annId });
    await admin.post('/api/invoices/9001/assign', { ownerId: annId });
    await admin.post('/api/leads', { name: 'Fresh Lead', ownerId: annId });
    let p = (await ann.get('/api/my-day')).data.progress;
    assert.deepEqual(p.tasks, { done: 3, total: 10 });
    assert.deepEqual(p.customers, { done: 0, total: 2 });
    assert.equal(p.invoices.total, 1); assert.deepEqual(p.leads, { done: 0, total: 1 });
    assert.deepEqual(p.overall, { done: 3, total: 14, percent: 21, left: 11 });
    await ann.post('/api/customers/1001/followup', { outcome: 'interested' });
    await ann.post('/api/invoices/9001/followup', { outcome: 'reminded' });
    const leadId = (await ann.get('/api/leads')).data.leads[0].id;
    await ann.post('/api/leads/' + leadId + '/followup', { outcome: 'contacted' });
    p = (await ann.get('/api/my-day')).data.progress;
    assert.deepEqual(p.customers, { done: 1, total: 2 }); assert.deepEqual(p.invoices, { done: 1, total: 1 }); assert.deepEqual(p.leads, { done: 1, total: 1 });
    assert.deepEqual(p.overall, { done: 6, total: 14, percent: 43, left: 8 });
    assert.equal((await raj.get('/api/my-day')).data.progress.overall.done, 0, 'each person has their own figure');
    assert.equal((await admin.get('/api/my-day')).status, 403);
  });

  test('the dashboard shows each member, who has not started, and what is waiting to be assigned', async () => {
    const d = (await admin.get('/api/dashboard')).data;
    assert.equal(d.team.length, 2);
    const a = d.team.find((t) => t.name === 'Ann'); const r = d.team.find((t) => t.name === 'Raj');
    assert.equal(a.progress.overall.percent, 43); assert.ok(a.lastActivity);
    assert.equal(r.lastActivity, '');
    assert.deepEqual(d.alerts.notStarted, ['Raj']);
    assert.equal(d.alerts.totalCustomers, 4); assert.equal(d.alerts.unassignedCustomers, 2);
    assert.equal(d.alerts.unpaidInvoices, 3); assert.equal(d.alerts.unassignedInvoices >= 1, true);
    assert.equal(d.alerts.unassignedOrders, 0);
    assert.equal(typeof d.alerts.invoiceCompliance, 'number');
    assert.equal(d.zoho.configured, true);
  });

  test('if Zoho is down the dashboard still opens', async () => {
    z.data.fail = true;
    assert.equal((await admin.get('/api/dashboard')).status, 200);
    assert.equal((await ann.get('/api/my-day')).status, 200);
    z.data.fail = false;
  });
});

// ======================================================================
describe('office: transactions for approval', () => {
  let s, admin, ann, raj;
  before(async () => { ({ s, admin, ann, raj } = await team(pretendZoho())); });
  after(() => s.stop());

  test('members send, the owner decides, decided ones are locked', async () => {
    assert.equal((await ann.post('/api/transactions', { amount: 0, party: 'Shop' })).status, 400);
    assert.equal((await ann.post('/api/transactions', { amount: 5, party: '' })).status, 400);
    assert.equal((await ann.post('/api/transactions', { amount: 5, party: 'Shop', date: '2099-01-01' })).status, 400);
    const t1 = (await ann.post('/api/transactions', { type: 'expense', amount: 1250.5, party: 'Courier', description: 'Samples' })).data.transaction;
    const t2 = (await ann.post('/api/transactions', { type: 'purchase', amount: 300, party: 'Stationery' })).data.transaction;
    assert.equal(t1.status, 'pending');
    assert.equal((await admin.post('/api/transactions', { amount: 5, party: 'x' })).status, 403);
    assert.equal((await raj.get('/api/transactions')).data.transactions.length, 0);
    assert.equal((await ann.put('/api/transactions/' + t2.id, { type: 'purchase', amount: 350, party: 'Stationery' })).data.transaction.amount, 350);
    assert.equal((await ann.post('/api/transactions/' + t1.id + '/decision', { status: 'approved' })).status, 403);
    assert.equal((await admin.get('/api/transactions?status=pending')).data.transactions.length, 2);
    assert.equal((await admin.post('/api/transactions/' + t1.id + '/decision', { status: 'approved', remark: 'OK' })).data.transaction.status, 'approved');
    assert.equal((await admin.post('/api/transactions/' + t2.id + '/decision', { status: 'rejected', remark: 'No' })).data.transaction.remark, 'No');
    assert.equal((await ann.put('/api/transactions/' + t1.id, { amount: 1, party: 'x' })).status, 400);
    assert.equal((await ann.del('/api/transactions/' + t1.id)).status, 400);
    assert.equal((await admin.post('/api/transactions/' + t1.id + '/decision', { status: 'maybe' })).status, 400);
  });
});

// ======================================================================
describe('screens and deployment', () => {
  const repo = path.join(ROOT, '..', '..');
  test('the page, the script files and the module list are in place', () => {
    const index = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
    for (const f of ['core', 'dashboard', 'tasks', 'leads', 'customers', 'orders', 'invoices', 'office', 'team']) {
      assert.ok(index.includes('/js/' + f + '.js'), f + ' is loaded by the page');
      assert.ok(fs.existsSync(path.join(ROOT, 'public', 'js', f + '.js')), f + '.js exists');
    }
    const login = fs.readFileSync(path.join(ROOT, 'public', 'login.html'), 'utf8');
    assert.ok(login.includes('/login.js') && login.includes('name="password"') && /noindex/.test(login));
    for (const m of ['team', 'tasks', 'leads', 'customers', 'orders', 'invoices', 'office', 'dashboard']) assert.ok(fs.existsSync(path.join(ROOT, 'modules', m + '.js')), m + ' module');
  });
  test('the deploy script refuses anything but dev, skips without a password, passes the Zoho settings and creates the web address', () => {
    const sh = fs.readFileSync(path.join(repo, 'scripts', 'deploy-admin.sh'), 'utf8');
    assert.ok(sh.includes('"$DEPLOY_ENV" != "dev"') && sh.includes('exit 1'));
    assert.ok(sh.includes('ADMIN_PANEL_PASSWORD is not set') && sh.includes('exit 0'));
    assert.ok(sh.includes('admin.arambhika.com') && sh.includes('certbot --nginx') && sh.includes('DATA_DIR='));
    for (const k of ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN', 'ZOHO_BOOKS_ORG_ID', 'ZOHO_DC']) assert.ok(sh.includes(k), k);
    assert.ok(!/production/i.test(sh.replace(/never to production|production by mistake/gi, '')), 'no production target');
  });
  test('the workflow runs on dev only and has no production job', () => {
    const wf = fs.readFileSync(path.join(repo, '.github', 'workflows', 'admin-panel-dev.yml'), 'utf8');
    assert.ok(wf.includes('branches: [dev]') && wf.includes('environment: dev') && !/environment:\s*production/.test(wf));
    for (const k of ['ADMIN_PANEL_PASSWORD', 'ADMIN_PANEL_SESSION_SECRET', 'ZOHO_REFRESH_TOKEN', 'ZOHO_CLIENT_SECRET']) assert.ok(wf.includes(k), k);
  });
});
