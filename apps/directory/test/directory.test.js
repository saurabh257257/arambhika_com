'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { createApp } = require('../app');
const { crc32 } = require('../lib/filecheck');

function client(base) {
  let cookie = '';
  const call = async (method, url, body, headers = {}) => {
    const res = await fetch(base + url, { method, redirect: 'manual', headers: { ...(body !== undefined && !Buffer.isBuffer(body) ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body) });
    const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (set.length) { const c = set[0].split(';')[0]; cookie = c.endsWith('=') ? '' : c; }
    const type = res.headers.get('content-type') || '';
    return { status: res.status, headers: res.headers, data: type.includes('json') ? await res.json() : await res.text(), location: res.headers.get('location') };
  };
  return { get: (u) => call('GET', u), post: (u, b) => call('POST', u, b === undefined ? {} : b), put: (u, b) => call('PUT', u, b), patch: (u, b) => call('PATCH', u, b), del: (u) => call('DELETE', u, {}), raw: call };
}

// a real, whole PNG (so the integrity check accepts it)
function png() {
  const chunk = (type, data) => { const t = Buffer.from(type), len = Buffer.alloc(4); len.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.alloc(14))), chunk('IEND', Buffer.alloc(0))]);
}

async function boot(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'directory-'));
  const app = createApp({ dataDir: dir, adminMobile: '8112662827', sessionSecret: 'test-secret', devOtp: '1234', ...opts });
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const login = async (mobile) => { const c = client(base); await c.post('/api/auth/send-otp', { mobile }); const r = await c.post('/api/auth/verify-otp', { mobile, otp: '1234' }); assert.equal(r.status, 200, 'login ' + mobile); return c; };
  return { app, base, login, stop: () => new Promise((r) => server.close(() => { app.repo.close(); r(); })) };
}

const LISTING = { title: '48V 30Ah LiFePO4 battery pack', category_id: 1, description: 'Made in our Pune plant with a smart BMS and a two year warranty.', price: '38500', voltage: '48', capacity_ah: '30', chemistry: 'LiFePO4', state: 'Maharashtra', city: 'Pune', whatsapp: '9811122233' };

describe('lithium directory', () => {
  test('login: mobile OTP only; wrong code, bad number and rate limits are refused; the session cookie cannot be forged', async () => {
    const s = await boot();
    try {
      const c = client(s.base);
      assert.equal((await c.post('/api/auth/send-otp', { mobile: '12345' })).status, 400);
      assert.equal((await c.post('/api/auth/send-otp', { mobile: '9811122233' })).status, 200);
      assert.equal((await c.post('/api/auth/send-otp', { mobile: '9811122233' })).status, 429, 'a second code within 30 seconds');
      assert.equal((await c.post('/api/auth/verify-otp', { mobile: '9811122233', otp: '9999' })).status, 401);
      assert.equal((await c.get('/api/my/listings')).status, 401);
      const ok = await c.post('/api/auth/verify-otp', { mobile: '+91 98111-22233', otp: '1234' });
      assert.equal(ok.status, 200); assert.equal(ok.data.admin, false);
      assert.equal((await c.get('/api/me')).data.mobile, '9811122233');
      // a cookie made up by hand is no good
      const forged = client(s.base); const r = await fetch(s.base + '/api/me', { headers: { Cookie: 'ld_session=9811122233.' + (Date.now() + 1e9) + '.forged' } });
      assert.equal((await r.json()).loggedIn, false); assert.ok(forged);
      // five wrong codes lock the number
      const d = client(s.base); await d.post('/api/auth/send-otp', { mobile: '9000000001' });
      for (let i = 0; i < 5; i++) await d.post('/api/auth/verify-otp', { mobile: '9000000001', otp: '0000' });
      assert.equal((await d.post('/api/auth/verify-otp', { mobile: '9000000001', otp: '1234' })).status, 429);
    } finally { await s.stop(); }
  });

  test('with no SMS keys and no dev code, login is off; with MSG91 keys the SMS provider is called and its answer decides', async () => {
    const off = await boot({ devOtp: '' });
    try { assert.equal((await client(off.base).post('/api/auth/send-otp', { mobile: '9811122233' })).status, 503); } finally { await off.stop(); }
    const calls = [];
    const fetchFn = async (url, o) => { calls.push([o.method, url]); return { ok: true, json: async () => ({ type: url.includes('/otp/verify') && !/otp=4321/.test(url) ? 'error' : 'success' }) }; };
    const s = await boot({ devOtp: '', msg91: { authKey: 'k', templateId: 't', length: 4, expiry: 5 }, fetchFn });
    try {
      const c = client(s.base);
      assert.equal((await c.post('/api/auth/send-otp', { mobile: '9811122233' })).status, 200);
      assert.match(calls[0][1], /\/otp\?template_id=t&mobile=919811122233&otp_length=4/);
      assert.equal((await c.post('/api/auth/verify-otp', { mobile: '9811122233', otp: '1111' })).status, 401);
      assert.equal((await c.post('/api/auth/verify-otp', { mobile: '9811122233', otp: '4321' })).status, 200);
    } finally { await s.stop(); }
  });

  test('a seller adds a product (reviewed first), the admin approves it, it shows on the public pages and the WhatsApp button records a lead', async () => {
    const s = await boot();
    try {
      const seller = await s.login('9811122233');
      assert.match((await seller.post('/api/my/listings', LISTING)).data.error, /name and business/, 'profile first');
      assert.equal((await seller.put('/api/profile', { name: 'Anil', business: 'Shakti Batteries', city: 'Pune', state: 'Maharashtra' })).status, 200);
      // validation
      assert.match((await seller.post('/api/my/listings', { ...LISTING, title: 'x' })).data.error, /name/);
      assert.match((await seller.post('/api/my/listings', { ...LISTING, voltage: 'abc' })).data.error, /Voltage/);
      assert.match((await seller.post('/api/my/listings', { ...LISTING, state: 'Atlantis' })).data.error, /state/);
      assert.match((await seller.post('/api/my/listings', { ...LISTING, whatsapp: '12345' })).data.error, /WhatsApp/);
      const made = (await seller.post('/api/my/listings', LISTING)).data; assert.equal(made.status, 'pending');
      // photos: original bytes, checked for damage; only JPG/PNG/WebP; needs the header
      const up = (name, body, hdr = { 'X-LD-Upload': '1' }) => seller.raw('POST', '/api/upload?listing=' + made.id + '&name=' + name, body, { 'Content-Type': 'application/octet-stream', ...hdr });
      assert.equal((await up('front.png', png(), {})).status, 400, 'header needed');
      assert.equal((await up('front.png', png())).status, 200);
      assert.equal((await up('bad.png', Buffer.from('not a picture'))).status, 400, 'damaged picture');
      assert.equal((await up('doc.pdf', Buffer.from('%PDF'))).status, 400, 'only pictures');

      // not public yet
      assert.equal((await client(s.base).get('/p/' + made.id)).status, 404);
      assert.doesNotMatch((await client(s.base).get('/browse')).data, /LiFePO4 battery pack/);

      // someone else cannot touch it; the admin can approve
      const other = await s.login('9822233344'); await other.put('/api/profile', { name: 'B', business: 'Other Co' });
      assert.equal((await other.put('/api/my/listings/' + made.id, LISTING)).status, 403);
      assert.equal((await other.del('/api/my/listings/' + made.id)).status, 403);
      assert.equal((await seller.patch('/api/my/listings/' + made.id, { status: 'live' })).status, 400, 'a seller cannot approve their own');
      assert.equal((await seller.get('/api/admin/listings')).status, 403);
      const admin = await s.login('8112662827');
      assert.equal((await admin.get('/api/admin/listings?status=pending')).data.listings.length, 1);
      assert.equal((await admin.patch('/api/admin/listings/' + made.id, { status: 'live' })).status, 200);

      // public pages
      const anon = client(s.base);
      const home = (await anon.get('/')).data; assert.match(home, /Find lithium-ion batteries/); assert.match(home, /48V 30Ah LiFePO4 battery pack/);
      const p = await anon.get('/p/' + made.id); assert.equal(p.location, '/p/' + made.id + '-48v-30ah-lifepo4-battery-pack', 'canonical address'); // redirected
      const page = await anon.get(p.location); assert.equal(page.status, 200);
      assert.match(page.data, /Chat on WhatsApp/); assert.match(page.data, /Shakti Batteries/); assert.match(page.data, /1440 Wh/, 'energy worked out from V x Ah'); assert.match(page.data, /application\/ld\+json/);
      assert.doesNotMatch(page.data, /9811122233/, "the seller's number is not printed on the page");
      assert.match((await anon.get('/browse?category=battery-packs')).data, /1 product found/);
      assert.match((await anon.get('/browse?q=lifepo4&state=Maharashtra&minVoltage=40')).data, /1 product found/);
      assert.match((await anon.get('/browse?q=lifepo4&state=Kerala')).data, /0 products found/);
      assert.match((await anon.get('/sitemap.xml')).data, /48v-30ah-lifepo4-battery-pack/);
      const img = await fetch(s.base + page.data.match(/src="(\/img\/\d+)"/)[1]); assert.equal(img.headers.get('content-type'), 'image/png');

      // the WhatsApp button: opens the seller's chat, records a lead once per visitor per product
      const go = await anon.get('/go/' + made.id);
      assert.equal(go.status, 302); assert.match(go.location, /^https:\/\/wa\.me\/919811122233\?text=Hi%2C%20I%20saw/);
      await anon.get('/go/' + made.id);
      assert.equal((await admin.get('/api/admin/leads')).data.leads.length, 1, 'repeat taps do not inflate the count');
      assert.equal((await seller.get('/api/my/listings')).data.leads.length, 1);

      // approval makes the seller trusted: the next product goes straight to live
      assert.equal((await seller.post('/api/my/listings', { ...LISTING, title: '60V 40Ah e-bike battery' })).data.status, 'live');
      // the seller can hide a product, and it disappears
      assert.equal((await seller.patch('/api/my/listings/' + made.id, { status: 'hidden' })).status, 200);
      assert.equal((await anon.get('/p/' + made.id)).status, 404);
    } finally { await s.stop(); }
  });

  test('categories can be created by sellers (limited), renamed and removed by the admin only when empty', async () => {
    const s = await boot();
    try {
      const seller = await s.login('9811122233'); const admin = await s.login('8112662827');
      const first = (await seller.post('/api/categories', { name: 'Golf cart batteries' })).data; assert.equal(first.category.slug, 'golf-cart-batteries');
      assert.equal((await seller.post('/api/categories', { name: 'golf CART batteries' })).data.existing, true, 'no duplicates');
      assert.equal((await seller.post('/api/categories', { name: 'Marine batteries' })).status, 200);
      assert.equal((await seller.post('/api/categories', { name: 'Drone batteries' })).status, 200);
      assert.match((await seller.post('/api/categories', { name: 'Forklift batteries' })).data.error, /3 new categories/);
      assert.equal((await seller.patch('/api/admin/categories/' + first.category.id, { name: 'X' })).status, 403);
      assert.equal((await admin.patch('/api/admin/categories/' + first.category.id, { name: 'Golf and cart batteries' })).status, 200);
      assert.equal((await admin.del('/api/admin/categories/' + first.category.id)).status, 200);
      await seller.put('/api/profile', { name: 'Anil', business: 'Co' }); await seller.post('/api/my/listings', LISTING);
      assert.match((await admin.del('/api/admin/categories/1')).data.error, /Move or remove/);
    } finally { await s.stop(); }
  });

  test('the admin can edit and delete products, suspend a seller (their products vanish, login stops) and see enquiries', async () => {
    const s = await boot();
    try {
      const seller = await s.login('9811122233'); const admin = await s.login('8112662827');
      await seller.put('/api/profile', { name: 'Anil', business: 'Shakti Batteries' });
      const a = (await seller.post('/api/my/listings', LISTING)).data; await admin.patch('/api/admin/listings/' + a.id, { status: 'live' });
      assert.equal((await admin.put('/api/admin/listings/' + a.id, { ...LISTING, price: '41000', title: '48V 30Ah LiFePO4 pack (new)' })).status, 200);
      assert.match((await client(s.base).get('/browse')).data, /₹41,000/);
      assert.equal((await admin.get('/api/admin/sellers')).data.sellers.find((x) => x.mobile === '9811122233').trusted, 1);
      assert.equal((await seller.patch('/api/admin/sellers/9811122233', { suspended: true })).status, 403);
      assert.equal((await admin.patch('/api/admin/sellers/9811122233', { suspended: true })).status, 200);
      assert.doesNotMatch((await client(s.base).get('/browse')).data, /LiFePO4 pack/);
      assert.equal((await seller.get('/api/my/listings')).status, 401, 'a suspended seller is signed out');
      const again = client(s.base); await again.post('/api/auth/send-otp', { mobile: '9811122233' }); assert.equal((await again.post('/api/auth/verify-otp', { mobile: '9811122233', otp: '1234' })).status, 403);
      assert.equal((await admin.patch('/api/admin/sellers/9811122233', { suspended: false })).status, 200);
      assert.equal((await admin.del('/api/admin/listings/' + a.id)).status, 200);
      assert.match((await admin.get('/api/admin/summary')).data.audit.map((x) => x.action).join('\n'), /Deleted product/);
    } finally { await s.stop(); }
  });

  test('only the admin number opens /admin data; JSON-only protection; security headers; a missing page is a clean 404', async () => {
    const s = await boot();
    try {
      const anon = client(s.base);
      assert.equal((await anon.get('/api/admin/summary')).status, 401);
      assert.equal((await anon.raw('POST', '/api/auth/logout', 'x=1', { 'Content-Type': 'text/plain' })).status, 415, 'JSON only');
      const home = await anon.get('/'); assert.match(home.headers.get('content-security-policy'), /script-src 'self'/); assert.equal(home.headers.get('x-frame-options'), 'DENY');
      assert.equal((await anon.get('/nothing-here')).status, 404);
      assert.equal((await anon.get('/p/99999')).status, 404);
      assert.match((await anon.get('/robots.txt')).data, /Disallow: \/admin/);
      assert.equal((await anon.get('/health')).data.status, 'ok');
      const notAdmin = await s.login('9811122233'); assert.equal((await notAdmin.get('/api/admin/sellers')).status, 403);
    } finally { await s.stop(); }
  });
});
