'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../app');

function client(base) {
  let cookie = '';
  const call = async (method, url, body) => {
    const res = await fetch(base + url, { method, redirect: 'manual', headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (set.length) { const c = set[0].split(';')[0]; cookie = c.endsWith('=') ? '' : c; }
    const type = res.headers.get('content-type') || '';
    return { status: res.status, headers: res.headers, data: type.includes('json') ? await res.json() : await res.text(), location: res.headers.get('location') };
  };
  return { get: (u) => call('GET', u), post: (u, b) => call('POST', u, b === undefined ? {} : b), patch: (u, b) => call('PATCH', u, b) };
}
async function boot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-'));
  const app = createApp({ dataDir: dir, adminPassword: 'admin-secret-1', sessionSecret: 'test-secret' });
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const admin = client(base), ann = client(base);
  await admin.post('/api/auth/login', { username: 'admin', password: 'admin-secret-1' });
  return { app, base, admin, ann, stop: () => new Promise((r) => server.close(() => { app.repo.close(); r(); })) };
}

describe('portal', () => {
  test('refuses to start without an admin password; sign-in is required everywhere', async () => {
    assert.throws(() => createApp({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'portal-')), adminPassword: '' }), /ADMIN_PASSWORD/);
    const s = await boot();
    try {
      const anon = client(s.base);
      assert.equal((await anon.get('/api/customers')).status, 401);
      assert.equal((await anon.get('/portal.js')).status, 302);
      assert.equal((await anon.get('/health')).data.status, 'ok');
      assert.equal((await anon.post('/api/auth/login', { username: 'admin', password: 'nope' })).status, 401);
    } finally { await s.stop(); }
  });

  test('the admin creates members with passwords; only the admin can; a member signs in with them', async () => {
    const s = await boot();
    try {
      assert.equal((await s.admin.post('/api/members', { name: 'Lokesh', username: 'lokesh', password: 'short' })).status, 400, 'short password');
      assert.equal((await s.admin.post('/api/members', { name: 'X', username: 'admin', password: 'long-enough-pw' })).status, 400, 'reserved name');
      const m = (await s.admin.post('/api/members', { name: 'Lokesh', username: 'Lokesh', password: 'lokesh-pass-1234' })).data.member;
      assert.equal(m.username, 'lokesh');
      assert.equal((await s.admin.post('/api/members', { name: 'Again', username: 'lokesh', password: 'lokesh-pass-1234' })).status, 400, 'username taken');
      assert.equal((await s.ann.post('/api/auth/login', { username: 'lokesh', password: 'wrong-password' })).status, 401);
      assert.equal((await s.ann.post('/api/auth/login', { username: 'lokesh', password: 'lokesh-pass-1234' })).status, 200);
      assert.equal((await s.ann.get('/api/me')).data.user.name, 'Lokesh');
      assert.equal((await s.ann.get('/api/members')).status, 403, 'a member cannot see or manage members');
      assert.equal((await s.ann.post('/api/members', { name: 'Y', username: 'yyy', password: 'long-enough-pw' })).status, 403);
      assert.equal(JSON.stringify((await s.admin.get('/api/members')).data).includes('pass'), false, 'no password data leaves the server');

      assert.equal((await s.admin.post('/api/members/' + m.id + '/password', { password: 'brand-new-pass-1' })).status, 200);
      assert.equal((await s.ann.post('/api/auth/login', { username: 'lokesh', password: 'lokesh-pass-1234' })).status, 401, 'old password stops working');
      assert.equal((await s.ann.post('/api/auth/login', { username: 'lokesh', password: 'brand-new-pass-1' })).status, 200);
      assert.equal((await s.admin.patch('/api/members/' + m.id, { active: false })).status, 200);
      assert.equal((await s.ann.get('/api/customers')).status, 401, 'switched off means out at once');
      assert.equal((await s.ann.post('/api/auth/login', { username: 'lokesh', password: 'brand-new-pass-1' })).status, 401);
      assert.ok((await s.admin.get('/api/members')).data.activity.length >= 3, 'changes are logged');
    } finally { await s.stop(); }
  });

  test('customers are view-only over HTTP; each has a timeline, who did it, and files', async () => {
    const s = await boot();
    try {
      const L = s.app.repo.createMember({ name: 'Lokesh', username: 'lokesh', password: 'lokesh-pass-1234' }).member;
      const V = s.app.repo.createMember({ name: 'Vikas', username: 'vikas', password: 'vikas-pass-1234' }).member;
      const c = s.app.repo.addCustomer({ name: 'Shakti Batteries', phone: '+91 98111 00001', ownerId: L.id }, L.id).customer;
      s.app.repo.addCustomer({ name: 'Volt Works', phone: '9811100002' }, V.id);
      assert.equal(s.app.repo.addInteraction({ customerId: c.id, type: 'dance', summary: 'x' }, L.id).error.startsWith('Type must be'), true);
      assert.equal(s.app.repo.addInteraction({ customerId: c.id, type: 'call', summary: '  ' }, L.id).error, 'Say what happened');
      const call = s.app.repo.addInteraction({ customerId: c.id, type: 'call', summary: 'Asked about nickel strip', nextDate: '2999-01-01' }, L.id).interaction;
      s.app.repo.addInteraction({ customerId: c.id, type: 'order', summary: 'Order confirmed', amount: 15000 }, V.id);
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      const img = s.app.repo.addFile({ customerId: c.id, interactionId: call.id, name: 'shot.png', mime: 'image/png', buffer: png }, V.id).file;
      const page = s.app.repo.addFile({ customerId: c.id, name: 'x.html', mime: 'text/html', buffer: Buffer.from('<script>alert(1)</script>') }, V.id).file;

      const list = (await s.admin.get('/api/customers')).data.customers;
      assert.equal(list.length, 2);
      assert.equal(list[0].name, 'Shakti Batteries', 'most recent activity first');
      assert.equal(list[0].interactions, 2);
      assert.equal((await s.admin.get('/api/customers?q=98111%2000001')).data.customers.length, 1, 'search by phone digits');
      assert.equal((await s.admin.get('/api/customers?q=volt')).data.customers[0].name, 'Volt Works');
      assert.equal((await s.admin.get('/api/customers?owner=' + L.id)).data.customers.length, 1);

      const d = (await s.admin.get('/api/customers/' + c.id)).data.customer;
      assert.deepEqual(d.interactions.map((i) => [i.type, i.by_name]), [['order', 'Vikas'], ['call', 'Lokesh']], 'newest first, with who');
      assert.equal(d.interactions[1].next_date, '2999-01-01');
      assert.equal(d.files.length, 2);
      assert.equal((await s.admin.get('/api/customers/nope')).status, 404);

      // nothing can be changed through the web
      for (const [m, u] of [['post', '/api/customers'], ['post', '/api/customers/' + c.id + '/interactions'], ['patch', '/api/customers/' + c.id]]) {
        assert.equal((await s.admin[m](u, { name: 'x' })).status, 404, m + ' ' + u);
      }

      // pictures show in the page; anything else is only a download
      const shown = await s.admin.get('/api/files/' + img.id);
      assert.equal(shown.status, 200); assert.match(shown.headers.get('content-disposition'), /^inline/);
      const dl = await s.admin.get('/api/files/' + page.id);
      assert.match(dl.headers.get('content-disposition'), /^attachment/); assert.equal(dl.headers.get('content-type'), 'application/octet-stream');
      assert.match((await s.admin.get('/api/files/' + img.id + '?download=1')).headers.get('content-disposition'), /^attachment/);
      assert.equal((await s.admin.get('/api/files/..%2F..%2Fportal.db')).status, 404);
      assert.equal((await client(s.base).get('/api/files/' + img.id)).status, 401);
    } finally { await s.stop(); }
  });
});
