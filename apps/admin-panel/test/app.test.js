'use strict';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp, todayIST, clock } = require('../app');
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
  return { cookie: () => cookie, get: (u) => call('GET', u), post: (u, b) => call('POST', u, b === undefined ? {} : b), put: (u, b) => call('PUT', u, b), patch: (u, b) => call('PATCH', u, b), del: (u) => call('DELETE', u), raw: call };
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
    for (const u of ['/api/me', '/api/tasks', '/api/templates', '/api/requests', '/api/followups-due', '/api/customers', '/api/invoices', '/api/transactions', '/api/users', '/api/dashboard', '/api/my-day', '/api/activity', '/api/settings', '/api/zoho/status']) {
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
describe('daily and weekly work that carries forward', () => {
  let s, admin, ann, raj, annId, rajId, presets;
  const day = (d) => { clock.date = d; };
  before(async () => {
    day('2026-11-02'); // a Monday
    ({ s, admin, ann, raj, annId, rajId } = await team(pretendZoho()));
    presets = (await admin.get('/api/templates')).data.presets;
  });
  after(() => { clock.date = null; return s.stop(); });
  const post = (id, extra) => { const p = presets.find((x) => x.id === id); const { id: _i, for: _f, ...body } = p; return admin.post('/api/templates', { ...body, ...extra }); };
  const tasksOf = async (who, name) => (await who.get('/api/tasks')).data.tasks.find((t) => t.name === name);
  const fill = (who, task, i, extra = {}) => who.put('/api/tasks/' + task.id + '/rows/' + i, { values: { name: 'Person ' + i, phone: '98' + String(10000000 + i), what_did_you_talk_about: 'Asked about BMS', ...extra } });

  test('the quick-start presets are the tasks the owner asked for', async () => {
    assert.deepEqual(presets.map((p) => p.name), ['Call 10 people', 'Find 4 customers', 'Schedule 6 Instagram posts']);
    const calls = presets[0];
    assert.deepEqual(calls.columns.map((c) => c.label), ['Name', 'Phone', 'Company', 'What did you talk about', 'Follow-up date']);
    assert.ok(calls.columns.find((c) => c.label === 'Follow-up date').followUp);
    assert.equal(presets[2].schedule, 'weekly'); assert.equal(presets[2].rowCount, 6);
    assert.equal((await admin.post('/api/templates', { name: 'x', kind: 'rows', rowCount: 3, assignees: [annId], columns: [{ label: 'A', type: 'date', followUp: true }, { label: 'B', type: 'date', followUp: true }] })).status, 400, 'only one follow-up date column');
  });

  test('8 calls of 10 today means 12 tomorrow; a person who did nothing is capped at double', async () => {
    assert.equal((await post('calls', { assignees: [annId, rajId] })).status, 200);
    const mon = await tasksOf(ann, 'Call 10 people');
    assert.equal(mon.rows.length, 10); assert.equal(mon.carried, 0); assert.equal(mon.base, 10);
    for (let i = 0; i < 8; i++) await fill(ann, mon, i, i === 0 ? { follow_up_date: '2026-11-04' } : i === 1 ? { follow_up_date: '2026-11-09' } : {});
    day('2026-11-03');
    const tue = await tasksOf(ann, 'Call 10 people');
    assert.equal(tue.rows.length, 12); assert.equal(tue.carried, 2); assert.equal(tue.base, 10);
    assert.equal(tue.progress.total, 12);
    const rajTue = await tasksOf(raj, 'Call 10 people');
    assert.equal(rajTue.rows.length, 20); assert.equal(rajTue.carried, 10, 'nothing done yesterday: the whole 10 carries');
    day('2026-11-04');
    assert.equal((await tasksOf(raj, 'Call 10 people')).rows.length, 20, 'the carry is capped at the daily target, so it never snowballs');
    day('2026-11-03');
    for (let i = 0; i < 12; i++) await fill(ann, tue, i);
    day('2026-11-04');
    const wed = await tasksOf(ann, 'Call 10 people');
    assert.equal(wed.rows.length, 10); assert.equal(wed.carried, 0, 'everything was done, so nothing carries');
  });

  test('a follow-up date makes the call come back by itself, stays until done, and is logged with what was said', async () => {
    day('2026-11-03');
    assert.equal((await ann.get('/api/followups-due')).data.followups.length, 0, 'not due yet');
    day('2026-11-04');
    let due = (await ann.get('/api/followups-due')).data.followups;
    assert.equal(due.length, 1); assert.equal(due[0].daysLate, 0);
    assert.ok(due[0].details.some((d) => d.label === 'Name' && d.value === 'Person 0'));
    assert.ok(due[0].details.some((d) => d.label === 'What did you talk about' && d.value === 'Asked about BMS'));
    assert.equal(due[0].calledOn, '2026-11-02');
    day('2026-11-05');
    due = (await ann.get('/api/followups-due')).data.followups;
    assert.equal(due.length, 1, 'not done yet, so it is still there'); assert.equal(due[0].daysLate, 1);
    const { taskId, rowIndex } = due[0];
    assert.equal((await ann.post('/api/tasks/' + taskId + '/rows/' + rowIndex + '/followup', { notes: 'x' })).status, 400, 'say what you talked about');
    assert.equal((await ann.post('/api/tasks/' + taskId + '/rows/' + rowIndex + '/followup', { notes: 'Spoke again', nextDate: '2026-11-05' })).status, 400, 'the next date must be after today');
    assert.equal((await raj.post('/api/tasks/' + taskId + '/rows/' + rowIndex + '/followup', { notes: 'Spoke again' })).status, 404, 'only the owner of the call');
    const ok = await ann.post('/api/tasks/' + taskId + '/rows/' + rowIndex + '/followup', { notes: 'Wants the quote on Tuesday', nextDate: '2026-11-10' });
    assert.equal(ok.status, 200); assert.equal(ok.data.nextDate, '2026-11-10');
    assert.equal(ok.data.followups.length, 0);
    const row = (await ann.get('/api/tasks?date=2026-11-02')).data.tasks.find((t) => t.name === 'Call 10 people').rows[0];
    assert.equal(row.history.length, 1); assert.equal(row.history[0].byName, 'Ann'); assert.equal(row.history[0].notes, 'Wants the quote on Tuesday'); assert.ok(row.history[0].at);
    day('2026-11-09');
    assert.equal((await ann.get('/api/followups-due')).data.followups.length, 1, 'the call that was set for the 9th is due');
    day('2026-11-10');
    const again = (await ann.get('/api/followups-due')).data.followups;
    assert.equal(again.length, 2, 'the 9th was not done, and the 10th has now come');
    const first = again.find((f) => f.dueDate === '2026-11-10');
    assert.equal((await ann.post('/api/tasks/' + first.taskId + '/rows/' + first.rowIndex + '/followup', { notes: 'Order confirmed, nothing more to do' })).data.nextDate, '', 'no date = closed');
    assert.equal((await ann.get('/api/followups-due')).data.followups.length, 1);
    assert.equal((await admin.get('/api/followups-due?userId=' + annId)).data.followups.length, 1, 'the owner can see them too');
  });

  test('Sundays are days off, missed working days are filled in, and the carry chains through them', async () => {
    day('2026-11-13'); // Friday
    assert.equal((await post('find', { assignees: [annId] })).status, 200);
    const fri = await tasksOf(ann, 'Find 4 customers');
    assert.equal(fri.rows.length, 4);
    await ann.put('/api/tasks/' + fri.id + '/rows/0', { values: { name: 'Volt Works' } });
    day('2026-11-15'); // Sunday: nobody opens the panel on Saturday, and today is a day off
    const sun = (await ann.get('/api/tasks')).data;
    assert.equal(sun.workDay, false); assert.equal(sun.tasks.some((t) => t.name === 'Find 4 customers'), false);
    day('2026-11-16'); // Monday
    const mon = await tasksOf(ann, 'Find 4 customers');
    assert.equal(mon.carried, 4, 'Friday missed 3 and Saturday (filled in) missed 7, but the carry is capped at 4');
    assert.equal(mon.rows.length, 8);
    const saved = JSON.parse(fs.readFileSync(path.join(s.dir, 'tasks.json'), 'utf8')).filter((t) => t.name === 'Find 4 customers').map((t) => t.date).sort();
    assert.deepEqual(saved, ['2026-11-13', '2026-11-14', '2026-11-16'], 'Saturday was filled in, Sunday was not');
  });

  test('a weekly task is one card for the whole week, and next week carries what is left', async () => {
    day('2026-11-23'); // Monday
    assert.equal((await post('instagram', { assignees: [annId] })).status, 200);
    const w = await tasksOf(ann, 'Schedule 6 Instagram posts');
    assert.equal(w.schedule, 'weekly'); assert.equal(w.date, '2026-11-23'); assert.equal(w.rows.length, 6);
    for (let i = 0; i < 3; i++) await ann.put('/api/tasks/' + w.id + '/rows/' + i, { values: { post_topic: 'Post ' + i, scheduled_for: '2026-11-2' + (5 + i) } });
    day('2026-11-27'); // Friday of the same week
    const fri = await tasksOf(ann, 'Schedule 6 Instagram posts');
    assert.equal(fri.id, w.id, 'the same card all week'); assert.equal(fri.progress.done, 3);
    assert.equal((await tasksOf(raj, 'Schedule 6 Instagram posts')), undefined, 'only the people it was given to');
    day('2026-11-30'); // next Monday
    const next = await tasksOf(ann, 'Schedule 6 Instagram posts');
    assert.notEqual(next.id, w.id); assert.equal(next.date, '2026-11-30'); assert.equal(next.carried, 3); assert.equal(next.rows.length, 9);
  });

  test('the owner can give a one-time task to both; it stays until done and does not carry numbers', async () => {
    day('2026-12-01');
    const r = await admin.post('/api/templates', { name: 'Send the new price list to dealers', kind: 'checklist', steps: ['Prepare PDF', 'Send on WhatsApp'], schedule: 'once', dueDate: '2026-12-03', assignees: [annId, rajId], adhoc: true });
    assert.equal(r.status, 200); assert.equal(r.data.template.adhoc, true); assert.equal(r.data.template.carry, false);
    assert.ok(await tasksOf(ann, 'Send the new price list to dealers')); assert.ok(await tasksOf(raj, 'Send the new price list to dealers'));
    day('2026-12-02');
    const t = await tasksOf(ann, 'Send the new price list to dealers');
    assert.ok(t, 'still there the next day'); assert.equal(t.dueDate, '2026-12-03');
    await ann.put('/api/tasks/' + t.id + '/steps/0', { done: true }); await ann.put('/api/tasks/' + t.id + '/steps/1', { done: true });
    day('2026-12-03');
    assert.equal(await tasksOf(ann, 'Send the new price list to dealers'), undefined, 'done, so it is gone the day after');
    assert.ok(await tasksOf(raj, 'Send the new price list to dealers'), 'Raj has not finished his');
  });

  test('the owner can change the working days', async () => {
    assert.deepEqual((await admin.get('/api/settings')).data.workDays, [1, 2, 3, 4, 5, 6]);
    assert.equal((await admin.put('/api/settings', { workDays: [] })).status, 400);
    assert.equal((await admin.put('/api/settings', { workDays: [9] })).status, 400);
    assert.equal((await ann.put('/api/settings', { workDays: [1] })).status, 403);
    assert.deepEqual((await admin.put('/api/settings', { workDays: [1, 2, 3, 4, 5] })).data.workDays, [1, 2, 3, 4, 5]);
    day('2026-12-05'); // Saturday is now a day off
    assert.equal((await ann.get('/api/tasks')).data.workDay, false);
  });
});

// ======================================================================
describe('customer requests: six steps, a screenshot, and carried to the next day', () => {
  let s, z, admin, ann, raj, annId, rajId;
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const day = (d) => { clock.date = d; };
  before(async () => {
    day('2026-12-07'); z = pretendZoho();
    z.data.salesOrders.forEach((o) => { o.date = '2020-01-01'; }); // no website orders until the test that wants one
    ({ s, admin, ann, raj, annId, rajId } = await team(z));
  });
  after(() => { clock.date = null; return s.stop(); });
  let id;

  test('a team member logs a customer who messaged on WhatsApp; it is theirs', async () => {
    assert.equal((await ann.post('/api/requests', { customerName: '' })).status, 400);
    assert.equal((await ann.post('/api/requests', { customerName: 'X', phone: 'abc' })).status, 400);
    const r = (await ann.post('/api/requests', { customerName: 'Sharma Traders', phone: '9811122233', company: 'Sharma Traders Pvt Ltd', request: 'Needs 20 kg nickel strip 0.15 mm', source: 'WhatsApp' })).data.request;
    id = r.id;
    assert.equal(r.ownerId, annId); assert.equal(r.source, 'WhatsApp'); assert.equal(r.progress.done, 0); assert.equal(r.nextStep, 'Asked what is required');
    assert.equal((await raj.get('/api/requests')).data.requests.length, 0, 'private to the person who owns it');
    assert.equal((await admin.get('/api/requests')).data.requests.length, 1, 'the owner sees everything');
    assert.deepEqual((await ann.get('/api/requests')).data.steps.map((x) => x.label), ['Asked what is required', 'Quote sent and payment asked', 'Payment received', 'Material ready', 'Material dispatched', 'Sent successfully']);
    assert.equal((await raj.put('/api/requests/' + id + '/steps/ask', { done: true })).status, 404);
  });

  test('every step is a checkbox with a time and a name; payment needs its screenshot; steps can be ticked in any order', async () => {
    const t = (await ann.put('/api/requests/' + id + '/steps/ask', { done: true })).data.request;
    assert.equal(t.steps.ask.by, 'Ann'); assert.ok(t.steps.ask.at); assert.equal(t.progress.done, 1);
    assert.equal((await ann.put('/api/requests/' + id + '/steps/quote', { done: true })).data.request.progress.done, 2);
    const noPhoto = await ann.put('/api/requests/' + id + '/steps/payment', { done: true });
    assert.equal(noPhoto.status, 400); assert.match(noPhoto.data.error, /screenshot/i);
    assert.equal((await ann.post('/api/requests/' + id + '/screenshot', { dataUrl: 'hello' })).status, 400);
    assert.equal((await ann.post('/api/requests/' + id + '/screenshot', { dataUrl: 'data:image/png;base64,AAAAAAAAAAAA' })).status, 400, 'bytes that are not an image');
    assert.equal((await raj.post('/api/requests/' + id + '/screenshot', { dataUrl: PNG })).status, 404);
    const up = (await ann.post('/api/requests/' + id + '/screenshot', { dataUrl: PNG })).data.request;
    assert.equal(up.screenshots.length, 1); assert.equal(up.screenshots[0].byName, 'Ann');
    assert.equal((await ann.put('/api/requests/' + id + '/steps/payment', { done: true })).data.request.progress.done, 3);
    assert.equal((await ann.put('/api/requests/' + id + '/steps/dispatched', { done: true })).status, 200, 'any order');
    assert.equal((await ann.put('/api/requests/' + id + '/steps/dispatched', { done: false })).data.request.progress.done, 3, 'untick works');
    assert.equal((await ann.put('/api/requests/' + id + '/steps/teleport', { done: true })).status, 400);
    // the photo is only served to people who are signed in
    const name = up.screenshots[0].name;
    const got = await fetch(s.base + '/api/files/' + name, { headers: { Cookie: ann.cookie() } });
    assert.equal(got.status, 200); assert.equal(got.headers.get('content-type'), 'image/png');
    assert.equal((await client(s.base).get('/api/files/' + name)).status, 401);
    assert.equal((await ann.get('/api/files/../../users.json')).status, 404);
    assert.equal((await ann.get('/api/files/' + 'a'.repeat(32) + '.png')).status, 404);
  });

  test('an unfinished request is there again the next day, and counts as that day\'s work until it is touched', async () => {
    day('2026-12-08');
    const open = (await ann.get('/api/requests')).data.requests;
    assert.equal(open.length, 1);
    assert.equal(open[0].daysSinceTouched, 1); assert.equal(open[0].needsAttention, true); assert.equal(open[0].nextStep, 'Material ready'); assert.equal(open[0].touchedToday, false);
    let p = (await ann.get('/api/my-day')).data;
    assert.deepEqual(p.progress.requests, { done: 0, total: 1 });
    assert.equal(p.requests.length, 1, 'listed on My day');
    assert.equal((await admin.get('/api/dashboard')).data.team.find((t) => t.name === 'Ann').untouchedRequests, 1);
    assert.equal((await ann.post('/api/requests/' + id + '/note', { text: 'x' })).status, 400);
    assert.equal((await ann.post('/api/requests/' + id + '/note', { text: 'Customer will send the address tomorrow', nextDate: '2026-12-01' })).status, 400, 'not in the past');
    const noted = (await ann.post('/api/requests/' + id + '/note', { text: 'Customer will send the address tomorrow', nextDate: '2026-12-09' })).data.request;
    assert.equal(noted.notes.length, 1); assert.equal(noted.notes[0].byName, 'Ann'); assert.equal(noted.touchedToday, true); assert.equal(noted.needsAttention, false);
    p = (await ann.get('/api/my-day')).data;
    assert.deepEqual(p.progress.requests, { done: 1, total: 1 });
    day('2026-12-09');
    assert.equal((await ann.get('/api/requests')).data.requests[0].followUpDue, true, 'the date she set has come');
    await ann.put('/api/requests/' + id + '/steps/ready', { done: true });
    await ann.put('/api/requests/' + id + '/steps/dispatched', { done: true });
    const fin = (await ann.put('/api/requests/' + id + '/steps/done', { done: true })).data.request;
    assert.equal(fin.complete, true); assert.equal(fin.nextStep, 'Complete'); assert.equal(fin.progress.percent, 100);
    assert.equal((await ann.get('/api/requests')).data.requests.length, 0, 'finished requests leave the open list');
    assert.equal((await ann.get('/api/requests?filter=done')).data.requests.length, 1);
    assert.deepEqual((await ann.get('/api/my-day')).data.progress.requests, { done: 1, total: 1 }, 'finishing it today still counts as done');
    day('2026-12-10');
    assert.deepEqual((await ann.get('/api/my-day')).data.progress.requests, { done: 0, total: 0 }, 'and it is gone from tomorrow\'s work');
  });

  test('website orders from Zoho appear by themselves, ready to be picked, and tick from what Zoho says', async () => {
    day('2026-12-10');
    z.data.salesOrders[0].date = '2026-12-10'; z.data.salesOrders[0].createdTime = '2026-12-10T05:00:00.000Z';
    const r = (await raj.get('/api/requests')).data;
    assert.equal(r.zoho.ok, true);
    assert.equal(r.requests.length, 1, 'the 200 day old order is not pulled in');
    const o = r.requests[0];
    assert.equal(o.source, 'Website'); assert.equal(o.customerName, 'Web Buyer'); assert.equal(o.ownerId, ''); assert.equal(o.amount, 1180);
    assert.equal(o.steps.ask.by, 'Website'); assert.equal(o.steps.payment.by, 'Zoho'); assert.equal(o.progress.done, 3);
    assert.equal((await raj.get('/api/requests')).data.requests.length, 1, 'syncing again does not duplicate');
    assert.equal((await raj.post('/api/requests/' + o.id + '/pick')).status, 200);
    assert.equal((await ann.post('/api/requests/' + o.id + '/pick')).status, 400);
    z.data.salesOrders[0].shipped = 'fulfilled';
    const done = (await raj.get('/api/requests?filter=all')).data.requests.find((x) => x.id === o.id);
    assert.ok(done.steps.ready && done.steps.dispatched && done.steps.done); assert.equal(done.complete, true);
  });

  test('a request is for a new customer, or an existing one chosen from the Zoho list', async () => {
    const opts = (await ann.get('/api/customer-options')).data.customers;
    assert.deepEqual(opts.map((c) => c.name), ['Green Cells', 'New Prospect', 'Shakti Batteries', 'Volt Works'], 'sorted by name');
    assert.deepEqual(Object.keys(opts[0]).sort(), ['company', 'id', 'name', 'phone']);
    const old = (await ann.post('/api/requests', { customerType: 'existing', customerId: '1001', request: 'Repeat order, 50 kg', source: 'WhatsApp' })).data.request;
    assert.equal(old.customerType, 'existing'); assert.equal(old.customerId, '1001');
    assert.equal(old.customerName, 'Shakti Batteries', 'the details come from Zoho'); assert.equal(old.phone, '9811111111');
    const typed = (await ann.post('/api/requests', { customerType: 'existing', customerId: '1002', customerName: 'Volt Works (Pune unit)', phone: '9800000000' })).data.request;
    assert.equal(typed.customerName, 'Volt Works (Pune unit)', 'what is typed wins'); assert.equal(typed.customerId, '1002');
    const fresh = (await ann.post('/api/requests', { customerName: 'Brand New Buyer', phone: '9899900000' })).data.request;
    assert.equal(fresh.customerType, 'new'); assert.equal(fresh.customerId, '');
    assert.equal((await ann.post('/api/requests', { customerType: 'existing', customerId: '' })).status, 400, 'choose from the list');
    assert.equal((await ann.post('/api/requests', { customerType: 'existing', customerId: 'abc' })).status, 400);
    assert.equal((await ann.post('/api/requests', { customerType: 'existing', customerId: '999999' })).status, 400, 'not a Zoho customer');
    z.data.fail = true;
    const down = await ann.post('/api/requests', { customerType: 'existing', customerId: '1001' });
    assert.equal(down.status, 400); assert.match(down.data.error, /Zoho is not answering/);
    assert.equal((await ann.post('/api/requests', { customerName: 'New while Zoho is down' })).status, 200, 'a new customer never needs Zoho');
    assert.equal((await ann.get('/api/customer-options')).data.customers.length, 0); 
    z.data.fail = false;
  });

  test('the owner can assign requests; a team member cannot; and Zoho being down does not break the list', async () => {
    const r = (await admin.post('/api/requests', { customerName: 'Phone enquiry', source: 'Call' })).data.request;
    assert.equal(r.ownerId, '');
    assert.equal((await admin.post('/api/requests/' + r.id + '/assign', { ownerId: rajId })).data.request.ownerName, 'Raj');
    assert.equal((await raj.post('/api/requests/' + r.id + '/assign', { ownerId: annId })).status, 403);
    z.data.fail = true;
    const down = await raj.get('/api/requests');
    assert.equal(down.status, 200); assert.equal(down.data.zoho.ok, false); assert.ok(down.data.requests.length >= 1);
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
    assert.equal((await raj.post('/api/invoices/9004/pick')).status, 403, 'team members cannot pick invoices any more');
    assert.equal((await ann.get('/api/invoices')).data.invoices.every((i) => i.ownerId === annId), true, 'a team member only sees their own invoices');
    const sum = (await ann.get('/api/invoices')).data.summary, all = (await admin.get('/api/invoices')).data.summary;
    assert.ok(sum.unpaid < all.unpaid, 'and the figures at the top count only theirs');
    assert.deepEqual((await ann.get('/api/invoices/9001/history')).data.history, [], 'nor can they read the history of someone else invoice');
    assert.equal((await admin.post('/api/invoices/9004/assign', { ownerId: rajId })).status, 200);
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
  const day = (d) => { clock.date = d; };
  before(async () => { day('2026-12-14'); z = pretendZoho(); ({ s, admin, ann, raj, annId, rajId } = await team(z)); });
  after(() => { clock.date = null; return s.stop(); });

  test('tasks + follow-ups + customer requests are added up into one percentage', async () => {
    await admin.post('/api/templates', { name: 'Call 10 people', kind: 'rows', rowCount: 10, assignees: [annId, rajId] });
    const start = (await ann.get('/api/my-day')).data;
    assert.deepEqual(start.progress.overall, { done: 0, total: 10, percent: 0, left: 10 });
    const id = (await ann.get('/api/tasks')).data.tasks[0].id;
    for (let i = 0; i < 3; i++) await ann.put('/api/tasks/' + id + '/rows/' + i, { values: { name: 'P' + i } });
    await admin.post('/api/customers/1001/assign', { ownerId: annId });
    await admin.post('/api/customers/1002/assign', { ownerId: annId });
    await admin.post('/api/invoices/9001/assign', { ownerId: annId });
    const reqId = (await ann.post('/api/requests', { customerName: 'Fresh Customer', source: 'WhatsApp' })).data.request.id;
    day('2026-12-15'); // the request was logged yesterday, so today it is waiting
    for (let i = 3; i < 4; i++) await ann.put('/api/tasks/' + (await ann.get('/api/tasks')).data.tasks[0].id + '/rows/' + i, { values: { name: 'P' + i } });
    let p = (await ann.get('/api/my-day')).data.progress;
    assert.equal(p.tasks.total, 10 + 7, 'yesterday missed 7 of 10, so 7 carry'); assert.equal(p.tasks.done, 1);
    assert.deepEqual(p.customers, { done: 0, total: 2 });
    assert.deepEqual(p.invoices, { done: 0, total: 2 }, 'her own invoice and one that belongs to a customer she owns (both overdue by this date)'); assert.deepEqual(p.requests, { done: 0, total: 1 }); assert.deepEqual(p.followups, { done: 0, total: 0 });
    assert.deepEqual(p.overall, { done: 1, total: 22, percent: 5, left: 21 });
    await ann.post('/api/customers/1001/followup', { outcome: 'interested' });
    await ann.post('/api/invoices/9001/followup', { outcome: 'reminded' });
    await ann.post('/api/requests/' + reqId + '/note', { text: 'Asked for their requirement' });
    p = (await ann.get('/api/my-day')).data.progress;
    assert.deepEqual(p.customers, { done: 1, total: 2 }); assert.deepEqual(p.invoices, { done: 1, total: 2 }); assert.deepEqual(p.requests, { done: 1, total: 1 });
    assert.deepEqual(p.overall, { done: 4, total: 22, percent: 18, left: 18 });
    assert.equal((await raj.get('/api/my-day')).data.progress.overall.done, 0, 'each person has their own figure');
    assert.equal((await admin.get('/api/my-day')).status, 403);
  });

  test('a call follow-up that has come is part of the day\'s work until it is logged', async () => {
    day('2026-12-16');
    const r = await admin.post('/api/templates', { name: 'Visits', kind: 'rows', rowCount: 1, assignees: [rajId], columns: [{ label: 'Name', type: 'text', required: true }, { label: 'Follow-up date', type: 'date', followUp: true }] });
    assert.equal(r.status, 200);
    const v = (await raj.get('/api/tasks')).data.tasks.find((x) => x.name === 'Visits');
    await raj.put('/api/tasks/' + v.id + '/rows/0', { values: { name: 'Mr Rao', follow_up_date: '2026-12-17' } });
    const base = (await raj.get('/api/my-day')).data.progress.followups;
    assert.deepEqual(base, { done: 0, total: 0 });
    day('2026-12-17');
    assert.deepEqual((await raj.get('/api/my-day')).data.progress.followups, { done: 0, total: 1 });
    const due = (await raj.get('/api/followups-due')).data.followups[0];
    await raj.post('/api/tasks/' + due.taskId + '/rows/' + due.rowIndex + '/followup', { notes: 'Confirmed the visit' });
    assert.deepEqual((await raj.get('/api/my-day')).data.progress.followups, { done: 1, total: 1 });
  });

  test('on a day off nothing is expected, so only what was actually done counts', async () => {
    day('2026-12-20'); // Sunday
    const p = (await ann.get('/api/my-day')).data.progress;
    assert.equal(p.workDay, false);
    assert.deepEqual(p.requests, { done: 0, total: 0 }); assert.deepEqual(p.customers, { done: 0, total: 0 }); assert.deepEqual(p.invoices, { done: 0, total: 0 });
    assert.equal(p.overall.total, 0);
    assert.equal(p.overall.percent, null);
  });

  test('the dashboard shows each person: carried work, overdue follow-ups, open requests, and who has not started', async () => {
    day('2026-12-22'); // Tuesday
    const d = (await admin.get('/api/dashboard')).data;
    assert.equal(d.team.length, 2); assert.equal(d.workDay, true);
    const a = d.team.find((t) => t.name === 'Ann');
    assert.ok(a.carried > 0, 'carried-forward calls are shown'); assert.equal(a.openRequests, 1); assert.equal(a.oldestRequestDays >= 1, true); assert.equal(a.untouchedRequests, 1);
    assert.equal(typeof a.followupsOverdue, 'number');
    assert.deepEqual(d.alerts.notStarted.sort(), ['Ann', 'Raj'].sort());
    assert.equal(d.alerts.totalCustomers, 4); assert.equal(d.alerts.unassignedCustomers, 2);
    assert.equal(d.alerts.unpaidInvoices, 3); assert.equal(d.alerts.unassignedRequests, 0); assert.equal(d.alerts.openRequests, 1);
    assert.equal(typeof d.alerts.invoiceCompliance, 'number'); assert.equal(d.zoho.configured, true);
  });

  test('if Zoho is down the dashboard and My day still open', async () => {
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
    for (const f of ['core', 'dashboard', 'tasks', 'requests', 'customers', 'invoices', 'office', 'team']) {
      assert.ok(index.includes('/js/' + f + '.js'), f + ' is loaded by the page');
      assert.ok(fs.existsSync(path.join(ROOT, 'public', 'js', f + '.js')), f + '.js exists');
    }
    const login = fs.readFileSync(path.join(ROOT, 'public', 'login.html'), 'utf8');
    assert.ok(login.includes('/login.js') && login.includes('name="password"') && /noindex/.test(login));
    for (const m of ['team', 'tasks', 'requests', 'customers', 'invoices', 'office', 'dashboard']) assert.ok(fs.existsSync(path.join(ROOT, 'modules', m + '.js')), m + ' module');
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

describe('tasks created before carry-over existed', () => {
  test('carry forward by default, up to their own daily target', async () => {
    const z = pretendZoho();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-panel-legacy-'));
    clock.date = '2026-11-02';
    const app = createApp({ dataDir: dir, adminPassword: 'admin-secret-1', sessionSecret: 's', zoho: z });
    const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    const base = 'http://127.0.0.1:' + server.address().port;
    try {
      const admin = client(base), ann = client(base);
      await admin.post('/api/auth/login', { username: 'admin', password: 'admin-secret-1' });
      const annId = (await admin.post('/api/users', { name: 'Ann', username: 'ann', password: 'ann-password-1' })).data.user.id;
      await ann.post('/api/auth/login', { username: 'ann', password: 'ann-password-1' });
      // a design saved by the older version: no carry, maxCarry, base or carried fields
      fs.writeFileSync(path.join(dir, 'templates.json'), JSON.stringify([{ id: 't1', name: 'Call 10 people', kind: 'rows', schedule: 'daily', rowCount: 10, assignees: [annId], active: true, columns: [{ key: 'name', label: 'Name', type: 'text', required: true }], instructions: '', dueDate: '', createdAt: '2026-10-01T00:00:00.000Z' }]));
      await server.close(); // reload the files by starting again below
    } finally { /* the next app instance below reads the file */ }
    const app2 = createApp({ dataDir: dir, adminPassword: 'admin-secret-1', sessionSecret: 's', zoho: z });
    const server2 = await new Promise((r) => { const s = app2.listen(0, '127.0.0.1', () => r(s)); });
    const b2 = 'http://127.0.0.1:' + server2.address().port;
    try {
      const ann = client(b2); await ann.post('/api/auth/login', { username: 'ann', password: 'ann-password-1' });
      const mon = (await ann.get('/api/tasks')).data.tasks[0];
      assert.equal(mon.rows.length, 10);
      await ann.put('/api/tasks/' + mon.id + '/rows/0', { values: { name: 'One' } });
      clock.date = '2026-11-03';
      const tue = (await ann.get('/api/tasks')).data.tasks[0];
      assert.equal(tue.carried, 9); assert.equal(tue.rows.length, 19);
    } finally { clock.date = null; await new Promise((r) => server2.close(r)); }
  });
});

// ======================================================================
describe('working ahead, and the week view', () => {
  let s, admin, ann, raj, annId, rajId, presets;
  const day = (d) => { clock.date = d; };
  const getDay = async (who, d) => (await who.get('/api/tasks?date=' + d)).data;
  const call = (i, label) => ({ values: { name: label + i, phone: '9811111111', what_did_you_talk_about: 'Asked about BMS' } });
  before(async () => {
    day('2026-11-02'); // a Monday
    ({ s, admin, ann, raj, annId, rajId } = await team(pretendZoho()));
    presets = (await admin.get('/api/templates')).data.presets;
    const { id: _i, for: _f, ...body } = presets[0];
    await admin.post('/api/templates', { ...body, assignees: [annId, rajId] });
  });
  after(() => { clock.date = null; return s.stop(); });

  test('tomorrow can be filled in today; the carry-over is added when the day arrives and nothing already written is lost', async () => {
    const mon = (await getDay(ann, '2026-11-02')).tasks[0];
    for (let i = 0; i < 8; i++) await ann.put('/api/tasks/' + mon.id + '/rows/' + i, call(i, 'Today '));
    const ahead = await getDay(ann, '2026-11-03');
    assert.equal(ahead.ahead, true);
    const tue = ahead.tasks[0];
    assert.equal(tue.rows.length, 10); assert.equal(tue.carried, 0); assert.equal(tue.ahead, true);
    for (let i = 0; i < 4; i++) assert.equal((await ann.put('/api/tasks/' + tue.id + '/rows/' + i, call(i, 'Ahead '))).status, 200);
    day('2026-11-03'); // tomorrow has arrived; yesterday ended 2 short
    const arrived = (await getDay(ann, '2026-11-03')).tasks[0];
    assert.equal(arrived.id, tue.id, 'the same sheet');
    assert.equal(arrived.rows.length, 12); assert.equal(arrived.carried, 2); assert.ok(!arrived.ahead);
    assert.equal(arrived.progress.done, 4); assert.equal(arrived.rows[0].values.name, 'Ahead 0');
    assert.equal((await getDay(raj, '2026-11-03')).tasks[0].rows.length, 20, 'Raj did nothing yesterday: his own carry is unaffected');
  });

  test('a week ahead is the limit, Sundays have no sheet, and the owner can look anywhere', async () => {
    assert.equal((await ann.get('/api/tasks?date=2026-11-10')).status, 200, 'exactly a week ahead is fine');
    const far = await ann.get('/api/tasks?date=2026-11-11');
    assert.equal(far.status, 400); assert.match(far.data.error, /week ahead/);
    const sun = await getDay(ann, '2026-11-08');
    assert.equal(sun.workDay, false); assert.deepEqual(sun.tasks, []);
    assert.equal((await admin.get('/api/tasks?userId=' + annId + '&date=2026-12-01')).status, 200);
  });

  test('the week view: Monday to Sunday, done and total for each day, planned work for days ahead', async () => {
    const w = (await ann.get('/api/week')).data;
    assert.equal(w.weekStart, '2026-11-02'); assert.equal(w.weekEnd, '2026-11-08'); assert.equal(w.days.length, 7);
    const [mon, tue, wed, , , sat, sun] = w.days;
    assert.deepEqual([mon.done, mon.total, mon.isToday, mon.isFuture], [8, 10, false, false]);
    assert.deepEqual([tue.done, tue.total, tue.isToday], [4, 12, true]);
    assert.equal(wed.planned, true); assert.equal(wed.total, 10); assert.equal(wed.isFuture, true); assert.equal(wed.done, 0);
    assert.equal(sat.planned, true);
    assert.deepEqual([sun.isWorkDay, sun.total, sun.percent], [false, 0, null]);
    assert.deepEqual(w.totals, { done: 12, total: 62 });
    assert.ok(w.days.every((d) => d.editable));
    assert.equal(w.minDate, '2026-10-27'); assert.equal(w.maxDate, '2026-11-10');
    await getDay(ann, '2026-11-04'); // open Wednesday: the planned sheet becomes a real one
    assert.equal((await ann.get('/api/week')).data.days[2].planned, false);
    assert.equal((await ann.get('/api/week?userId=' + rajId)).data.days[1].total, 12, 'asking for another person\'s week still returns your own');
    assert.equal((await admin.get('/api/week')).status, 400, 'the owner chooses whose week');
    assert.equal((await admin.get('/api/week?userId=' + rajId)).data.days[1].total, 20);
    assert.equal((await ann.get('/api/week?date=2026-11-09')).data.weekStart, '2026-11-09', 'next week');
  });

  test('next week\'s weekly task can be started early, and gets the leftover when the week begins', async () => {
    const { id: _i, for: _f, ...insta } = presets[2];
    await admin.post('/api/templates', { ...insta, assignees: [annId] });
    const thisWeek = (await getDay(ann, '2026-11-03')).tasks.find((t) => t.name === 'Schedule 6 Instagram posts');
    assert.equal(thisWeek.date, '2026-11-02');
    for (let i = 0; i < 3; i++) await ann.put('/api/tasks/' + thisWeek.id + '/rows/' + i, { values: { post_topic: 'Post ' + i } });
    const nextWeek = (await getDay(ann, '2026-11-09')).tasks.find((t) => t.name === 'Schedule 6 Instagram posts');
    assert.equal(nextWeek.date, '2026-11-09'); assert.equal(nextWeek.ahead, true); assert.equal(nextWeek.rows.length, 6);
    for (let i = 0; i < 2; i++) await ann.put('/api/tasks/' + nextWeek.id + '/rows/' + i, { values: { post_topic: 'Early ' + i } });
    assert.equal((await ann.get('/api/week?date=2026-11-09')).data.weekly[0].done, 2);
    day('2026-11-09');
    const arrived = (await getDay(ann, '2026-11-09')).tasks.find((t) => t.name === 'Schedule 6 Instagram posts');
    assert.equal(arrived.id, nextWeek.id); assert.equal(arrived.carried, 3); assert.equal(arrived.rows.length, 9); assert.equal(arrived.progress.done, 2);
  });
});

describe('deleting a task', () => {
  let s, admin, ann, raj, annId, rajId;
  before(async () => { ({ s, admin, ann, raj, annId, rajId } = await team(pretendZoho())); });
  after(() => s.stop());

  test('switching off keeps the work; deleting removes the task and all the work under it, for everybody', async () => {
    const keep = (await admin.post('/api/templates', { name: 'Keep me', kind: 'count', target: 2, assignees: [annId] })).data.template;
    const gone = (await admin.post('/api/templates', { name: 'Delete me', kind: 'rows', rowCount: 3, assignees: [annId, rajId] })).data.template;
    const mine = (await ann.get('/api/tasks')).data.tasks.find((t) => t.name === 'Delete me');
    await ann.put('/api/tasks/' + mine.id + '/rows/0', { values: { name: 'Somebody' } });
    assert.equal((await ann.get('/api/my-day')).data.progress.tasks.total, 5, '2 + 3');
    assert.equal((await ann.del('/api/templates/' + gone.id + '?permanent=1')).status, 403, 'only the owner');
    assert.equal((await raj.del('/api/templates/' + gone.id)).status, 403);
    // switching off keeps the template and the work
    assert.equal((await admin.del('/api/templates/' + gone.id)).data.ok, true);
    assert.equal((await admin.get('/api/templates')).data.templates.find((t) => t.id === gone.id).active, false);
    assert.ok((await ann.get('/api/tasks')).data.tasks.some((t) => t.name === 'Delete me'));
    // deleting is for good
    const d = (await admin.del('/api/templates/' + gone.id + '?permanent=1')).data;
    assert.equal(d.deleted, true); assert.equal(d.removedWork, 2, 'one day of work for each of the two people');
    assert.equal((await admin.get('/api/templates')).data.templates.some((t) => t.id === gone.id), false);
    assert.equal((await ann.get('/api/tasks')).data.tasks.some((t) => t.name === 'Delete me'), false);
    assert.equal((await raj.get('/api/tasks')).data.tasks.length, 0);
    assert.equal((await ann.get('/api/my-day')).data.progress.tasks.total, 2, 'it no longer counts toward the day');
    assert.ok((await ann.get('/api/tasks')).data.tasks.some((t) => t.name === 'Keep me'), 'other tasks are untouched');
    assert.equal((await admin.del('/api/templates/' + gone.id + '?permanent=1')).status, 404, 'already gone');
    assert.ok((await admin.get('/api/activity')).data.activity.some((a) => /Deleted the task "Delete me" and 2 days of work/.test(a.text)));
    assert.equal(keep.name, 'Keep me');
  });

  test('a quick one-time task can be deleted too', async () => {
    const t = (await admin.post('/api/templates', { name: 'Send price list', kind: 'checklist', steps: ['Send'], schedule: 'once', assignees: [annId, rajId], adhoc: true })).data.template;
    assert.equal((await raj.get('/api/tasks')).data.tasks.length, 1);
    assert.equal((await admin.del('/api/templates/' + t.id + '?permanent=1')).data.removedWork, 2);
    assert.equal((await raj.get('/api/tasks')).data.tasks.length, 0);
  });
});

describe('sharing customers fairly between the team', () => {
  let s, z, admin, ann, raj, annId, rajId;
  const inv = (id, cust, total, status = 'paid') => ({ id: String(id), number: 'INV-' + id, customerId: String(cust), customerName: 'Customer ' + cust, date: '2026-09-01', dueDate: '2026-09-15', total, balance: 0, status, phone: '', email: '' });
  before(async () => {
    z = pretendZoho();
    // 6 regular customers (2 or more invoices, different sizes), 7 others (one invoice, a void one, or none)
    z.data.contacts = []; for (let c = 3001; c <= 3013; c++) z.data.contacts.push({ id: String(c), name: 'Customer ' + c, company: '', phone: '', email: '' });
    z.data.invoices = [];
    let n = 1;
    const sizes = { 3001: 900000, 3002: 600000, 3003: 300000, 3004: 100000, 3005: 50000, 3006: 20000 };
    for (const c of Object.keys(sizes)) { z.data.invoices.push(inv(n++, c, sizes[c] / 2)); z.data.invoices.push(inv(n++, c, sizes[c] / 2)); }
    for (let c = 3007; c <= 3010; c++) z.data.invoices.push(inv(n++, c, 5000));
    z.data.invoices.push(inv(n++, 3011, 5000)); z.data.invoices.push(inv(n++, 3011, 5000, 'void')); // one real invoice and a void one: not regular
    ({ s, admin, ann, raj, annId, rajId } = await team(z)); // 3012 and 3013 have never been invoiced
  });
  after(() => s.stop());
  const owners = async () => { const c = (await admin.get('/api/customers')).data.customers; return { regular: c.filter((x) => x.regular), other: c.filter((x) => !x.regular) }; };
  const split = (g) => ['Lokesh', 'Vikas'].map((_, i) => g.filter((x) => x.ownerId === [annId, rajId][i]).length);

  test('regular means invoiced 2 or more times (void and draft do not count)', async () => {
    const o = await owners();
    assert.deepEqual(o.regular.map((c) => c.id).sort(), ['3001', '3002', '3003', '3004', '3005', '3006']);
    assert.equal(o.other.length, 7); assert.ok(o.other.some((c) => c.id === '3011'), 'one real invoice plus a void one is occasional');
    assert.ok(o.other.some((c) => c.id === '3012'), 'never invoiced is occasional');
  });

  test('regular customers are split evenly, the others are split evenly on their own, and the big ones are spread', async () => {
    const r = (await admin.post('/api/customers/auto-assign')).data;
    assert.equal(r.assigned, 13); assert.equal(r.regularMinInvoices, 2);
    assert.deepEqual(r.groups.regular.perPerson.map((p) => p.count), [3, 3]);
    assert.deepEqual(r.groups.other.perPerson.map((p) => p.count).sort(), [3, 4]);
    const o = await owners();
    assert.deepEqual(split(o.regular), [3, 3]); assert.deepEqual(split(o.other).sort(), [3, 4]);
    const [a, b] = r.groups.regular.perPerson.map((p) => p.billed);
    assert.ok(Math.abs(a - b) <= 400000, 'the value is spread too, not just the number: ' + a + ' vs ' + b);
    const top3 = ['3001', '3002', '3003'].map((id) => o.regular.find((c) => c.id === id).ownerId);
    assert.ok(new Set(top3).size === 2, 'the three biggest customers are not all with one person');
    const total = split(o.regular.concat(o.other)); assert.ok(Math.abs(total[0] - total[1]) <= 1, 'and the overall totals are within one');
    assert.equal((await admin.post('/api/customers/auto-assign')).data.assigned, 0, 'nothing left to share');
  });

  test('customers who already have an owner stay, and the rest are shared so each kind still comes out even', async () => {
    await admin.post('/api/customers/auto-assign', { all: true }); // start from scratch, then change it by hand
    for (const id of ['3001', '3002', '3003']) await admin.post('/api/customers/' + id + '/assign', { ownerId: annId });
    for (const id of ['3004', '3005', '3006']) await admin.post('/api/customers/' + id + '/assign', { ownerId: '' });
    const r = (await admin.post('/api/customers/auto-assign')).data;
    assert.equal(r.groups.regular.assigned, 3, 'only the three that had no owner');
    const o = await owners();
    assert.deepEqual(split(o.regular), [3, 3], 'Lokesh already had three, so the three left all went to Vikas');
    assert.ok(['3001', '3002', '3003'].every((id) => o.regular.find((c) => c.id === id).ownerId === annId), 'nobody was taken away from');
  });

  test('"re-split everything" removes the owners first and starts again; members cannot do it', async () => {
    assert.equal((await ann.post('/api/customers/auto-assign', { all: true })).status, 403);
    const r = (await admin.post('/api/customers/auto-assign', { all: true })).data;
    assert.equal(r.assigned, 13);
    const o = await owners();
    assert.deepEqual(split(o.regular), [3, 3]); assert.deepEqual(split(o.other).sort(), [3, 4]);
    assert.ok((await admin.get('/api/activity')).data.activity.some((a) => /Re-split all customers between the team: 6 regular and 7 others, 13 assigned/.test(a.text)));
  });

  test('the owner gets the counts for the pie charts; team members do not', async () => {
    await admin.post('/api/customers/auto-assign', { all: true });
    const o = (await admin.get('/api/customers')).data.counts.owners;
    assert.deepEqual(o.map((x) => x.name), ['Nobody yet', 'Ann', 'Raj'].filter((n) => o.some((x) => x.name === n)));
    const sum = (k) => o.reduce((s, x) => s + x[k], 0);
    assert.equal(sum('regular'), 6); assert.equal(sum('other'), 7);
    assert.equal(o.find((x) => x.name === 'Nobody yet').regular + o.find((x) => x.name === 'Nobody yet').other, 0);
    assert.equal((await ann.get('/api/customers')).data.counts.owners, undefined);
  });

  test('with three people nobody gets most of a kind either', async () => {
    const third = (await admin.post('/api/users', { name: 'Meena', username: 'meena', password: 'meena-password-1' })).data.user.id;
    await admin.post('/api/customers/auto-assign', { all: true });
    const o = await owners(); const ids = [annId, rajId, third];
    const counts = (g) => ids.map((id) => g.filter((x) => x.ownerId === id).length).sort();
    assert.deepEqual(counts(o.regular), [2, 2, 2]); assert.deepEqual(counts(o.other), [2, 2, 3]);
  });
});

describe('deleting a customer request', () => {
  let s, z, admin, ann, annId;
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  before(async () => { z = pretendZoho(); ({ s, admin, ann, annId } = await team(z)); });
  after(() => s.stop());

  test('only the owner can delete; the request and its screenshot are gone', async () => {
    const id = (await ann.post('/api/requests', { customerName: 'Typo Traders', request: 'test' })).data.request.id;
    const name = (await ann.post('/api/requests/' + id + '/screenshot', { dataUrl: PNG })).data.request.screenshots[0].name;
    assert.equal((await ann.get('/api/files/' + name)).status, 200);
    assert.equal((await ann.del('/api/requests/' + id)).status, 403, 'team members cannot delete');
    assert.equal((await admin.del('/api/requests/nope')).status, 404);
    assert.equal((await admin.del('/api/requests/' + id)).status, 200);
    assert.ok(!(await admin.get('/api/requests?filter=all')).data.requests.some((r) => r.id === id));
    assert.equal((await ann.get('/api/files/' + name)).status, 404, 'the screenshot file is removed too');
    assert.ok((await admin.get('/api/activity')).data.activity.some((a) => /Deleted the customer request from Typo Traders/.test(a.text)));
  });

  test('a deleted website order does not come back from Zoho', async () => {
    const web = (await admin.get('/api/requests?filter=all')).data.requests.find((r) => r.source === 'Website');
    assert.ok(web, 'the website order was pulled in');
    assert.equal((await admin.del('/api/requests/' + web.id)).status, 200);
    assert.ok(!(await admin.get('/api/requests?filter=all&refresh=1')).data.requests.some((r) => r.source === 'Website'));
  });
});
