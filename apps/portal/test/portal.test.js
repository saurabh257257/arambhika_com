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
  return { get: (u) => call('GET', u), post: (u, b) => call('POST', u, b === undefined ? {} : b), patch: (u, b) => call('PATCH', u, b), raw: call, cookie: () => cookie };
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
      assert.equal(c.customer.buyer_type, 'oem', 'the older word "non-trader" now means OEM');
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
      const img = s.app.repo.addFile({ mobile: '9811122233', name: 'shot.png', note: 'UPI payment screenshot for the nickel order', buffer: png }, L.id).file;
      const page = s.app.repo.addFile({ mobile: '9811122233', name: 'x.html', note: 'UPI payment screenshot for the nickel order', buffer: Buffer.from('<script>alert(1)</script>') }, L.id).file;
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

      const v = (m, n, ids) => s.app.repo.addVendor({ name: n, mobile: m, itemIds: ids }, L.id);
      // THE RULE: no vendor without one of our items
      assert.match(v('9000000009', 'Nobody', undefined).error, /must supply at least one of our items/);
      assert.match(v('9000000009', 'Nobody', []).error, /must supply at least one/);
      assert.match(v('9000000009', 'Nobody', ['nope']).error, /do not exist/);
      assert.equal(s.app.repo.vendor('9000000009'), null, 'nothing was created by the refusals');
      assert.equal(v('+91 90000-00001', 'Saurav', ['p1']).vendor.mobile, '9000000001');
      assert.equal(v('9000000001', 'Other', ['p1']).exists, true, 'one vendor per mobile');
      v('9000000002', 'Anil', ['p1']); v('9000000003', 'Meena', ['p2']);
      assert.match(s.app.repo.addVendor({ name: 'Z', mobile: '55', itemIds: ['p1'] }, L.id).error, /valid 10-digit Indian mobile/);

      const o1 = s.app.repo.addOffer({ vendorMobile: '9000000001', itemText: 'nickel strip 0.15', rate: 700, unit: 'kg', quantity: '200 kg' }, L.id);
      assert.equal(o1.mappedTo.id, 'p1', 'one clear match is linked');
      const o2 = s.app.repo.addOffer({ vendorMobile: '9000000002', itemId: 'p1', rate: 650, unit: 'kg', offerDate: '2026-11-01' }, L.id);
      assert.equal(o2.mappedTo.id, 'p1');
      // a rate with no clear item is refused, not saved
      const vague = s.app.repo.addOffer({ vendorMobile: '9000000003', itemText: 'nickel strip', rate: 900, unit: 'kg' }, L.id);
      assert.match(vague.error, /More than one of our items.*item_id p1.*Nothing was saved/s); assert.equal(vague.candidates.length, 2);
      assert.match(s.app.repo.addOffer({ vendorMobile: '9000000003', itemText: 'graphene sheet', rate: 5 }, L.id).error, /None of our items matches/);
      assert.match(s.app.repo.addOffer({ vendorMobile: '9000000003', rate: 5 }, L.id).error, /which of our items/);
      assert.equal(s.app.repo.db.prepare('SELECT COUNT(*) AS n FROM vendor_offers WHERE vendor_mobile = ?').get('9000000003').n, 0, 'nothing saved for the refused rates');
      assert.equal(s.app.repo.addOffer({ vendorMobile: '9000000003', itemId: 'p2', rate: 900, unit: 'kg' }, L.id).mappedTo.id, 'p2');
      assert.equal(s.app.repo.addOffer({ vendorMobile: '9000000001', itemText: 'x', rate: 0 }, L.id).error, 'The rate must be a number above zero');
      assert.equal(s.app.repo.addOffer({ vendorMobile: '9111111111', itemText: 'x', rate: 5 }, L.id).status, 404);
      assert.equal(s.app.repo.addOffer({ vendorMobile: '9000000001', itemId: 'nope', rate: 5 }, L.id).error.startsWith('That item id'), true);
      // a rate for a new item links the vendor to it automatically; link_vendor_items adds items without a rate
      assert.equal(s.app.repo.addOffer({ vendorMobile: '9000000001', itemId: 'p3', rate: 400, unit: 'pcs' }, L.id).mappedTo.id, 'p3');
      assert.deepEqual(s.app.repo.vendor('9000000001').items.map((i) => i.id).sort(), ['p1', 'p3']);
      assert.equal(s.app.repo.linkVendorItems('9000000002', ['p2', 'p2'], L.id).linked, 1);
      assert.match(s.app.repo.linkVendorItems('9000000002', ['nope'], L.id).error, /do not exist/);
      assert.match(s.app.repo.linkVendorItems('9000000002', [], L.id).error, /at least one item id/);
      // Saurav sends a new, lower rate the next day: it replaces the old one in "latest", the old one stays in history
      s.app.repo.addOffer({ vendorMobile: '9000000001', itemId: 'p1', rate: 640, unit: 'kg', offerDate: '2999-01-01' }, L.id);

      const sup = (await s.admin.get('/api/items/p1')).data.item.suppliers;
      assert.deepEqual(sup.map((x) => [x.vendor_name, x.rate]), [['Saurav', 640], ['Anil', 650]], 'cheapest first, one latest rate per vendor');
      assert.equal((await s.admin.get('/api/items')).data.items.find((i) => i.id === 'p1').best.rate, 640);
      // a vendor linked to an item but with no rate yet is listed last, with no rate
      assert.deepEqual(s.app.repo.findSuppliers({ query: 'nickel strip' }).map((x) => [x.vendor_name, x.item.slice(0, 19), x.rate]), [['Saurav', 'Nickel strip 0.15 m', 640], ['Anil', 'Nickel strip 0.15 m', 650], ['Meena', 'Nickel strip 0.20 m', 900], ['Anil', 'Nickel strip 0.20 m', null]]);
      assert.equal(s.app.repo.findSuppliers({ itemId: 'p2' })[0].vendor_name, 'Meena');
      // an older rate that was saved without an item can still be linked afterwards
      s.app.repo.db.prepare("INSERT INTO vendor_offers (id, vendor_mobile, item_id, item_text, rate, unit, quantity, note, offer_date, by_member, at) VALUES ('legacy1', '9000000003', NULL, 'old rate', 5, '', '', '', '2026-01-01', ?, '2026-01-01')").run(L.id);
      assert.equal(s.app.repo.mapOffer('legacy1', 'p2', L.id).ok, true);
      const vd = (await s.admin.get('/api/vendors/9000000001')).data.vendor;
      assert.equal(vd.offers.length, 3); assert.equal(vd.latest.length, 2); assert.equal(vd.latest.find((o) => o.item_id === 'p1').rate, 640); assert.equal(vd.items.find((i) => i.id === 'p1').rate, 640);
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
      const f = s.app.repo.addFile({ mobile: '9811122233', name: 'a.txt', note: 'UPI payment screenshot for the nickel order', buffer: Buffer.from('x') }, L.id).file;
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
      s.app.repo.addVendor({ name: 'Saurav', mobile: '9000000001', itemIds: ['p1'] }, L.id); s.app.repo.addVendor({ name: 'Anil', mobile: '9000000002', itemIds: ['p1'] }, L.id);
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

  test('customers have an owner or nobody; the list filters by state, type, owner, unassigned and needs-attention; contacts hang off a customer', async () => {
    const s = await boot();
    try {
      const L = s.app.repo.createMember({ name: 'Lokesh', username: 'lokesh', password: 'lokesh-pass-1234' }).member;
      const V = s.app.repo.createMember({ name: 'Vikas', username: 'vikas', password: 'vikas-pass-1234' }).member;
      const add = (o, by = L.id) => s.app.repo.addCustomer(o, by);
      add({ name: 'Rao', mobile: '9811122233', state: 'Maharashtra', buyer_type: 'oem', address: 'Plot 4, MIDC', about: 'Makes e-bike packs' });
      add({ name: 'Shah', mobile: '9811122244', state: 'Gujarat', buyer_type: 'trader', ownerId: V.id });
      add({ name: 'Nobody', mobile: '9811122255', state: 'Maharashtra', ownerId: null });
      assert.equal(s.app.repo.customer('9811122233').owner_id, null, 'a new customer starts in nobody\'s basket'); assert.equal(s.app.repo.customer('9811122233').created_by_name, 'Lokesh', 'but shows who created it');
      assert.equal(s.app.repo.customer('9811122255').owner_id, null);
      const names = async (qs) => (await s.admin.get('/api/customers?' + qs)).data.customers.map((c) => c.name).sort();
      assert.deepEqual(await names('state=maharashtra'), ['Nobody', 'Rao']);
      assert.deepEqual(await names('owner=none'), ['Nobody', 'Rao']);
      assert.deepEqual(await names('owner=' + V.id), ['Shah']);
      assert.deepEqual(await names('buyer=oem'), ['Rao']);
      assert.deepEqual((await s.admin.get('/api/customers')).data.options.states.map((x) => x.state), ['Gujarat', 'Maharashtra']);
      assert.equal(s.app.repo.assignCustomer('9811122255', 'vikas', L.id).owner, 'Vikas'); assert.equal(s.app.repo.assignCustomer('9811122233', 'vikas', L.id).owner, 'Vikas');
      assert.deepEqual(await names('owner=none'), []);
      assert.equal(s.app.repo.assignCustomer('9811122233', 'unassigned', L.id).owner, null);
      assert.equal(s.app.repo.assignCustomer('9811122255', 'unassigned', L.id).owner, null);
      assert.match(s.app.repo.assignCustomer('9811122255', 'ghost', L.id).error, /No active team member/);

      // contacts: own mobile each, updated by the same number, blanks never erase
      const k = s.app.repo.saveContact('9811122233', { mobile: '+91 90000 11111', name: 'Anil Rao', role: 'Buyer', email: 'anil@rao.example' }, L.id);
      assert.equal(k.created, true);
      assert.equal(s.app.repo.saveContact('9811122233', { mobile: '9000011111', name: '', role: 'Purchase head', email: '' }, L.id).created, false);
      s.app.repo.saveContact('9811122233', { mobile: '9000022222', name: 'Meena', role: 'Accounts' }, L.id);
      const d = (await s.admin.get('/api/customers/9811122233')).data.customer;
      assert.deepEqual(d.contacts.map((x) => [x.name, x.role, x.email]), [['Anil Rao', 'Purchase head', 'anil@rao.example'], ['Meena', 'Accounts', '']]);
      assert.equal(d.address, 'Plot 4, MIDC'); assert.equal(d.about, 'Makes e-bike packs');
      assert.match(s.app.repo.saveContact('9811122233', { mobile: '123', name: 'X' }, L.id).error, /valid 10-digit mobile/);
      assert.match(s.app.repo.saveContact('9811122233', { mobile: '9000033333' }, L.id).error, /needs a name/);
      assert.equal(s.app.repo.saveContact('9000000000', { mobile: '9000033333', name: 'X' }, L.id).status, 404);
      const lok = client(s.base); await lok.post('/api/auth/login', { username: 'lokesh', password: 'lokesh-pass-1234' });
      assert.equal((await lok.raw('DELETE', '/api/customers/9811122233/contacts/9000022222', {})).status, 403, 'only the admin removes a contact');
      assert.equal((await s.admin.raw('DELETE', '/api/customers/9811122233/contacts/9000022222', {})).status, 200);
      assert.equal((await s.admin.get('/api/customers/9811122233')).data.customer.contacts.length, 1);

      // "needs attention" chips: a late follow-up, quotes, an overdue payment, an order not delivered
      s.app.repo.addInteraction({ mobile: '9811122233', type: 'call', summary: 'Call me back', nextDate: rel(4) }, L.id);
      s.app.repo.saveBooksDocs('9811122233', ZOHO_DOCS(), L.id);
      const row = (await s.admin.get('/api/customers')).data.customers.find((c) => c.name === 'Rao');
      const labels = row.attention.map((a) => a.label);
      assert.equal(row.attention.length, 3, 'at most three chips'); assert.match(labels[0], /Follow-up 4d late/);
      assert.ok(row.attention.every((a) => ['bad', 'warn', 'info'].includes(a.tone)));
      assert.deepEqual(await names('attention=1'), ['Rao'], 'only customers that need something');
      assert.deepEqual((await s.admin.get('/api/customers')).data.customers.find((c) => c.name === 'Shah').attention, []);
    } finally { await s.stop(); }
  });

  test('the list shows who created each customer and who they are assigned to; only the admin changes the assignment', async () => {
    const s = await boot();
    try {
      const L = s.app.repo.createMember({ name: 'Lokesh', username: 'lokesh', password: 'lokesh-pass-1234' }).member;
      const V = s.app.repo.createMember({ name: 'Vikas', username: 'vikas', password: 'vikas-pass-1234' }).member;
      const lok = client(s.base); await lok.post('/api/auth/login', { username: 'lokesh', password: 'lokesh-pass-1234' });
      s.app.repo.addCustomer({ name: 'Rao', mobile: '9811122233' }, L.id);
      let row = (await s.admin.get('/api/customers')).data.customers[0];
      assert.equal(row.created_by_name, 'Lokesh'); assert.equal(row.owner_name, null, 'a new customer starts with a blank basket, even when a team member adds it'); assert.equal(row.owner_id, null);
      assert.equal((await lok.raw('PATCH', '/api/customers/9811122233/assign', { owner: V.id })).status, 403, 'a team member cannot reassign');
      assert.equal((await client(s.base).raw('PATCH', '/api/customers/9811122233/assign', { owner: V.id })).status, 401);
      assert.equal((await s.admin.raw('PATCH', '/api/customers/9811122233/assign', { owner: 'ghost-id' })).status, 400);
      assert.equal((await s.admin.raw('PATCH', '/api/customers/9000000000/assign', { owner: V.id })).status, 404);
      const done = await s.admin.raw('PATCH', '/api/customers/9811122233/assign', { owner: V.id });
      assert.equal(done.status, 200); assert.equal(done.data.owner, 'Vikas');
      row = (await s.admin.get('/api/customers')).data.customers[0];
      assert.equal(row.created_by_name, 'Lokesh', 'created by does not change'); assert.equal(row.owner_name, 'Vikas'); assert.equal(row.owner_id, V.id);
      assert.equal((await s.admin.raw('PATCH', '/api/customers/9811122233/assign', { owner: null })).data.owner, null);
      assert.equal((await s.admin.get('/api/customers?owner=none')).data.customers.length, 1);
      assert.match((await s.admin.get('/api/members')).data.activity[0].action, /Unassigned Rao/);
    } finally { await s.stop(); }
  });

  test('purchases are grouped by our item categories, with pending quotes and what was sold so far', async () => {
    const s = await boot();
    try {
      const L = s.app.repo.createMember({ name: 'Lokesh', username: 'lokesh', password: 'lokesh-pass-1234' }).member;
      await s.app.itemSync.sync();
      s.app.repo.addCustomer({ name: 'Mr Rao', mobile: '9811122233' }, L.id);
      s.app.repo.saveBooksDocs('9811122233', {
        invoices: [
          { number: 'INV-1', date: rel(60), due_date: rel(30), total: 20000, balance: 0, status: 'paid', lines: [{ name: 'Nickel strip 0.15 mm x 8 mm', quantity: 20, rate: 750, total: 15000 }, { name: 'BMS 4S 30A', quantity: 5, rate: 650, total: 3250 }] },
          { number: 'INV-2', date: rel(30), due_date: rel(22), total: 10000, balance: 10000, status: 'sent', lines: [{ name: 'nickel strip 0.15 mm x 8 mm', quantity: 10, rate: 750, total: 7500 }, { name: 'Some custom job', quantity: 1, rate: 2500, total: 2500 }] },
        ],
        quotes: [{ number: 'EST-1', date: rel(3), total: 8000, status: 'sent' }, { number: 'EST-2', date: rel(9), total: 5000, status: 'accepted' }, { number: 'EST-3', date: rel(40), total: 1000, status: 'declined' }],
      }, L.id);
      const b = (await s.admin.get('/api/customers/9811122233/books')).data;
      assert.deepEqual(b.boughtByCategory.map((g) => [g.category, g.value]), [['Nickel strip', 22500], ['BMS', 3250], ['Other', 2500]], 'biggest category first, items we cannot place last');
      const ns = b.boughtByCategory[0].items[0]; assert.equal(ns.quantity, 30); assert.equal(ns.times, 2, 'bought on two invoices (names match without regard to case)');
      assert.deepEqual(b.pendingQuotes.map((q) => q.number).sort(), ['EST-1', 'EST-2'], 'sent and accepted are pending; declined is not');
      assert.equal(b.summary.pendingQuotes, 2); assert.equal(b.summary.pendingQuotesValue, 13000);
      assert.equal(b.summary.billed, 30000); assert.equal(b.summary.collected, 20000); assert.equal(b.summary.outstanding, 10000);
    } finally { await s.stop(); }
  });

  test('suppliers: notes, attachments and details on vendors and items, the collections view, and one update log newest first', async () => {
    const s = await boot();
    try {
      const L = s.app.repo.createMember({ name: 'Lokesh', username: 'lokesh', password: 'lokesh-pass-1234' }).member;
      const lok = client(s.base); await lok.post('/api/auth/login', { username: 'lokesh', password: 'lokesh-pass-1234' });
      await s.app.itemSync.sync();
      s.app.repo.addVendor({ name: 'Saurav', mobile: '9000000001', itemIds: ['p1'], notes: 'First contact via IndiaMART' }, L.id);
      s.app.repo.addOffer({ vendorMobile: '9000000001', itemId: 'p1', rate: 700, unit: 'kg' }, L.id);

      // more details on a vendor, and a note on a vendor and on an item
      assert.deepEqual(s.app.repo.updateVendor('9000000001', { address: 'Lohar Chawl, Mumbai', about: 'Nickel and copper strip', payment_terms: '15 days credit', lead_time: '3 days', min_order: '50 kg', notes: '' }, L.id).changed.sort(), ['about', 'address', 'lead_time', 'min_order', 'payment_terms']);
      assert.equal(s.app.repo.vendor('9000000001').notes, 'First contact via IndiaMART', 'the free-text notes are untouched');
      assert.match(s.app.repo.addNote('vendor', '90000 00001', 'Pays on time', L.id).subject, /Saurav/);
      assert.match(s.app.repo.addNote('item', 'p1', 'Check the thickness on delivery', L.id).subject, /Nickel strip/);
      assert.equal(s.app.repo.addNote('vendor', '9111111111', 'x', L.id).status, 404);
      assert.equal(s.app.repo.addNote('item', 'nope', 'x', L.id).status, 404);
      assert.match(s.app.repo.addNote('vendor', '9000000001', '   ', L.id).error, /Write the note/);
      assert.equal(s.app.repo.addNote('thing', 'x', 'x', L.id).error, 'kind must be vendor or item');

      // attachments: a picture shows in the page, anything else is only a download
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      const pic = s.app.repo.addAttachment({ kind: 'item', key: 'p1', name: 'sample.png', mime: 'image/png', note: 'sample photo', buffer: png }, L.id).attachment;
      const pdf = s.app.repo.addAttachment({ kind: 'vendor', key: '9000000001', name: 'price-list.html', note: 'Saurav price list as a web page', buffer: Buffer.from('<script>alert(1)</script>') }, L.id).attachment;
      assert.equal(s.app.repo.addAttachment({ kind: 'vendor', key: '9111111111', name: 'x.png', note: 'a picture of nothing', buffer: png }, L.id).status, 404);
      assert.match((await s.admin.get('/api/attachments/' + pic.id)).headers.get('content-disposition'), /^inline/);
      const dl = await s.admin.get('/api/attachments/' + pdf.id);
      assert.match(dl.headers.get('content-disposition'), /^attachment/); assert.equal(dl.headers.get('content-type'), 'application/octet-stream');
      assert.equal((await client(s.base).get('/api/attachments/' + pic.id)).status, 401);

      // the pages carry notes, attachments and a log, newest first
      const item = (await s.admin.get('/api/items/p1')).data.item;
      assert.equal(item.notes.length, 1); assert.equal(item.attachments[0].name, 'sample.png');
      assert.ok(item.log.every((e, i, a) => !i || a[i - 1].at >= e.at), 'newest first');
      assert.ok(item.log.some((e) => e.type === 'rate' && /Saurav gave a rate/.test(e.title) && /700/.test(e.text)));
      assert.ok(item.log.some((e) => e.type === 'note') && item.log.some((e) => e.type === 'file') && item.log.some((e) => e.type === 'link'));
      const vend = (await s.admin.get('/api/vendors/9000000001')).data.vendor;
      assert.equal(vend.notes_list[0].text, 'Pays on time'); assert.equal(vend.payment_terms, '15 days credit'); assert.equal(vend.attachments.length, 1);
      assert.ok(vend.log.some((e) => e.type === 'note') && vend.log.some((e) => e.type === 'file') && vend.log.some((e) => e.type === 'vendor'));
      const feed = (await s.admin.get('/api/sourcing/log')).data.log;
      assert.ok(feed.length >= 5); assert.ok(feed.every((e, i, a) => !i || a[i - 1].at >= e.at)); assert.equal((await client(s.base).get('/api/sourcing/log')).status, 401);

      // collections: the items grouped as set up in Zoho Commerce
      const cols = (await s.admin.get('/api/collections')).data.collections;
      assert.deepEqual(cols.map((c) => c.name), ['18650', 'Not in a collection']);
      assert.equal(cols[0].items[0].best.rate, 700); assert.equal(cols[0].vendors, 1);

      // only the admin removes a note or a file; deleting a vendor takes them along
      const noteId = vend.notes_list[0].id;
      assert.equal((await lok.raw('DELETE', '/api/notes/' + noteId, {})).status, 403);
      assert.equal((await lok.raw('DELETE', '/api/attachments/' + pdf.id, {})).status, 403);
      assert.equal((await s.admin.raw('DELETE', '/api/notes/' + noteId, {})).status, 200);
      assert.equal(s.app.repo.vendor('9000000001').notes_list.length, 0);
      assert.equal((await s.admin.raw('DELETE', '/api/vendors/9000000001', { confirm: '9000000001' })).status, 200);
      assert.equal(s.app.repo.db.prepare("SELECT COUNT(*) AS n FROM attachments WHERE kind = 'vendor'").get().n, 0);
      assert.equal(fs.existsSync(s.app.repo.filePath(pdf.id)), false, 'the vendor files are gone from disk');
      assert.equal(s.app.repo.attachments('item', 'p1').length, 1, 'the item keeps its own picture');
    } finally { await s.stop(); }
  });

  test('files are saved exactly as given, with a short description; a damaged or cut-off file is refused; the page uploads the original bytes', async () => {
    const s = await boot();
    try {
      const L = s.app.repo.createMember({ name: 'Lokesh', username: 'lokesh', password: 'lokesh-pass-1234' }).member;
      const lok = client(s.base); await lok.post('/api/auth/login', { username: 'lokesh', password: 'lokesh-pass-1234' });
      await s.app.itemSync.sync();
      s.app.repo.addCustomer({ name: 'Mr Rao', mobile: '9811122233' }, L.id);
      s.app.repo.addVendor({ name: 'Saurav', mobile: '9000000001', itemIds: ['p1'] }, L.id);
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      const add = (o) => s.app.repo.addFile({ mobile: '9811122233', name: 'shot.png', note: 'UPI payment screenshot, 15 Nov', buffer: png, ...o }, L.id);

      // a cut-off or altered picture is refused, and nothing is saved
      const cut = add({ buffer: png.subarray(0, png.length - 9) }); assert.match(cut.error, /arrived damaged/); assert.match(cut.error, /Add a file button/);
      const changed = Buffer.from(png); changed[30] ^= 0xff; assert.match(add({ buffer: changed }).error, /arrived damaged/);
      assert.match(add({ name: 'photo.jpg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]) }).error, /cut off/);
      assert.match(add({ name: 'doc.pdf', buffer: Buffer.from('%PDF-1.4 half a document') }).error, /cut off/);
      assert.equal(s.app.repo.db.prepare('SELECT COUNT(*) AS n FROM files').get().n, 0);
      // a description of a few words is required
      assert.match(add({ note: '' }).error, /short description/); assert.match(add({ note: 'pic' }).error, /short description/);
      // a whole file is kept byte for byte, and its type comes from its name, not from the sender
      const ok = add({ mime: 'text/html' }).file; assert.equal(ok.mime, 'image/png'); assert.equal(ok.note, 'UPI payment screenshot, 15 Nov');
      assert.ok(fs.readFileSync(s.app.repo.filePath(ok.id)).equals(png), 'saved exactly as it was');

      // from the page: the original bytes, with the description, for a customer, a vendor and an item
      const up = (q, body, headers = { 'X-Portal-Upload': '1' }) => fetch(s.base + '/api/upload?' + new URLSearchParams(q), { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', Cookie: lok.cookie(), ...headers }, body });
      const orig = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from(Array.from({ length: 5000 }, (_, i) => i % 256)), Buffer.from('\n%%EOF\n')]);
      const r1 = await up({ kind: 'customer', key: '9811122233', name: 'quotation.pdf', note: 'Signed quotation for 20 kg nickel strip' }, orig);
      assert.equal(r1.status, 200);
      const stored = (await s.admin.get('/api/customers/9811122233')).data.customer.files.find((f) => f.name === 'quotation.pdf');
      assert.equal(stored.note, 'Signed quotation for 20 kg nickel strip'); assert.equal(stored.size, orig.length);
      assert.ok(fs.readFileSync(s.app.repo.filePath(stored.id)).equals(orig), 'every byte of the original is kept');
      assert.equal((await up({ kind: 'vendor', key: '9000000001', name: 'list.png', note: 'Saurav price list photo' }, png)).status, 200);
      assert.equal((await up({ kind: 'item', key: 'p1', name: 'sample.png', note: 'Sample photo of the strip' }, png)).status, 200);
      assert.equal((await s.admin.get('/api/vendors/9000000001')).data.vendor.attachments[0].note, 'Saurav price list photo');
      assert.equal((await up({ kind: 'item', key: 'p1', name: 'broken.png', note: 'a broken picture here' }, png.subarray(0, 40))).status, 400, 'the page refuses a damaged file too');
      assert.equal((await up({ kind: 'item', key: 'p1', name: 'x.png', note: '' }, png)).status, 400, 'a description is needed');
      assert.equal((await up({ kind: 'customer', key: '9000000000', name: 'x.png', note: 'for nobody at all' }, png)).status, 404);
      assert.equal((await up({ kind: 'thing', key: 'x', name: 'x.png', note: 'for nothing at all' }, png)).status, 404);
      assert.equal((await up({ kind: 'item', key: 'p1', name: 'x.png', note: 'sneaky cross site' }, png, {})).status, 400, 'needs the portal header');
      assert.equal((await fetch(s.base + '/api/upload?kind=item&key=p1&name=x.png&note=not+signed+in', { method: 'POST', headers: { 'X-Portal-Upload': '1' }, body: png })).status, 401);
      // and it can always be downloaded exactly as saved
      const dl = await fetch(s.base + '/api/files/' + stored.id + '?download=1', { headers: { Cookie: lok.cookie() } });
      assert.match(dl.headers.get('content-disposition'), /^attachment/); assert.ok(Buffer.from(await dl.arrayBuffer()).equals(orig));
    } finally { await s.stop(); }
  });

  test('the admin sets a password by hand, deletes a member (history keeps the name, the basket empties), and the team list shows basket counts', async () => {
    const s = await boot();
    try {
      const L = s.app.repo.createMember({ name: 'Lokesh', username: 'lokesh', password: 'lokesh-pass-1234' }).member;
      const V = s.app.repo.createMember({ name: 'Vikas', username: 'vikas', password: 'vikas-pass-1234' }).member;
      const lok = client(s.base); await lok.post('/api/auth/login', { username: 'lokesh', password: 'lokesh-pass-1234' });
      s.app.repo.addCustomer({ name: 'A', mobile: '9811122233' }, L.id); s.app.repo.addCustomer({ name: 'B', mobile: '9811122244' }, L.id); s.app.repo.addCustomer({ name: 'C', mobile: '9811122255' }, V.id);
      s.app.repo.assignCustomer('9811122233', 'lokesh', 'admin'); s.app.repo.assignCustomer('9811122244', 'lokesh', 'admin');
      s.app.repo.addInteraction({ mobile: '9811122233', type: 'call', summary: 'Spoke to A' }, L.id);
      const key = s.app.repo.createKey(L.id).key;

      // the people list drives the basket tabs
      const ppl = (await lok.get('/api/people')).data;
      assert.deepEqual(ppl.people.map((p) => [p.name, p.customers]), [['Lokesh', 2], ['Vikas', 0]]); assert.equal(ppl.unassigned, 1);

      // a password typed by the admin works, and the old one stops
      assert.equal((await s.admin.post('/api/members/' + V.id + '/password', { password: 'short' })).status, 400);
      assert.equal((await s.admin.post('/api/members/' + V.id + '/password', { password: 'the-password-I-chose-1' })).status, 200);
      assert.equal((await client(s.base).post('/api/auth/login', { username: 'vikas', password: 'vikas-pass-1234' })).status, 401);
      assert.equal((await client(s.base).post('/api/auth/login', { username: 'vikas', password: 'the-password-I-chose-1' })).status, 200);

      // deleting a member: admin only, and only after typing their username
      assert.equal((await lok.raw('DELETE', '/api/members/' + L.id, { confirm: 'lokesh' })).status, 403);
      assert.equal((await s.admin.raw('DELETE', '/api/members/' + L.id, {})).status, 400);
      assert.equal((await s.admin.raw('DELETE', '/api/members/' + L.id, { confirm: 'vikas' })).status, 400, 'the wrong username does not count');
      assert.equal((await s.admin.raw('DELETE', '/api/members/nope', { confirm: 'x' })).status, 404);
      assert.equal(s.app.repo.member(L.id).active, 1, 'nothing happened after the refusals');
      const gone = await s.admin.raw('DELETE', '/api/members/' + L.id, { confirm: 'Lokesh' });
      assert.equal(gone.status, 200); assert.equal(gone.data.unassigned, 2);
      assert.equal((await s.admin.get('/api/members')).data.members.some((m) => m.username === 'lokesh'), false, 'gone from the list');
      assert.deepEqual((await s.admin.get('/api/people')).data.people.map((p) => p.name), ['Vikas']);
      assert.equal((await s.admin.get('/api/people')).data.unassigned, 3, 'their two customers are back with nobody, plus the one that was already unassigned');
      assert.equal((await client(s.base).post('/api/auth/login', { username: 'lokesh', password: 'lokesh-pass-1234' })).status, 401, 'cannot sign in');
      assert.equal((await lok.get('/api/customers')).status, 401, 'an open session ends at once');
      assert.equal((await fetch(s.base + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: '{}' })).status, 401, 'the key stops');
      // the history still says who did it
      const a = (await s.admin.get('/api/customers/9811122233')).data.customer;
      assert.equal(a.created_by_name, 'Lokesh'); assert.equal(a.interactions[0].by_name, 'Lokesh'); assert.equal(a.owner_id, null);
      assert.match((await s.admin.get('/api/members')).data.activity[0].action, /DELETED member Lokesh \(lokesh\); 2 customers went back to unassigned/);
      // the username can be used again by a new person
      assert.equal((await s.admin.post('/api/members', { name: 'Lokesh Two', username: 'lokesh', password: 'another-long-pass-1' })).status, 200);
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
      const health = await (await fetch(s.base + '/health')).json();
      assert.equal(health.status, 'ok'); assert.match(health.schema, /^[0-9a-f]{8}$/); assert.ok(health.tools >= 20, 'the server says which tool set it serves');
      const v2 = await fetch(s.base + '/mcp/v2', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
      const addVendorTool = (await v2.json()).result.tools.find((t) => t.name === 'add_vendor');
      assert.ok(addVendorTool.inputSchema.properties.item_ids && addVendorTool.inputSchema.required.includes('item_ids'), '/mcp/v2 serves the current add_vendor with item_ids');
      assert.equal((await fetch(s.base + '/mcp/v2', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401, 'the fresh address needs sign-in too');
      assert.equal((await rpc(s.base, '', 'initialize', {})).status, 401, 'no key');
      assert.equal((await rpc(s.base, 'pk_wrongwrongwrongwrongwrong', 'initialize', {})).status, 401, 'wrong key');
      assert.equal((await fetch(s.base + '/mcp', { headers: { Authorization: 'Bearer ' + key } })).status, 405);
      const init = await (await rpc(s.base, key, 'initialize', { protocolVersion: '2025-06-18' })).json();
      assert.equal(init.result.protocolVersion, '2025-06-18'); assert.match(init.result.instructions, /mobile number/);
      assert.equal((await fetch(s.base + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) })).status, 202);
      const names = (await (await rpc(s.base, key, 'tools/list')).json()).result.tools.map((t) => t.name);
      for (const n of ['add_customer', 'update_customer', 'customer_purchases', 'search_items', 'get_item', 'add_vendor', 'link_vendor_items', 'add_note', 'add_attachment', 'recent_updates', 'set_zoho_directory_status', 'log_vendor_rate', 'map_vendor_rate', 'find_suppliers', 'get_vendor', 'search_vendors']) assert.ok(names.includes(n), n);
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
      assert.equal(s.app.repo.customer('9811122233').owner_id, null, 'created through Claude: blank basket');
      assert.equal(data(await call(s.base, key, 'get_customer', { mobile: '9811122233' })).basket, 'unassigned');
      const sneak = data(await call(s.base, key, 'add_customer', { mobile: '9811177799', name: 'Tried to take it', owner_username: 'lokesh' }));
      assert.equal(s.app.repo.customer('9811177799').owner_id, null, 'naming an owner when adding changes nothing'); assert.equal(sneak.basket, 'unassigned');
      s.app.repo.assignCustomer('9811122233', 'lokesh', 'admin'); // the admin puts them in Lokesh's basket in the portal
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      assert.equal((await call(s.base, key, 'log_interaction', { mobile: '9811122233', type: 'call', summary: 'Wants nickel strip', next_date: yesterday })).isError, undefined);
      assert.equal(data(await call(s.base, key, 'my_follow_ups', {})).length, 1);
      await call(s.base, key, 'log_interaction', { mobile: '9811122233', type: 'quote', summary: 'Sent quote', amount: 15000 });
      assert.equal(data(await call(s.base, key, 'my_follow_ups', {})).length, 0, 'a later entry without a date closes it');
      const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      assert.equal(data(await call(s.base, key, 'add_file', { mobile: '9811122233', name: 'shot.png', note: 'Payment screenshot for the nickel order', data_base64: png })).saved, true);
      assert.equal((await call(s.base, key, 'add_file', { mobile: '9811122233', name: 'bad', note: 'not valid at all', data_base64: '!!!' })).isError, true);
      assert.equal(data(await call(s.base, key, 'search_customers', { query: 'rao' }))[0].basket, 'Lokesh');
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
      // THE RULE through Claude: no item, no vendor
      const noItem = await call(s.base, key, 'add_vendor', { mobile: '90000 00001', name: 'Rx Infotech', item_ids: [] });
      assert.equal(noItem.isError, true); assert.match(noItem.content[0].text, /at least one of our items/);
      assert.equal((await call(s.base, key, 'add_vendor', { mobile: '90000 00001', name: 'Rx Infotech' })).isError, true, 'item_ids missing');
      assert.equal((await call(s.base, key, 'add_vendor', { mobile: '90000 00001', name: 'Rx Infotech', item_ids: ['made-up'] })).isError, true);
      assert.equal(data(await call(s.base, key, 'search_vendors', { query: 'rx' })).length, 0, 'the refused vendor does not exist');
      const addV = data(await call(s.base, key, 'add_vendor', { mobile: '90000 00001', name: 'Saurav', city: 'Mumbai', item_ids: [itemId] }));
      assert.equal(addV.saved, true); assert.match(addV.supplies[0], /Nickel strip 0\.15/);
      assert.equal((await call(s.base, key, 'add_vendor', { mobile: '9000000001', name: 'Dup', item_ids: [itemId] })).isError, true, 'one vendor per mobile');
      const rate = data(await call(s.base, key, 'log_vendor_rate', { vendor_mobile: '9000000001', material: 'nickel strip 0.15', rate: 700, unit: 'kg', quantity: '200 kg', valid_till: '2999-12-31' }));
      assert.equal(rate.item.id, itemId);
      const vague = await call(s.base, key, 'log_vendor_rate', { vendor_mobile: '9000000001', material: 'nickel strip', rate: 810, unit: 'kg' });
      assert.equal(vague.isError, true); assert.match(vague.content[0].text, /More than one of our items/); assert.match(vague.content[0].text, /Nothing was saved/);
      assert.equal((await call(s.base, key, 'log_vendor_rate', { vendor_mobile: '9000000001', material: 'graphene', rate: 5 })).isError, true);
      assert.equal(data(await call(s.base, key, 'log_vendor_rate', { vendor_mobile: '9000000001', item_id: itemId, rate: 810, unit: 'kg' })).saved, true);
      const bms = data(await call(s.base, key, 'search_items', { query: 'bms' }))[0].id;
      assert.equal(data(await call(s.base, key, 'link_vendor_items', { mobile: '9000000001', item_ids: [bms] })).newly_linked, 1);
      assert.equal((await call(s.base, key, 'link_vendor_items', { mobile: '9000000001', item_ids: ['nope'] })).isError, true);
      assert.equal(data(await call(s.base, key, 'find_suppliers', { item_id: itemId }))[0].rate, 810, 'the latest rate wins');
      assert.equal(data(await call(s.base, key, 'find_suppliers', { query: 'nickel' })).length, 1);
      assert.equal(data(await call(s.base, key, 'get_item', { item_id: itemId })).suppliers.length, 1);
      const gv = data(await call(s.base, key, 'get_vendor', { mobile: '9000000001' })); assert.equal(gv.history.length, 2); assert.equal(gv.supplies.length, 2); assert.equal(gv.supplies.find((x) => x.item_id === itemId).latest_rate, 810);
      assert.equal(data(await call(s.base, key, 'search_vendors', { query: 'nickel' })).length, 1);
      // details, notes and files on a vendor or an item, all through Claude
      assert.equal(data(await call(s.base, key, 'update_vendor', { mobile: '9000000001', payment_terms: '15 days', lead_time: '3 days', about: 'Nickel strip maker' })).changed.length, 3);
      assert.equal(data(await call(s.base, key, 'add_note', { kind: 'vendor', key: '90000 00001', text: 'Pays on time' })).saved, true);
      assert.equal(data(await call(s.base, key, 'add_note', { kind: 'item', key: itemId, text: 'Check thickness on delivery' })).saved, true);
      assert.equal((await call(s.base, key, 'add_note', { kind: 'item', key: 'nope', text: 'x' })).isError, true);
      const att = data(await call(s.base, key, 'add_attachment', { kind: 'vendor', key: '9000000001', name: 'price-list.png', data_base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', note: 'November list' }));
      assert.equal(att.saved, true);
      assert.equal((await call(s.base, key, 'add_attachment', { kind: 'vendor', key: '9000000001', name: 'bad', note: 'not valid at all', data_base64: '!!!' })).isError, true);
      const gv2 = data(await call(s.base, key, 'get_vendor', { mobile: '9000000001' }));
      assert.equal(gv2.payment_terms, '15 days'); assert.equal(gv2.dated_notes[0].text, 'Pays on time'); assert.equal(gv2.attachments[0].note, 'November list'); assert.ok(gv2.recent_updates.length >= 3);
      assert.equal(data(await call(s.base, key, 'get_item', { item_id: itemId })).notes[0].text, 'Check thickness on delivery');
      assert.ok(data(await call(s.base, key, 'recent_updates', { limit: 5 })).length >= 3);
      assert.ok(data(await call(s.base, key, 'recent_updates', { item_id: itemId })).length >= 2);
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
      assert.ok(byField.buyer_type.options.includes('trader') && byField.buyer_type.options.includes('oem') && !byField.buyer_type.options.includes('unknown'));
      assert.ok(byField.business.options.includes('battery_pack_maker'));
      assert.match(byField.company.look_in, /Zoho Books/);
      assert.deepEqual(p.unknown.slice(0, 3).map((u) => u.field), ['zoho_status', 'company', 'about'], 'asked in a sensible order, the Zoho directory first');
      assert.match(byField.zoho_status.look_in, /Zoho Books connector/);

      assert.match(p.how, /Zoho Books connector/);
      // what Claude finds in Zoho Books is saved with update_customer, and a detail already known is not overwritten by blanks
      const up = data(await call(s.base, key, 'update_customer', { mobile: '9811122233', company: 'Rao Traders Pvt Ltd', about: 'Makes e-bike battery packs', address: 'Plot 4, MIDC, Bhosari', gstin: '27ABCDE1234F1Z5', city: 'Pune', state: 'Maharashtra', pincode: '411001', email: '' }));
      assert.deepEqual(up.changed.sort(), ['about', 'address', 'city', 'company', 'gstin', 'pincode', 'state']);
      // is the customer in the Zoho Books directory? Claude looks and reports; the page shows a tile
      assert.equal(s.app.repo.customer('9811122233').zoho_status, '');
      assert.equal(data(await call(s.base, key, 'get_customer', { mobile: '9811122233' })).zoho_directory, 'not checked');
      const nc = data(await call(s.base, key, 'set_zoho_directory_status', { mobile: '9811122233', created: false }));
      assert.equal(nc.zoho_directory, 'not created yet'); assert.match(nc.next, /still has to be created in Zoho Books/);
      assert.equal(data(await call(s.base, key, 'get_customer', { mobile: '9811122233' })).zoho_directory, 'not created');
      assert.equal(data(await call(s.base, key, 'set_zoho_directory_status', { mobile: '9811122233', created: true, zoho_contact_name: 'Rao Traders Pvt Ltd' })).zoho_directory, 'created');
      const cz = (await s.admin.get('/api/customers/9811122233')).data.customer; assert.equal(cz.zoho_status, 'created'); assert.equal(cz.zoho_contact, 'Rao Traders Pvt Ltd'); assert.ok(cz.zoho_checked_at);
      assert.equal((await call(s.base, key, 'set_zoho_directory_status', { mobile: '9000000000', created: true })).isError, true);
      assert.deepEqual(data(await call(s.base, key, 'complete_profile', { mobile: '9811122233' })).unknown.slice(0, 1).map((u) => u.field), ['source']);
      // saving their Zoho documents also proves they are in the directory
      s.app.repo.addCustomer({ name: 'Other', mobile: '9811100009' }, L.id);
      s.app.repo.saveBooksDocs('9811100009', { quotes: [{ number: 'EST-9', total: 1, status: 'sent' }] }, L.id);
      assert.equal(s.app.repo.customer('9811100009').zoho_status, 'created');
      assert.equal((await call(s.base, key, 'complete_profile', { mobile: '9000000000' })).isError, true);

      // OEM or trader, who looks after them, and the other people there: all through Claude
      s.app.repo.createMember({ name: 'Vikas', username: 'vikas', password: 'vikas-pass-1234' });
      assert.equal(data(await call(s.base, key, 'update_customer', { mobile: '9811122233', buyer_type: 'oem', address: 'Plot 4, MIDC', about: 'Makes e-bike packs' })).saved, true);
      assert.equal(s.app.repo.customer('9811122233').owner_id, null, 'added by Lokesh through Claude: nobody\'s basket until the admin assigns it');
      // assigning is the admin's job: a team member who tries through Claude is told so, and nothing changes
      const refused = await call(s.base, key, 'assign_customer', { mobile: '9811122233', owner_username: 'vikas' });
      assert.equal(refused.isError, true); assert.match(refused.content[0].text, /Only the admin can change who a customer is assigned to/);
      assert.equal(s.app.repo.customer('9811122233').owner_name, null, 'a refused change leaves the basket as it was');
      const sneaky = data(await call(s.base, key, 'add_customer', { mobile: '9811177777', name: 'For Vikas', owner_username: 'vikas' }));
      assert.equal(s.app.repo.customer('9811177777').owner_id, null, 'a member cannot put a new customer in anyone\'s basket'); assert.equal(sneaky.basket, 'unassigned');
      // the admin's side: done in the portal
      assert.equal(s.app.repo.assignCustomer('9811122233', 'vikas', 'admin').owner, 'Vikas');
      assert.equal(data(await call(s.base, key, 'search_customers', { owner_username: 'vikas' })).length, 1);
      assert.equal(data(await call(s.base, key, 'get_customer', { mobile: '9811122233' })).created_by, 'Lokesh', 'who created it never changes');
      assert.equal(data(await call(s.base, key, 'get_customer', { mobile: '9811122233' })).basket, 'Vikas');
      assert.equal(s.app.repo.assignCustomer('9811122233', 'unassigned', 'admin').owner, null);
      assert.ok(data(await call(s.base, key, 'search_customers', { owner_username: 'unassigned' })).some((x) => x.name === 'Mr Rao'), 'unassigned customers are listed');
      assert.equal(data(await call(s.base, key, 'save_customer_contact', { mobile: '9811122233', contact_mobile: '90000 11111', name: 'Anil Rao', role: 'Buyer' })).created, true);
      assert.equal((await call(s.base, key, 'save_customer_contact', { mobile: '9811122233', contact_mobile: '12', name: 'Bad' })).isError, true);
      const withContacts = data(await call(s.base, key, 'get_customer', { mobile: '9811122233' }));
      assert.deepEqual(withContacts.contacts.map((k) => [k.name, k.role, k.mobile]), [['Anil Rao', 'Buyer', '9000011111']]);
      assert.equal(withContacts.about, 'Makes e-bike packs'); assert.equal(withContacts.buyer_type, 'oem');
      assert.equal(data(await call(s.base, key, 'search_customers', { state: 'Maharashtra' })).length, 1, 'state filter');

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
      assert.match(r401.headers.get('www-authenticate'), /resource_metadata="http:\/\/127\.0\.0\.1:\d+\/\.well-known\/oauth-protected-resource\/mcp"/);
      const pr = await (await fetch(s.base + '/.well-known/oauth-protected-resource/mcp')).json();
      assert.equal((await (await fetch(s.base + '/.well-known/oauth-protected-resource/mcp/v2')).json()).resource, s.base + '/mcp/v2', 'the fresh address is its own resource');
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
