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

describe('mcp', () => {
  const rpc = (base, key, method, params, id = 1) => fetch(base + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: 'Bearer ' + key } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
  const call = async (base, key, name, args) => (await (await rpc(base, key, 'tools/call', { name, arguments: args })).json()).result;
  const data = (r) => JSON.parse(r.content[0].text);

  test('a member connects with their own key; everything they save carries their name', async () => {
    const s = await boot();
    try {
      const L = s.app.repo.createMember({ name: 'Lokesh', username: 'lokesh', password: 'lokesh-pass-1234' }).member;
      s.app.repo.createMember({ name: 'Vikas', username: 'vikas', password: 'vikas-pass-1234' });
      const lok = client(s.base); await lok.post('/api/auth/login', { username: 'lokesh', password: 'lokesh-pass-1234' });
      assert.equal((await s.admin.post('/api/my-connection/key')).status, 400, 'admin has no member record');
      assert.equal((await lok.get('/api/my-connection')).data.key, null);
      const key = (await lok.post('/api/my-connection/key')).data.key;
      assert.match(key, /^pk_/);
      assert.equal(JSON.stringify(s.app.repo.members()).includes(key), false, 'only a hash is stored');

      assert.equal((await rpc(s.base, '', 'initialize', {})).status, 401, 'no key');
      assert.equal((await rpc(s.base, 'pk_wrongwrongwrongwrongwrong', 'initialize', {})).status, 401, 'wrong key');
      assert.equal((await fetch(s.base + '/mcp', { headers: { Authorization: 'Bearer ' + key } })).status, 405);
      const initRes = await rpc(s.base, key, 'initialize', { protocolVersion: '2025-06-18' }); const init = await initRes.json(); if (!init.result) console.log('DEBUG', initRes.status, JSON.stringify(init));
      assert.equal(init.result.protocolVersion, '2025-06-18'); assert.ok(init.result.capabilities.tools);
      assert.equal((await fetch(s.base + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) })).status, 202);
      const list = (await (await rpc(s.base, key, 'tools/list')).json()).result.tools.map((t) => t.name);
      assert.deepEqual(list, ['who_am_i', 'list_team', 'search_customers', 'get_customer', 'add_customer', 'log_interaction', 'my_follow_ups', 'add_file']);
      assert.equal(list.some((n) => /delete|remove/.test(n)), false, 'nothing can be deleted');
      assert.equal(data(await call(s.base, key, 'who_am_i', {})).name, 'Lokesh');

      const added = data(await call(s.base, key, 'add_customer', { name: 'Mr Rao', company: 'Rao Traders', phone: '98111 22233', city: 'Pune' }));
      assert.equal((await call(s.base, key, 'add_customer', { name: 'Rao again', phone: '+91 9811122233' })).isError, true, 'same phone is refused');
      const dueYesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      assert.equal((await call(s.base, key, 'log_interaction', { customer_id: added.id, type: 'dance', summary: 'x' })).isError, true);
      assert.equal((await call(s.base, key, 'log_interaction', { customer_id: 'nope', type: 'call', summary: 'x' })).isError, true);
      assert.equal((await call(s.base, key, 'log_interaction', { customer_id: added.id, type: 'call', summary: 'Wants nickel strip', next_date: dueYesterday })).isError, undefined);
      assert.equal(data(await call(s.base, key, 'my_follow_ups', {})).length, 1, 'follow-up is due');
      await call(s.base, key, 'log_interaction', { customer_id: added.id, type: 'quote', summary: 'Sent quote', amount: 15000 });
      assert.equal(data(await call(s.base, key, 'my_follow_ups', {})).length, 0, 'a later entry without a date closes it');
      const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      assert.equal(data(await call(s.base, key, 'add_file', { customer_id: added.id, name: 'shot.png', mime_type: 'image/png', data_base64: png })).saved, true);
      assert.equal((await call(s.base, key, 'add_file', { customer_id: added.id, name: 'bad', data_base64: '!!!' })).isError, true);

      const found = data(await call(s.base, key, 'search_customers', { query: '9811122233' }));
      assert.equal(found.length, 1); assert.equal(found[0].owner, 'Lokesh');
      const full = data(await call(s.base, key, 'get_customer', { customer_id: added.id }));
      assert.deepEqual(full.interactions.map((i) => [i.type, i.by]), [['quote', 'Lokesh'], ['call', 'Lokesh']]);
      assert.equal(full.files.length, 1);
      assert.equal(data(await call(s.base, key, 'list_team', {})).length, 2);
      assert.equal((await call(s.base, key, 'add_customer', { name: 'X', owner_username: 'ghost' })).isError, true);
      assert.equal((await rpc(s.base, key, 'nothing/here')).status, 200);
      assert.equal((await (await rpc(s.base, key, 'nothing/here')).json()).error.code, -32601);

      // the portal pages show it, under Lokesh's name
      assert.equal((await s.admin.get('/api/customers/' + added.id)).data.customer.interactions[0].by_name, 'Lokesh');

      // a new key replaces the old; revoking or switching off cuts access at once
      const key2 = (await lok.post('/api/my-connection/key')).data.key;
      assert.equal((await rpc(s.base, key, 'ping')).status, 401, 'old key stops');
      assert.equal((await rpc(s.base, key2, 'ping')).status, 200);
      assert.equal((await s.admin.get('/api/members')).data.members.find((m) => m.id === L.id).hasKey, true);
      assert.equal((await s.admin.post('/api/members/' + L.id + '/revoke-key')).status, 200);
      assert.equal((await rpc(s.base, key2, 'ping')).status, 401, 'revoked');
      const key3 = (await lok.post('/api/my-connection/key')).data.key;
      await s.admin.patch('/api/members/' + L.id, { active: false });
      assert.equal((await rpc(s.base, key3, 'ping')).status, 401, 'switched off');
      assert.equal((await lok.post('/api/my-connection/key')).status, 401);
    } finally { await s.stop(); }
  });
});
