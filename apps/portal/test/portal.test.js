'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../app');
const { orderAction, invoiceAction, quoteAction } = require('../lib/books');

function client(base) {
  let cookie = '';
  const call = async (method, url, body) => {
    const res = await fetch(base + url, { method, redirect: 'manual', headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (set.length) { const c = set[0].split(';')[0]; cookie = c.endsWith('=') ? '' : c; }
    const type = res.headers.get('content-type') || '';
    return { status: res.status, headers: res.headers, data: type.includes('json') ? await res.json() : await res.text(), location: res.headers.get('location') };
  };
  return { get: (u) => call('GET', u), post: (u, b) => call('POST', u, b === undefined ? {} : b), patch: (u, b) => call('PATCH', u, b), raw: call };
}

// a pretend Zoho Commerce storefront: two nickel strips and a BMS, one collection
function storefrontFetch() {
  const prods = [
    { product_id: 'p1', name: 'Nickel strip 0.15 mm x 8 mm', category_id: 'c1', handle: 'ns015', description: '<p>Pure nickel &amp; flexible</p>', unit: 'kg', variants: [{ sku: 'NS-015', selling_price: 900, stock_available: 5, minimum_order_quantity: 1 }], images: [{ id: '1', url: '/product-images/ns015.jpg/1/500x500' }] },
    { product_id: 'p2', name: 'Nickel strip 0.20 mm x 8 mm', category_id: 'c1', handle: 'ns020', description: '', unit: 'kg', variants: [{ sku: 'NS-020', selling_price: 1100, stock_available: 0 }], images: [] },
    { product_id: 'p3', name: 'BMS 4S 30A', category_id: 'c2', handle: 'bms4s', description: '', unit: 'pcs', variants: [{ sku: 'BMS-4S', selling_price: 650, stock_available: 7 }], images: [] },
  ];
  return async (url) => {
    const u = new URL(url), p = u.pathname.replace('/storefront/api/v1', '');
    const payload = p === '/categories' ? { categories: [{ category_id: 'c1', name: 'Nickel strip' }, { category_id: 'c2', name: 'BMS' }], pagination: { has_more_page: false } }
      : p === '/collections' ? { collections: [{ id: 'col1', name: '18650' }], pagination: { has_more_page: false } }
        : { products: u.searchParams.get('collection_id') ? [prods[0]] : prods, pagination: { has_more_page: false } };
    return { ok: true, status: 200, json: async () => ({ status_code: '0', payload }) };
  };
}

// what a Claude with Zoho Books connected would read and save for Mr Rao: dates are relative to today so "overdue by 22 days" stays true
const rel = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const LINE = [{ name: 'Nickel strip 0.15', quantity: 20, rate: 750, total: 15000 }];
const ZOHO_DOCS = () => ({
  invoices: [
    { number: 'INV-1', date: rel(60), due_date: rel(30), total: 20000, balance: 0, status: 'paid', lines: LINE },
    { number: 'INV-2', date: rel(30), due_date: rel(22), total: 10000, balance: 10000, status: 'sent', lines: LINE },
  ],
  orders: [
    { number: 'SO-1', date: rel(60), total: 20000, status: 'closed', shipped_status: 'shipped', invoiced_status: 'invoiced' },
    { number: 'SO-2', date: rel(10), total: 5000, status: 'open', shipped_status: 'not_shipped', invoiced_status: 'not_invoiced', lines: LINE },
    { number: 'SO-3', date: rel(5), total: 7000, status: 'open', shipped_status: 'shipped', invoiced_status: 'not_invoiced' },
  ],
  quotes: [{ number: 'EST-1', date: rel(3), total: 8000, status: 'accepted' }],
});

async function boot(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-'));
  const app = createApp({ dataDir: dir, adminPassword: 'admin-secret-1', sessionSecret: 'test-secret', fetchFn: storefrontFetch() });
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

  test('a mobile number is the key: cleaned to 10 digits, never twice; the profile fills in without ever being wiped; search reads the history too', async () => {
    const s = await boot();
    try {
      const L = s.app.repo.createMember({ name: 'Lokesh', username: 'lokesh', password: 'lokesh-pass-1234' }).member;
      const add = (o) => s.app.repo.addCustomer(o, L.id);
      assert.match(add({ name: 'X', mobile: '12345' }).error, /valid 10-digit Indian mobile/);
      assert.match(add({ name: 'X' }).error, /valid 10-digit Indian mobile/);
      assert.match(add({ name: 'X', mobile: '5811122233' }).error, /valid 10-digit Indian mobile/, 'Indian mobiles start with 6 to 9');
      const c = add({ name: 'Mr Rao', mobile: '+91 98111-22233', city: 'Pune', buyer_type: 'Non Trader', source: 'Email', looking_for: 'nickel strip 0.15 mm' });
      assert.equal(c.customer.mobile, '9811122233');
      assert.equal(c.customer.buyer_type, 'non_trader');
      assert.ok(c.missing.some((m) => m.field === 'company'), 'tells what is still unknown');
      for (const same of ['9811122233', '098111 22233', '+919811122233']) assert.equal(add({ name: 'Again', mobile: same }).exists, true, same + ' is the same customer');
      assert.match(add({ name: 'Y', mobile: '9811122234', buyer_type: 'wholesaler' }).error, /buyer_type must be one of/);
      assert.match(add({ name: 'Y', mobile: '9811122234', gstin: '123' }).error, /GST/);
      assert.equal(s.app.repo.db.prepare('SELECT COUNT(*) AS n FROM customers').get().n, 1);
      assert.throws(() => s.app.repo.db.prepare("INSERT INTO customers (mobile, name, created_at, updated_at) VALUES ('9811122233', 'Raw', 'x', 'x')").run(), /UNIQUE|constraint/i, 'the database itself refuses a duplicate');

      const u = s.app.repo.updateCustomer('98111 22233', { company: 'Rao Traders', gstin: '27abcde1234f1z5', state: 'Maharashtra', looking_for: '', city: '' }, L.id);
      assert.deepEqual(u.changed.sort(), ['company', 'gstin', 'state']);
      const after = s.app.repo.customer('9811122233');
      assert.equal(after.gstin, '27ABCDE1234F1Z5'); assert.equal(after.city, 'Pune', 'a blank never erases'); assert.equal(after.looking_for, 'nickel strip 0.15 mm');
      assert.equal(s.app.repo.updateCustomer('9000000000', { company: 'x' }, L.id).status, 404);

      s.app.repo.addInteraction({ mobile: '9811122233', type: 'call', summary: 'Asked about copper busbar for an inverter', nextDate: '2999-01-01' }, L.id);
      assert.equal(s.app.repo.addInteraction({ mobile: '9811122233', type: 'dance', summary: 'x' }, L.id).error.startsWith('Type must be'), true);
      assert.equal(s.app.repo.addInteraction({ mobile: '9000000000', type: 'call', summary: 'x' }, L.id).status, 404);
      add({ name: 'Volt Works', mobile: '9811100002', city: 'Indore', buyer_type: 'trader', business: 'reseller_dealer' });

      const q = async (qs) => (await s.admin.get('/api/customers?' + qs)).data.customers.map((c) => c.name);
      assert.deepEqual(await q('q=copper%20busbar'), ['Mr Rao'], 'finds words from the history');
      assert.deepEqual(await q('q=98111%2022233'), ['Mr Rao'], 'by mobile');
      assert.deepEqual(await q('q=pune'), ['Mr Rao']);
      assert.deepEqual(await q('q=nickel'), ['Mr Rao'], 'by what they want');
      assert.deepEqual(await q('buyer=trader'), ['Volt Works']);
      assert.deepEqual(await q('business=reseller_dealer'), ['Volt Works']);
      const d = (await s.admin.get('/api/customers/098111-22233')).data.customer;
      assert.equal(d.mobile, '9811122233'); assert.equal(d.interactions.length, 1); assert.ok(Array.isArray(d.missing));
      assert.equal((await s.admin.get('/api/customers/9000000000')).status, 404);
      for (const [m, u2] of [['post', '/api/customers'], ['post', '/api/customers/9811122233/interactions'], ['patch', '/api/customers/9811122233']]) assert.equal((await s.admin[m](u2, { name: 'x' })).status, 404, 'view only: ' + m + ' ' + u2);

      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      const img = s.app.repo.addFile({ mobile: '9811122233', name: 'shot.png', mime: 'image/png', buffer: png }, L.id).file;
      const page = s.app.repo.addFile({ mobile: '9811122233', name: 'x.html', mime: 'text/html', buffer: Buffer.from('<script>alert(1)</script>') }, L.id).file;
      assert.match((await s.admin.get('/api/files/' + img.id)).headers.get('content-disposition'), /^inline/);
      const dl = await s.admin.get('/api/files/' + page.id);
      assert.match(dl.headers.get('content-disposition'), /^attachment/); assert.equal(dl.headers.get('content-type'), 'application/octet-stream');
      assert.equal((await s.admin.get('/api/files/..%2F..%2Fportal.db')).status, 404);
      assert.equal((await client(s.base).get('/api/files/' + img.id)).status, 401);
    } finally { await s.stop(); }
  });

  test('items come from the Zoho Commerce storefront; vendors are keyed by mobile; rates link to items and the cheapest comes first', async () => {
    const s = await boot();
    try {
      const L = s.app.repo.createMember({ name: 'Lokesh', username: 'lokesh', password: 'lokesh-pass-1234' }).member;
      assert.equal((await s.app.itemSync.sync()).ok, true);
      const items = (await s.admin.get('/api/items')).data;
      assert.equal(items.items.length, 3);
      const n15 = items.items.find((i) => i.sku === 'NS-015');
      assert.equal(n15.category, 'Nickel strip'); assert.equal(n15.price, 900); assert.deepEqual(n15.collections, ['18650']); assert.match(n15.description, /Pure nickel & flexible/);
      assert.match(n15.image_url, /^https:\/\/armabhika\.zohoecommerce\.in\/product-images\//);
      assert.deepEqual((await s.admin.get('/api/items?q=nickel%200.15')).data.items.map((i) => i.sku), ['NS-015']);
      assert.equal((await s.admin.get('/api/items?stock=1')).data.items.length, 2);
      assert.equal((await s.admin.get('/api/items?category=BMS')).data.items.length, 1);

      const v = (m, n) => s.app.repo.addVendor({ name: n, mobile: m }, L.id);
      assert.equal(v('+91 90000-00001', 'Saurav').vendor.mobile, '9000000001');
      assert.equal(v('9000000001', 'Other').exists, true, 'one vendor per mobile');
      v('9000000002', 'Anil'); v('9000000003', 'Meena');
      assert.match(s.app.repo.addVendor({ name: 'Z', mobile: '55' }, L.id).error, /valid 10-digit Indian mobile/);

      const o1 = s.app.repo.addOffer({ vendorMobile: '9000000001', itemText: 'nickel strip 0.15', rate: 700, unit: 'kg', quantity: '200 kg' }, L.id);
      assert.equal(o1.mappedTo.id, 'p1', 'one clear match is linked');
      const o2 = s.app.repo.addOffer({ vendorMobile: '9000000002', itemId: 'p1', rate: 650, unit: 'kg', offerDate: '2026-11-01' }, L.id);
      assert.equal(o2.mappedTo.id, 'p1');
      const o3 = s.app.repo.addOffer({ vendorMobile: '9000000003', itemText: 'nickel strip', rate: 900, unit: 'kg' }, L.id);
      assert.equal(o3.mappedTo, null, 'two nickel strips: not guessed'); assert.equal(o3.candidates.length, 2);
      assert.equal(s.app.repo.addOffer({ vendorMobile: '9000000001', itemText: 'x', rate: 0 }, L.id).error, 'The rate must be a number above zero');
      assert.equal(s.app.repo.addOffer({ vendorMobile: '9111111111', itemText: 'x', rate: 5 }, L.id).status, 404);
      assert.equal(s.app.repo.addOffer({ vendorMobile: '9000000001', itemId: 'nope', rate: 5 }, L.id).error.startsWith('That item id'), true);
      // Saurav sends a new, lower rate the next day: it replaces the old one in "latest", the old one stays in history
      s.app.repo.addOffer({ vendorMobile: '9000000001', itemId: 'p1', rate: 640, unit: 'kg', offerDate: '2999-01-01' }, L.id);

      const sup = (await s.admin.get('/api/items/p1')).data.item.suppliers;
      assert.deepEqual(sup.map((x) => [x.vendor_name, x.rate]), [['Saurav', 640], ['Anil', 650]], 'cheapest first, one latest rate per vendor');
      assert.equal((await s.admin.get('/api/items')).data.items.find((i) => i.id === 'p1').best.rate, 640);
      assert.deepEqual(s.app.repo.findSuppliers({ query: 'nickel strip' }).map((x) => x.vendor_name), ['Saurav', 'Anil', 'Meena'], 'unlinked rates are found by their words too');
      assert.equal(s.app.repo.mapOffer(o3.offer.id, 'p2', L.id).ok, true);
      assert.equal(s.app.repo.findSuppliers({ itemId: 'p2' })[0].vendor_name, 'Meena');
      const vd = (await s.admin.get('/api/vendors/9000000001')).data.vendor;
      assert.equal(vd.offers.length, 2); assert.equal(vd.latest.length, 1); assert.equal(vd.latest[0].rate, 640);
      assert.deepEqual((await s.admin.get('/api/vendors?q=nickel')).data.vendors.map((x) => x.name).sort(), ['Anil', 'Meena', 'Saurav']);
      assert.deepEqual((await s.admin.get('/api/vendors?q=9000000002')).data.vendors.map((x) => x.name), ['Anil']);
      assert.equal((await s.admin.get('/api/vendors/9111111111')).status, 404);
      assert.equal((await s.admin.post('/api/vendors', { name: 'x' })).status, 404, 'view only');
    } finally { await s.stop(); }
  });

  test('what Claude saves from Zoho Books shows on the customer page with what to do next; nothing is read from Zoho by the portal', async () => {
    const s = await boot();
    try {
      const L = s.app.repo.createMember({ name: 'Lokesh', username: 'lokesh', password: 'lokesh-pass-1234' }).member;
      s.app.repo.addCustomer({ name: 'Mr Rao', mobile: '9811122233' }, L.id);
      const before = (await s.admin.get('/api/customers/9811122233/books')).data;
      assert.equal(before.synced, false); assert.match(before.note, /Sync this customer from Zoho Books/);
      assert.deepEqual(s.app.repo.saveBooksDocs('98111 22233', ZOHO_DOCS(), L.id), { saved: 6, invoices: 2, orders: 3, quotes: 1 });
      const b = (await s.admin.get('/api/customers/9811122233/books')).data;
      assert.equal(b.synced, true); assert.equal(b.syncedBy, 'Lokesh');
      assert.equal(b.summary.invoices, 2); assert.equal(b.summary.billed, 30000); assert.equal(b.summary.outstanding, 10000); assert.equal(b.summary.lastPurchase, rel(30));
      assert.deepEqual(b.bought.map((x) => [x.name, x.quantity]), [['Nickel strip 0.15', 40]]);
      const what = b.actions.map((a) => a.kind + ':' + a.number + ':' + a.label);
      assert.ok(what.includes('order:SO-2:Placed, not delivered'), what.join('|'));
      assert.ok(what.includes('order:SO-3:Delivered, not invoiced'));
      assert.ok(what.includes('invoice:INV-2:Overdue 22 days'));
      assert.ok(what.includes('quote:EST-1:Quote accepted'));
      assert.equal(b.orders.find((o) => o.number === 'SO-2').lines.length, 1);
      // saving the same number again updates it (the invoice got paid); nothing is added twice
      s.app.repo.saveBooksDocs('9811122233', { invoices: [{ number: 'INV-2', date: rel(30), due_date: rel(22), total: 10000, balance: 0, status: 'paid' }] }, L.id);
      const again = (await s.admin.get('/api/customers/9811122233/books')).data;
      assert.equal(again.invoices.length, 2); assert.equal(again.summary.outstanding, 0);
      assert.ok(!again.actions.some((a) => a.number === 'INV-2'), 'no longer overdue');
      assert.match(s.app.repo.saveBooksDocs('9811122233', { invoices: [{ total: 5 }] }, L.id).error, /needs its number/);
      assert.match(s.app.repo.saveBooksDocs('9811122233', {}, L.id).error, /at least one/);
      assert.equal(s.app.repo.saveBooksDocs('9000000000', ZOHO_DOCS(), L.id).status, 404);
      assert.equal((await s.admin.get('/api/customers/9000000000/books')).status, 404);
      assert.equal((await client(s.base).get('/api/customers/9811122233/books')).status, 401);
    } finally { await s.stop(); }
  });

  test('only the admin can delete a customer, only after typing their mobile, and it removes their history and files too', async () => {
    const s = await boot();
    try {
      const L = s.app.repo.createMember({ name: 'Lokesh', username: 'lokesh', password: 'lokesh-pass-1234' }).member;
      const lok = client(s.base); await lok.post('/api/auth/login', { username: 'lokesh', password: 'lokesh-pass-1234' });
      s.app.repo.addCustomer({ name: 'Mr Rao', mobile: '9811122233' }, L.id); s.app.repo.addCustomer({ name: 'Keep Me', mobile: '9811100002' }, L.id);
      s.app.repo.addInteraction({ mobile: '9811122233', type: 'call', summary: 'hello' }, L.id);
      const f = s.app.repo.addFile({ mobile: '9811122233', name: 'a.png', mime: 'image/png', buffer: Buffer.from('x') }, L.id).file;
      const del = (c, mobile, body) => c.raw('DELETE', '/api/customers/' + mobile, body);
      assert.equal((await del(lok, '9811122233', { confirm: '9811122233' })).status, 403, 'a team member cannot');
      assert.equal((await del(client(s.base), '9811122233', { confirm: '9811122233' })).status, 401);
      assert.equal((await del(s.admin, '9811122233', {})).status, 400, 'needs the typed mobile');
      assert.equal((await del(s.admin, '9811122233', { confirm: '9811100002' })).status, 400, 'the wrong number does not count');
      assert.equal((await del(s.admin, '9000000000', { confirm: '9000000000' })).status, 404);
      assert.equal(s.app.repo.customer('9811122233').name, 'Mr Rao', 'still there after the refusals');
      const ok = await del(s.admin, '098111-22233', { confirm: '9811122233' });
      assert.equal(ok.status, 200); assert.equal(ok.data.interactions, 1); assert.equal(ok.data.files, 1);
      assert.equal(s.app.repo.customer('9811122233'), null);
      assert.equal(s.app.repo.db.prepare('SELECT COUNT(*) AS n FROM interactions').get().n, 0);
      assert.equal(fs.existsSync(s.app.repo.filePath(f.id)), false, 'the file is gone from disk');
      assert.equal(s.app.repo.customer('9811100002').name, 'Keep Me', 'other customers are untouched');
      assert.match((await s.admin.get('/api/members')).data.activity[0].action, /DELETED customer Mr Rao/);
    } finally { await s.stop(); }
  });

  test('only the admin can delete a vendor, after typing their mobile; their rates go with them and the items stay', async () => {
    const s = await boot();
    try {
      const L = s.app.repo.createMember({ name: 'Lokesh', username: 'lokesh', password: 'lokesh-pass-1234' }).member;
      const lok = client(s.base); await lok.post('/api/auth/login', { username: 'lokesh', password: 'lokesh-pass-1234' });
      await s.app.itemSync.sync();
      s.app.repo.addVendor({ name: 'Saurav', mobile: '9000000001' }, L.id); s.app.repo.addVendor({ name: 'Anil', mobile: '9000000002' }, L.id);
      s.app.repo.addOffer({ vendorMobile: '9000000001', itemId: 'p1', rate: 700 }, L.id); s.app.repo.addOffer({ vendorMobile: '9000000002', itemId: 'p1', rate: 650 }, L.id);
      const del = (c, mobile, body) => c.raw('DELETE', '/api/vendors/' + mobile, body);
      assert.equal((await del(lok, '9000000001', { confirm: '9000000001' })).status, 403);
      assert.equal((await del(client(s.base), '9000000001', { confirm: '9000000001' })).status, 401);
      assert.equal((await del(s.admin, '9000000001', {})).status, 400);
      assert.equal((await del(s.admin, '9000000001', { confirm: '9000000002' })).status, 400);
      assert.equal((await del(s.admin, '9111111111', { confirm: '9111111111' })).status, 404);
      const ok = await del(s.admin, '90000 00001', { confirm: '9000000001' });
      assert.equal(ok.status, 200); assert.equal(ok.data.rates, 1);
      assert.equal(s.app.repo.vendor('9000000001'), null);
      assert.deepEqual(s.app.repo.findSuppliers({ itemId: 'p1' }).map((x) => x.vendor_name), ['Anil'], 'only the deleted vendor\'s rates went');
      assert.equal(s.app.repo.item('p1').name.startsWith('Nickel strip'), true, 'items stay');
      assert.match((await s.admin.get('/api/members')).data.activity[0].action, /DELETED vendor Saurav/);
    } finally { await s.stop(); }
  });

  test('the next step for each order, invoice and quote', () => {
    const today = '2026-11-15';
    const o = (x) => orderAction({ date: '2026-11-14', status: 'open', shipped: 'not_shipped', invoiced: 'not_invoiced', ...x }, today);
    assert.equal(o({}).label, 'Order placed'); assert.match(o({}).action, /move it to invoicing/);
    assert.equal(o({ date: '2026-11-01' }).label, 'Placed, not delivered'); assert.equal(o({ date: '2026-11-01' }).tone, 'bad');
    assert.equal(o({ shipped: 'shipped' }).label, 'Delivered, not invoiced');
    assert.equal(o({ shipped: 'shipped', invoiced: 'invoiced' }).tone, 'ok');
    assert.equal(o({ invoiced: 'invoiced' }).label, 'Invoiced, not delivered');
    assert.equal(o({ shipped: 'partially_shipped' }).label, 'Partly delivered');
    assert.equal(o({ status: 'draft' }).label, 'Draft order'); assert.equal(o({ status: 'void' }).label, 'Order cancelled');
    const i = (x) => invoiceAction({ status: 'sent', total: 5000, balance: 5000, dueDate: '2026-11-30', ...x }, today);
    assert.equal(i({}).label, 'Payment due'); assert.equal(i({ dueDate: '2026-11-10' }).label, 'Overdue 5 days'); assert.equal(i({ dueDate: '2026-11-10' }).tone, 'bad');
    assert.equal(i({ balance: 0, status: 'paid' }).label, 'Paid'); assert.equal(i({ status: 'draft' }).label, 'Invoice draft');
    const q = (x) => quoteAction({ date: '2026-11-10', status: 'sent', ...x }, today);
    assert.match(q({}).action, /5 days ago/); assert.equal(q({ status: 'accepted' }).label, 'Quote accepted'); assert.equal(q({ expiry: '2026-11-12' }).label, 'Quote expired'); assert.equal(q({ status: 'draft' }).label, 'Quote not sent');
  });
});

describe('mcp', () => {
  const rpc = (base, key, method, params, id = 1) => fetch(base + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: 'Bearer ' + key } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
  const call = async (base, key, name, args) => (await (await rpc(base, key, 'tools/call', { name, arguments: args })).json()).result;
  const data = (r) => JSON.parse(r.content[0].text);

  test('a member connects with their own key; every tool works on mobile numbers and is stamped with their name', async () => {
    const s = await boot();
    try {
      const L = s.app.repo.createMember({ name: 'Lokesh', username: 'lokesh', password: 'lokesh-pass-1234' }).member;
      s.app.repo.createMember({ name: 'Vikas', username: 'vikas', password: 'vikas-pass-1234' });
      const lok = client(s.base); await lok.post('/api/auth/login', { username: 'lokesh', password: 'lokesh-pass-1234' });
      assert.equal((await s.admin.post('/api/my-connection/key')).status, 400, 'admin has no member record');
      const key = (await lok.post('/api/my-connection/key')).data.key;
      assert.match(key, /^pk_/);
      assert.equal(JSON.stringify(s.app.repo.members()).includes(key), false, 'only a hash is stored');
      assert.equal((await rpc(s.base, '', 'initialize', {})).status, 401, 'no key');
      assert.equal((await rpc(s.base, 'pk_wrongwrongwrongwrongwrong', 'initialize', {})).status, 401, 'wrong key');
      assert.equal((await fetch(s.base + '/mcp', { headers: { Authorization: 'Bearer ' + key } })).status, 405);
      const init = await (await rpc(s.base, key, 'initialize', { protocolVersion: '2025-06-18' })).json();
      assert.equal(init.result.protocolVersion, '2025-06-18'); assert.match(init.result.instructions, /mobile number/);
      assert.equal((await fetch(s.base + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) })).status, 202);
      const names = (await (await rpc(s.base, key, 'tools/list')).json()).result.tools.map((t) => t.name);
      for (const n of ['add_customer', 'update_customer', 'customer_purchases', 'search_items', 'get_item', 'add_vendor', 'log_vendor_rate', 'map_vendor_rate', 'find_suppliers', 'get_vendor', 'search_vendors']) assert.ok(names.includes(n), n);
      assert.equal(names.some((n) => /delete|remove/.test(n)), false, 'nothing can be deleted');
      assert.equal(data(await call(s.base, key, 'who_am_i', {})).name, 'Lokesh');

      // a prospect arrives by email: Claude saves what it learned, and is told what is still unknown
      const added = data(await call(s.base, key, 'add_customer', { mobile: '+91 98111 22233', name: 'Mr Rao', company: 'Rao Traders', city: 'Pune', source: 'email', source_detail: 'Mailed from the website form', buyer_type: 'trader', looking_for: 'nickel strip 0.15, 20 kg a month' }));
      assert.equal(added.mobile, '9811122233'); assert.ok(added.still_unknown.includes('state')); assert.ok(added.still_unknown.includes('application')); assert.ok(added.ask_the_user.length > 0); assert.match(added.next, /complete_profile/);
      const dup = await call(s.base, key, 'add_customer', { mobile: '9811122233', name: 'Rao again' });
      assert.equal(dup.isError, true); assert.match(dup.content[0].text, /already exists/);
      assert.equal((await call(s.base, key, 'add_customer', { name: 'No number' })).isError, true);
      const noNum = await call(s.base, key, 'add_customer', { name: 'No number' });
      assert.match(noNum.content[0].text, /Received: nothing/, 'the error says what it received');
      // a Claude holding the older tool list sends "phone": still understood
      assert.equal(data(await call(s.base, key, 'add_customer', { name: 'Old Style', phone: '99181 56211', company: 'Direct Computer Services' })).mobile, '9918156211');
      assert.equal(data(await call(s.base, key, 'update_customer', { mobile: '9811122233', state: 'Gujarat', urgency: 'immediate' })).changed.length, 2);
      assert.equal((await call(s.base, key, 'update_customer', { mobile: '9811122233', buyer_type: 'bogus' })).isError, true);
      assert.equal((await call(s.base, key, 'log_interaction', { mobile: '9811122233', type: 'dance', summary: 'x' })).isError, true);
      // a Claude holding the older tool list sends customer_id: a mobile number there still works
      assert.equal(data(await call(s.base, key, 'log_interaction', { customer_id: '98111 22233', type: 'note', summary: 'logged the old way' })).saved, true);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      assert.equal((await call(s.base, key, 'log_interaction', { mobile: '9811122233', type: 'call', summary: 'Wants nickel strip', next_date: yesterday })).isError, undefined);
      assert.equal(data(await call(s.base, key, 'my_follow_ups', {})).length, 1);
      await call(s.base, key, 'log_interaction', { mobile: '9811122233', type: 'quote', summary: 'Sent quote', amount: 15000 });
      assert.equal(data(await call(s.base, key, 'my_follow_ups', {})).length, 0, 'a later entry without a date closes it');
      const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      assert.equal(data(await call(s.base, key, 'add_file', { mobile: '9811122233', name: 'shot.png', mime_type: 'image/png', data_base64: png })).saved, true);
      assert.equal((await call(s.base, key, 'add_file', { mobile: '9811122233', name: 'bad', data_base64: '!!!' })).isError, true);
      assert.equal(data(await call(s.base, key, 'search_customers', { query: 'rao' }))[0].owner, 'Lokesh');
      assert.equal(data(await call(s.base, key, 'search_customers', { buyer_type: 'trader' })).length, 1);
      const full = data(await call(s.base, key, 'get_customer', { mobile: '09811122233' }));
      assert.deepEqual(full.interactions.map((i) => [i.type, i.by]), [['quote', 'Lokesh'], ['call', 'Lokesh'], ['note', 'Lokesh']]); assert.equal(full.state, 'Gujarat');

      // Claude reads Zoho Books with its own connector and saves it; the portal then shows the next steps
      assert.equal(data(await call(s.base, key, 'customer_purchases', { mobile: '9811122233' })).found, false, 'nothing saved yet');
      const docs = ZOHO_DOCS();
      assert.equal(data(await call(s.base, key, 'save_zoho_books_documents', { mobile: '09811122233', ...docs })).saved, 6);
      assert.equal((await call(s.base, key, 'save_zoho_books_documents', { mobile: '9811122233', invoices: [{ total: 1 }] })).isError, true);
      assert.equal((await call(s.base, key, 'save_zoho_books_documents', { mobile: '9000000000', ...docs })).isError, true);
      const p = data(await call(s.base, key, 'customer_purchases', { mobile: '9811122233' }));
      assert.equal(p.saved_by, 'Lokesh'); assert.equal(p.summary.invoices, 2); assert.ok(p.what_to_do.some((x) => x.label === 'Placed, not delivered'));
      assert.equal((await call(s.base, key, 'customer_purchases', { mobile: '9000000000' })).isError, true);

      // items and vendors
      await s.app.itemSync.sync();
      const found = data(await call(s.base, key, 'search_items', { query: 'nickel strip 0.15' }));
      assert.equal(found.length, 1); const itemId = found[0].id;
      assert.equal(data(await call(s.base, key, 'add_vendor', { mobile: '90000 00001', name: 'Saurav', city: 'Mumbai' })).saved, true);
      assert.equal((await call(s.base, key, 'add_vendor', { mobile: '9000000001', name: 'Dup' })).isError, true, 'one vendor per mobile');
      const rate = data(await call(s.base, key, 'log_vendor_rate', { vendor_mobile: '9000000001', material: 'nickel strip 0.15', rate: 700, unit: 'kg', quantity: '200 kg', valid_till: '2999-12-31' }));
      assert.equal(rate.linked_to.id, itemId);
      const vague = data(await call(s.base, key, 'log_vendor_rate', { vendor_mobile: '9000000001', material: 'nickel strip', rate: 810, unit: 'kg' }));
      assert.equal(vague.linked_to, null); assert.ok(vague.not_linked_candidates.length >= 2);
      assert.equal(data(await call(s.base, key, 'map_vendor_rate', { offer_id: vague.offer_id, item_id: itemId })).saved, true);
      assert.equal(data(await call(s.base, key, 'find_suppliers', { item_id: itemId }))[0].rate, 810, 'the latest rate wins');
      assert.equal(data(await call(s.base, key, 'find_suppliers', { query: 'nickel' })).length, 1);
      assert.equal(data(await call(s.base, key, 'get_item', { item_id: itemId })).suppliers.length, 1);
      assert.equal(data(await call(s.base, key, 'get_vendor', { mobile: '9000000001' })).history.length, 2);
      assert.equal(data(await call(s.base, key, 'search_vendors', { query: 'nickel' })).length, 1);
      assert.equal((await call(s.base, key, 'log_vendor_rate', { vendor_mobile: '9123456789', material: 'x', rate: 5 })).isError, true);

      // the portal shows it, under Lokesh's name
      assert.equal((await s.admin.get('/api/customers/9811122233')).data.customer.interactions[0].by_name, 'Lokesh');
      assert.equal((await s.admin.get('/api/vendors/9000000001')).data.vendor.offers[0].by_name, 'Lokesh');

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

describe('mcp: finishing a customer profile', () => {
  const rpc = (base, key, method, params) => fetch(base + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }).then((r) => r.json());
  const call = async (base, key, name, args) => (await rpc(base, key, 'tools/call', { name, arguments: args })).result;
  const data = (r) => JSON.parse(r.content[0].text);

  test('complete_profile lists what is unknown with options and where to look; prompts guide Claude', async () => {
    const s = await boot();
    try {
      const L = s.app.repo.createMember({ name: 'Lokesh', username: 'lokesh', password: 'lokesh-pass-1234' }).member;
      s.app.repo.addCustomer({ name: 'Mr Rao', mobile: '9811122233' }, L.id);
      const key = s.app.repo.createKey(L.id).key;
      const init = await rpc(s.base, key, 'initialize', {});
      assert.ok(init.result.capabilities.prompts); assert.match(init.result.instructions, /other tools you have connected/);

      const p = data(await call(s.base, key, 'complete_profile', { mobile: '9811122233' }));
      const byField = Object.fromEntries(p.unknown.map((u) => [u.field, u]));
      assert.ok(byField.company && byField.source && byField.buyer_type);
      assert.ok(byField.buyer_type.options.includes('trader') && byField.buyer_type.options.includes('non_trader') && !byField.buyer_type.options.includes('unknown'));
      assert.ok(byField.business.options.includes('battery_pack_maker'));
      assert.match(byField.company.look_in, /Zoho Books/);
      assert.deepEqual(p.unknown.slice(0, 3).map((u) => u.field), ['company', 'city', 'state'], 'asked in a sensible order');

      assert.match(p.how, /Zoho Books connector/);
      // what Claude finds in Zoho Books is saved with update_customer, and a detail already known is not overwritten by blanks
      const up = data(await call(s.base, key, 'update_customer', { mobile: '9811122233', company: 'Rao Traders Pvt Ltd', gstin: '27ABCDE1234F1Z5', city: 'Pune', state: 'Maharashtra', pincode: '411001', email: '' }));
      assert.deepEqual(up.changed.sort(), ['city', 'company', 'gstin', 'pincode', 'state']);
      assert.deepEqual(data(await call(s.base, key, 'complete_profile', { mobile: '9811122233' })).unknown.slice(0, 1).map((u) => u.field), ['source']);
      assert.equal((await call(s.base, key, 'complete_profile', { mobile: '9000000000' })).isError, true);

      const list = (await rpc(s.base, key, 'prompts/list')).result.prompts.map((x) => x.name);
      assert.deepEqual(list, ['new_lead', 'complete_customer_profile', 'sync_from_zoho', 'log_vendor_rates']);
      const got = (await rpc(s.base, key, 'prompts/get', { name: 'new_lead', arguments: { text: 'Hi, I am Rao from Pune, need nickel strip' } })).result;
      assert.match(got.messages[0].content.text, /Hi, I am Rao from Pune/); assert.match(got.messages[0].content.text, /complete_profile/);
      assert.equal((await rpc(s.base, key, 'prompts/get', { name: 'nope' })).error.code, -32602);
      const sync = (await rpc(s.base, key, 'prompts/get', { name: 'sync_from_zoho', arguments: { mobile: '9811122233' } })).result.messages[0].content.text;
      assert.match(sync, /9811122233/); assert.match(sync, /save_zoho_books_documents/); assert.match(sync, /my Zoho Books connector/);
    } finally { await s.stop(); }
  });
});

describe('older database', () => {
  test('customers keyed by a random id are converted to mobile keys, with a copy of the file kept', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-old-'));
    const { DatabaseSync } = require('node:sqlite');
    const old = new DatabaseSync(path.join(dir, 'portal.db'));
    old.exec(`
      CREATE TABLE members (id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE, pass_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'employee', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
      INSERT INTO members VALUES ('m1', 'Lokesh', 'lokesh', 'x', 'employee', 1, '2026-01-01');
      CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, company TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', phone_digits TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', owner_id TEXT, created_by TEXT, created_at TEXT NOT NULL);
      CREATE TABLE interactions (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, type TEXT NOT NULL, summary TEXT NOT NULL, amount REAL, next_date TEXT, by_member TEXT NOT NULL, at TEXT NOT NULL);
      CREATE INDEX interactions_customer ON interactions(customer_id, at);
      CREATE TABLE files (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, interaction_id TEXT, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, by_member TEXT NOT NULL, at TEXT NOT NULL);
      INSERT INTO customers VALUES ('c1', 'Mr Rao', 'Rao Traders', '+91 98111 22233', '9811122233', '', 'Pune', 'm1', 'm1', '2026-02-01');
      INSERT INTO customers VALUES ('c2', 'No number', '', '', '', '', '', 'm1', 'm1', '2026-02-02');
      INSERT INTO interactions VALUES ('i1', 'c1', 'call', 'First call', NULL, NULL, 'm1', '2026-02-03');
    `);
    old.close();
    const { open } = require('../lib/db');
    const repo = open(dir);
    try {
      const c = repo.customer('9811122233');
      assert.equal(c.name, 'Mr Rao'); assert.equal(c.city, 'Pune'); assert.equal(c.interactions.length, 1); assert.equal(c.interactions[0].summary, 'First call');
      assert.equal(repo.customers().length, 1, 'a customer without a valid mobile cannot be kept');
      assert.ok(fs.readdirSync(dir).some((f) => f.startsWith('portal.db.before-mobile-keys')), 'a copy of the old file is kept');
    } finally { repo.close(); }
    const again = open(dir); assert.equal(again.customers().length, 1, 'opening again changes nothing'); again.close();
  });
});

describe('oauth sign-in for the Claude apps', () => {
  const crypto = require('node:crypto');
  const b64 = (b) => b.toString('base64url');
  const form = (o) => new URLSearchParams(o).toString();

  test('register, sign in on our page with username and password, exchange the code, use the token; every wrong turn is refused', async () => {
    const s = await boot();
    try {
      const L = s.app.repo.createMember({ name: 'Lokesh', username: 'lokesh', password: 'lokesh-pass-1234' }).member;
      const redirect = 'https://claude.ai/api/mcp/auth_callback';

      // Claude finds out how to sign in from the 401 and the well-known pages
      const r401 = await fetch(s.base + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(r401.status, 401);
      assert.match(r401.headers.get('www-authenticate'), /resource_metadata="http:\/\/127\.0\.0\.1:\d+\/\.well-known\/oauth-protected-resource"/);
      const pr = await (await fetch(s.base + '/.well-known/oauth-protected-resource')).json();
      assert.equal(pr.resource, s.base + '/mcp'); assert.deepEqual(pr.authorization_servers, [s.base]);
      const as = await (await fetch(s.base + '/.well-known/oauth-authorization-server')).json();
      assert.deepEqual(as.code_challenge_methods_supported, ['S256']);
      assert.equal(as.token_endpoint, s.base + '/oauth/token');

      // registration only for Claude's own addresses
      const reg = (uris) => fetch(s.base + '/oauth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'Claude', redirect_uris: uris }) });
      assert.equal((await reg(['https://evil.example/cb'])).status, 400);
      assert.equal((await reg(['http://evil.example/cb'])).status, 400);
      const client = await (await reg([redirect])).json();
      assert.match(client.client_id, /^c_/);

      const verifier = b64(crypto.randomBytes(32)), challenge = b64(crypto.createHash('sha256').update(verifier).digest());
      const q = { response_type: 'code', client_id: client.client_id, redirect_uri: redirect, state: 'abc', code_challenge: challenge, code_challenge_method: 'S256' };
      const pageRes = await fetch(s.base + '/oauth/authorize?' + form(q));
      assert.equal(pageRes.status, 200); assert.equal(pageRes.headers.get('x-frame-options'), 'DENY');
      assert.match(await pageRes.text(), /Sign in and allow/);
      assert.equal((await fetch(s.base + '/oauth/authorize?' + form({ ...q, redirect_uri: 'https://claude.ai/other' }))).status, 400, 'return address must match');
      assert.equal((await fetch(s.base + '/oauth/authorize?' + form({ ...q, code_challenge_method: 'plain' }))).status, 400);
      assert.equal((await fetch(s.base + '/oauth/authorize?' + form({ ...q, client_id: 'c_unknown' }))).status, 400);

      const signIn = (password) => fetch(s.base + '/oauth/authorize', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form({ client_id: q.client_id, redirect_uri: redirect, state: 'abc', code_challenge: challenge, username: 'lokesh', password }) });
      assert.equal((await signIn('wrong-password')).status, 401);
      const ok = await signIn('lokesh-pass-1234');
      assert.equal(ok.status, 302);
      const back = new URL(ok.headers.get('location'));
      assert.equal(back.origin + back.pathname, redirect); assert.equal(back.searchParams.get('state'), 'abc');
      const code = back.searchParams.get('code');

      const token = (o) => fetch(s.base + '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form(o) });
      const base = { grant_type: 'authorization_code', code, client_id: q.client_id, redirect_uri: redirect };
      assert.equal((await token({ ...base, code_verifier: 'not-the-verifier' })).status, 400, 'PKCE must match');
      assert.equal((await token({ ...base, code_verifier: verifier })).status, 400, 'a code is burned by a failed try too');

      const ok2 = await signIn('lokesh-pass-1234'); const code2 = new URL(ok2.headers.get('location')).searchParams.get('code');
      const t = await (await token({ ...base, code: code2, code_verifier: verifier })).json();
      assert.equal(t.token_type, 'Bearer'); assert.match(t.access_token, /^pa_/); assert.match(t.refresh_token, /^pr_/);
      assert.equal((await token({ ...base, code: code2, code_verifier: verifier })).status, 400, 'a code works once');

      const ping = (tok) => fetch(s.base + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'who_am_i', arguments: {} } }) });
      const who = await (await ping(t.access_token)).json();
      assert.equal(JSON.parse(who.result.content[0].text).name, 'Lokesh');

      // refresh gives a new pair, and the old refresh token is dead
      const r2 = await (await token({ grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: q.client_id })).json();
      assert.match(r2.access_token, /^pa_/);
      assert.equal((await token({ grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: q.client_id })).status, 400, 'refresh tokens work once');
      assert.equal((await token({ grant_type: 'refresh_token', refresh_token: r2.refresh_token, client_id: 'c_other' })).status, 400, 'bound to the app');

      // a password reset, or switching the member off, ends the Claude sign-in at once
      assert.equal((await ping(r2.access_token)).status, 200);
      await s.admin.post('/api/members/' + L.id + '/password', { password: 'another-long-pass-1' });
      assert.equal((await ping(r2.access_token)).status, 401, 'password reset ends sessions');
    } finally { await s.stop(); }
  });
});
