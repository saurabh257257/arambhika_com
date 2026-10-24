'use strict';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp, todayIST } = require('../app');

const ROOT = path.join(__dirname, '..');
let server, base, dataDir;

// a tiny cookie-keeping client
function client() {
  let cookie = '';
  const call = async (method, url, body, headers = {}) => {
    const res = await fetch(base + url, {
      method, redirect: 'manual',
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (set.length) { const c = set[0].split(';')[0]; cookie = c.endsWith('=') ? '' : c; }
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : await res.text();
    return { status: res.status, data, location: res.headers.get('location') };
  };
  return { get: (u) => call('GET', u), post: (u, b) => call('POST', u, b), put: (u, b) => call('PUT', u, b), patch: (u, b) => call('PATCH', u, b), del: (u) => call('DELETE', u), raw: call };
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-panel-'));
  const app = createApp({ dataDir, adminPassword: 'admin-secret-1', sessionSecret: 'test-secret' });
  await new Promise((r) => { server = app.listen(0, '127.0.0.1', r); });
  base = 'http://127.0.0.1:' + server.address().port;
});
after(() => new Promise((r) => server.close(r)));

describe('locked to staff', () => {
  test('every page and API needs a sign-in; only the login page is open', async () => {
    const c = client();
    for (const u of ['/api/me', '/api/tasks', '/api/transactions', '/api/daily', '/api/users', '/api/overview', '/api/routine']) {
      assert.equal((await c.get(u)).status, 401, u);
    }
    for (const u of ['/', '/panel.js', '/index.html']) {
      const r = await c.get(u); assert.equal(r.status, 302, u); assert.equal(r.location, '/login.html');
    }
    assert.equal((await c.get('/login.html')).status, 200);
    assert.equal((await c.get('/package.json')).status, 404);
    assert.equal((await c.get('/app.js')).status, 404, 'the server source is never served');
    assert.match((await c.raw('GET', '/health')).data.status, /ok/);
  });

  test('refuses to start without a password', () => {
    assert.throws(() => createApp({ dataDir, adminPassword: '' }), /ADMIN_PASSWORD/);
  });

  test('wrong passwords are refused and repeated tries are slowed down', async () => {
    const c = client();
    assert.equal((await c.post('/api/auth/login', { username: 'admin', password: 'nope' })).status, 401);
    let last;
    for (let i = 0; i < 12; i++) last = await c.post('/api/auth/login', { username: 'admin', password: 'nope' + i });
    assert.equal(last.status, 429);
  });

  test('a forged or tampered session cookie is not accepted', async () => {
    const c = client();
    const forged = Buffer.from(JSON.stringify({ id: 'admin', exp: Date.now() + 1e9 })).toString('base64url') + '.AAAA';
    assert.equal((await c.raw('GET', '/api/me', undefined, { Cookie: 'ap_session=' + forged })).status, 401);
  });

  test('state changes must be JSON', async () => {
    const c = client();
    const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' });
    assert.equal(r.status, 415);
  });
});

describe('the whole working day', () => {
  const admin = client(), ann = client(), raj = client();
  let annId, rajId, dir2, server2, oldBase;

  // its own app and data folder, so the sign-in limit used up by the earlier tests does not apply
  before(async () => {
    dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-panel2-'));
    const app2 = createApp({ dataDir: dir2, adminPassword: 'admin-secret-1', sessionSecret: 'test-secret-2' });
    await new Promise((r) => { server2 = app2.listen(0, '127.0.0.1', r); });
    oldBase = base;
    base = 'http://127.0.0.1:' + server2.address().port;
  });
  after(async () => { await new Promise((r) => server2.close(r)); base = oldBase; });

  test('admin signs in', async () => {
    assert.equal((await admin.post('/api/auth/login', { username: 'admin', password: 'admin-secret-1' })).status, 200);
    const me = (await admin.get('/api/me')).data;
    assert.equal(me.user.role, 'admin');
    assert.equal(me.today, todayIST());
  });

  test('admin creates two employees; passwords are stored hashed', async () => {
    assert.equal((await admin.post('/api/users', { name: 'Ann', username: 'ann', password: 'short' })).status, 400);
    assert.equal((await admin.post('/api/users', { name: 'X', username: 'admin', password: 'longenough1' })).status, 400);
    annId = (await admin.post('/api/users', { name: 'Ann', username: 'Ann', password: 'ann-password-1' })).data.user.id;
    rajId = (await admin.post('/api/users', { name: 'Raj', username: 'raj', password: 'raj-password-1' })).data.user.id;
    assert.equal((await admin.post('/api/users', { name: 'Ann 2', username: 'ann', password: 'ann-password-2' })).status, 400, 'username is unique');
    const file = fs.readFileSync(path.join(dir2, 'users.json'), 'utf8');
    assert.ok(!file.includes('ann-password-1') && file.includes('passHash'));
    assert.equal((await ann.post('/api/auth/login', { username: 'ann', password: 'wrong-password' })).status, 401);
    assert.equal((await ann.post('/api/auth/login', { username: 'ann', password: 'ann-password-1' })).status, 200);
    assert.equal((await raj.post('/api/auth/login', { username: 'raj', password: 'raj-password-1' })).status, 200);
    assert.equal((await ann.get('/api/me')).data.user.role, 'employee');
  });

  test('employees cannot reach admin features', async () => {
    for (const [m, u, b] of [['get', '/api/users'], ['get', '/api/overview'], ['put', '/api/routine', { items: [{ name: 'x', target: 1 }] }], ['post', '/api/tasks', { title: 't', assigneeId: annId }], ['post', '/api/users', { name: 'n', username: 'nnn', password: 'password123' }]]) {
      assert.equal((await ann[m](u, b)).status, 403, m + ' ' + u);
    }
  });

  test('the daily routine: counts, call log, targets and history', async () => {
    const today = todayIST();
    const rec = (await ann.get('/api/daily')).data;
    assert.deepEqual(rec.items.map((i) => i.id), ['calls', 'instagram', 'website', 'invoices']);
    assert.equal(rec.items[0].target, 10);
    // ten calls make the calls job done
    for (let i = 1; i <= 10; i++) await ann.post('/api/calls', { date: today, person: 'Person ' + i, phone: '98765432' + String(10 + i), outcome: 'Spoke' });
    assert.equal((await ann.post('/api/calls', { date: today, person: '' })).status, 400);
    assert.equal((await ann.post('/api/calls', { date: today, person: 'Bad', phone: 'abc' })).status, 400);
    let after = (await ann.put('/api/daily', { date: today, itemId: 'instagram', count: 2, notes: 'Boosted the BMS post' })).data;
    assert.equal(after.items[0].count, 10); assert.ok(after.items[0].done);
    assert.equal(after.items[1].count, 2); assert.equal(after.items[1].notes, 'Boosted the BMS post');
    assert.equal(after.calls.length, 10);
    assert.equal((await ann.put('/api/daily', { date: today, itemId: 'calls', count: 5 })).status, 400, 'the call count comes from the call log');
    assert.equal((await ann.put('/api/daily', { date: today, itemId: 'instagram', count: -1 })).status, 400);
    assert.equal((await ann.put('/api/daily', { date: '2099-01-01', itemId: 'instagram', count: 1 })).status, 400, 'no future days');
    assert.equal((await ann.put('/api/daily', { date: '2020-01-01', itemId: 'instagram', count: 1 })).status, 400, 'no very old days');
    // yesterday can still be filled in
    const y = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    assert.equal((await ann.put('/api/daily', { date: y, itemId: 'website', count: 1, notes: 'late entry' })).status, 200);
    const hist = (await ann.get('/api/history?days=3')).data.days;
    assert.equal(hist.length, 3); assert.equal(hist[0].date, today); assert.ok(hist[0].active); assert.ok(hist[1].active);
    // privacy between employees, and the admin can look at anyone
    assert.equal((await raj.get('/api/daily')).data.items[0].count, 0);
    assert.equal((await admin.get('/api/daily?userId=' + annId)).data.items[0].count, 10);
    assert.equal((await admin.get('/api/daily')).status, 400, 'admin must choose an employee');
    // deleting a call
    const callId = after.calls[0].id;
    assert.equal((await raj.del('/api/calls/' + callId)).status, 404, 'cannot remove someone else\'s call');
    assert.equal((await ann.del('/api/calls/' + callId)).data.calls.length, 9);
  });

  test('the admin edits the routine; the calls job stays', async () => {
    const items = (await admin.get('/api/routine')).data.items;
    items[0].target = 12; items[1].name = 'Run Instagram ads';
    items.push({ name: 'Reply to enquiries', target: 5, unit: 'replies' });
    const r = (await admin.put('/api/routine', { items })).data.items;
    assert.equal(r.find((i) => i.id === 'calls').target, 12);
    assert.equal(r.length, 5);
    const withoutCalls = r.filter((i) => i.id !== 'calls');
    const kept = (await admin.put('/api/routine', { items: withoutCalls })).data.items;
    assert.ok(kept.some((i) => i.id === 'calls'), 'the calls job cannot be removed');
    assert.equal((await admin.put('/api/routine', { items: [{ name: '', target: 1 }] })).status, 400);
  });

  test('tasks and sub-tasks: admin creates and assigns, each employee sees only theirs', async () => {
    const t = (await admin.post('/api/tasks', { title: 'Update BMS prices', assigneeId: annId, due: '2030-01-01', priority: 'high' })).data.task;
    const sub = (await admin.post('/api/tasks', { title: 'Check JBD list', parentId: t.id })).data.task;
    assert.equal(sub.assigneeId, annId, 'a sub-task starts with the main task\'s owner');
    await admin.post('/api/tasks', { title: 'Raj task', assigneeId: rajId });
    assert.equal((await admin.post('/api/tasks', { title: 'Nobody', assigneeId: 'zzz' })).status, 400);
    assert.equal((await admin.post('/api/tasks', { title: 'Deep', parentId: sub.id })).status, 400, 'only one level of sub-tasks');
    const mine = (await ann.get('/api/tasks')).data.tasks;
    assert.deepEqual(mine.map((x) => x.title).sort(), ['Check JBD list', 'Update BMS prices']);
    assert.equal((await raj.get('/api/tasks')).data.tasks.length, 1);
    // an employee can move status and add a note, but not change the task itself
    assert.equal((await ann.patch('/api/tasks/' + sub.id, { status: 'done', note: 'Done, 4 prices changed', title: 'Hacked', assigneeId: rajId })).status, 200);
    const after = (await admin.get('/api/tasks')).data.tasks.find((x) => x.id === sub.id);
    assert.equal(after.status, 'done'); assert.equal(after.note, 'Done, 4 prices changed'); assert.equal(after.title, 'Check JBD list'); assert.equal(after.assigneeId, annId);
    assert.ok(after.doneAt);
    assert.equal((await raj.patch('/api/tasks/' + t.id, { status: 'done' })).status, 404, 'not Raj\'s task');
    assert.equal((await ann.del('/api/tasks/' + t.id)).status, 403);
    // reassigning a task moves its sub-tasks too
    await admin.patch('/api/tasks/' + t.id, { assigneeId: rajId });
    assert.equal((await raj.get('/api/tasks')).data.tasks.length, 3);
    assert.equal((await ann.get('/api/tasks')).data.tasks.length, 0);
    // deleting the main task removes its sub-tasks
    assert.equal((await admin.del('/api/tasks/' + t.id)).status, 200);
    assert.equal((await admin.get('/api/tasks')).data.tasks.length, 1);
  });

  test('office: transactions go to the admin for approval', async () => {
    const bad = await ann.post('/api/transactions', { amount: 0, party: 'Shop' });
    assert.equal(bad.status, 400);
    assert.equal((await ann.post('/api/transactions', { amount: 500, party: '' })).status, 400);
    assert.equal((await ann.post('/api/transactions', { amount: 500, party: 'Shop', date: '2099-01-01' })).status, 400);
    const t1 = (await ann.post('/api/transactions', { type: 'expense', amount: 1250.5, party: 'Courier', description: 'Samples to Pune' })).data.transaction;
    const t2 = (await ann.post('/api/transactions', { type: 'purchase', amount: 300, party: 'Stationery' })).data.transaction;
    assert.equal(t1.status, 'pending');
    assert.equal((await admin.post('/api/transactions', { amount: 5, party: 'x' })).status, 403, 'only employees add');
    assert.equal((await raj.get('/api/transactions')).data.transactions.length, 0);
    assert.equal((await ann.put('/api/transactions/' + t2.id, { type: 'purchase', amount: 350, party: 'Stationery' })).data.transaction.amount, 350);
    assert.equal((await ann.post('/api/transactions/' + t1.id + '/decision', { status: 'approved' })).status, 403, 'employees cannot approve');
    const pending = (await admin.get('/api/transactions?status=pending')).data.transactions;
    assert.equal(pending.length, 2); assert.equal(pending[0].userName, 'Ann');
    assert.equal((await admin.post('/api/transactions/' + t1.id + '/decision', { status: 'approved', remark: 'OK' })).data.transaction.status, 'approved');
    assert.equal((await admin.post('/api/transactions/' + t2.id + '/decision', { status: 'rejected', remark: 'Not needed' })).data.transaction.remark, 'Not needed');
    assert.equal((await ann.put('/api/transactions/' + t1.id, { amount: 1, party: 'x' })).status, 400, 'a decided transaction is locked');
    assert.equal((await ann.del('/api/transactions/' + t1.id)).status, 400);
    assert.equal((await admin.post('/api/transactions/' + t1.id + '/decision', { status: 'maybe' })).status, 400);
    const mine = (await ann.get('/api/transactions')).data.transactions;
    assert.deepEqual(mine.map((t) => t.status).sort(), ['approved', 'rejected']);
  });

  test('the overview shows each employee\'s day, tasks and waiting approvals', async () => {
    await ann.post('/api/transactions', { amount: 99, party: 'Tea' });
    const o = (await admin.get('/api/overview')).data;
    assert.equal(o.employees.length, 2);
    assert.equal(o.pendingApprovals, 1);
    const a = o.employees.find((e) => e.user.name === 'Ann');
    assert.equal(a.pendingTransactions, 1);
    assert.equal(a.items.find((i) => i.id === 'calls').count, 9);
  });

  test('a switched-off employee is locked out immediately', async () => {
    assert.equal((await admin.patch('/api/users/' + rajId, { active: false })).data.user.active, false);
    assert.equal((await raj.get('/api/me')).status, 401);
    assert.equal((await client().post('/api/auth/login', { username: 'raj', password: 'raj-password-1' })).status, 401);
    await admin.patch('/api/users/' + rajId, { active: true, password: 'new-password-9' });
    assert.equal((await client().post('/api/auth/login', { username: 'raj', password: 'new-password-9' })).status, 200);
  });

  test('data survives a restart: it is in JSON files', async () => {
    const dir = dir2;
    for (const f of ['users', 'routine', 'entries', 'calls', 'tasks', 'transactions']) {
      assert.ok(Array.isArray(JSON.parse(fs.readFileSync(path.join(dir, f + '.json'), 'utf8'))), f);
    }
    const again = createApp({ dataDir: dir, adminPassword: 'admin-secret-1', sessionSecret: 'test-secret-2' });
    const s = await new Promise((r) => { const x = again.listen(0, '127.0.0.1', () => r(x)); });
    const saved = base; base = 'http://127.0.0.1:' + s.address().port;
    const c = client();
    await c.post('/api/auth/login', { username: 'ann', password: 'ann-password-1' });
    assert.equal((await c.get('/api/transactions')).data.transactions.length, 3);
    base = saved; s.close();
  });
});

describe('the screens', () => {
  test('the page files exist and use the shared script', () => {
    const index = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
    assert.ok(index.includes('/panel.js') && index.includes('/style.css'));
    const login = fs.readFileSync(path.join(ROOT, 'public', 'login.html'), 'utf8');
    assert.ok(login.includes('/login.js') && login.includes('name="password"') && /noindex/.test(login));
  });
});

describe('deployment is dev only', () => {
  const repo = path.join(ROOT, '..', '..');
  test('the deploy script refuses anything but dev, skips without a password and creates the web address', () => {
    const sh = fs.readFileSync(path.join(repo, 'scripts', 'deploy-admin.sh'), 'utf8');
    assert.ok(sh.includes('"$DEPLOY_ENV" != "dev"') && sh.includes('exit 1'));
    assert.ok(sh.includes('ADMIN_PANEL_PASSWORD is not set') && sh.includes('exit 0'));
    assert.ok(sh.includes('admin.arambhika.com') && sh.includes('certbot --nginx') && sh.includes('DATA_DIR='));
    assert.ok(!/production/i.test(sh.replace(/never to production|production by mistake/gi, '')), 'no production target');
  });
  test('the workflow runs on dev only and has no production job', () => {
    const wf = fs.readFileSync(path.join(repo, '.github', 'workflows', 'admin-panel-dev.yml'), 'utf8');
    assert.ok(wf.includes('branches: [dev]') && wf.includes('environment: dev') && !/environment:\s*production/.test(wf));
    assert.ok(wf.includes('ADMIN_PANEL_PASSWORD') && wf.includes('ADMIN_PANEL_SESSION_SECRET'));
  });
});
