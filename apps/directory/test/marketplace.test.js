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
function png() {
  const chunk = (type, data) => { const t = Buffer.from(type), len = Buffer.alloc(4); len.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.alloc(14))), chunk('IEND', Buffer.alloc(0))]);
}
async function boot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'directory-'));
  const app = createApp({ dataDir: dir, adminMobile: '8112662827', sessionSecret: 'test-secret', devOtp: '1234' });
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const login = async (mobile) => { const c = client(base); await c.post('/api/auth/send-otp', { mobile }); const r = await c.post('/api/auth/verify-otp', { mobile, otp: '1234' }); assert.equal(r.status, 200); return c; };
  return { app, base, login, stop: () => new Promise((r) => server.close(() => { app.repo.close(); r(); })) };
}
const LISTING = { title: '48V 30Ah LiFePO4 battery pack', category_id: 1, description: 'Made in our Pune plant with a smart BMS and a two year warranty.', price: '38500', voltage: '48', capacity_ah: '30', chemistry: 'LiFePO4', state: 'Maharashtra', city: 'Pune', whatsapp: '9811122233' };

describe('marketplace pages and the admin seller page', () => {
  test('the admin opens a seller, edits their details, adds a product for them (live at once, with a photo), edits and removes products; an admin can also add a seller by hand', async () => {
    const s = await boot();
    try {
      const admin = await s.login('8112662827'), seller = await s.login('9811122233');
      assert.equal((await seller.get('/api/admin/sellers/9811122233')).status, 403);
      assert.equal((await seller.post('/api/admin/sellers', { mobile: '9000000002', name: 'X Y', business: 'Z Co' })).status, 403);
      assert.match((await admin.post('/api/admin/sellers', { mobile: '123', name: 'Meena', business: 'Rao Energy' })).data.error, /10-digit/);
      assert.equal((await admin.post('/api/admin/sellers', { mobile: '9876500011', name: 'Meena Rao', business: 'Rao Energy', city: 'Jaipur' })).status, 200);
      assert.match((await admin.post('/api/admin/sellers', { mobile: '9876500011', name: 'Meena Rao', business: 'Rao Energy' })).data.error, /already/);
      const page = (await admin.get('/api/admin/sellers/9876500011')).data; assert.equal(page.seller.business, 'Rao Energy'); assert.deepEqual(page.listings, []);
      assert.equal((await admin.get('/api/admin/sellers/9111111111')).status, 404);
      assert.equal((await admin.patch('/api/admin/sellers/9876500011', { business: 'Rao Energy Pvt Ltd', city: 'Jodhpur', state: 'Rajasthan', about: 'Makers of e-bike packs' })).status, 200);
      // a product added by the admin goes live at once, even though the seller is new and has not logged in
      const made = (await admin.post('/api/admin/sellers/9876500011/listings', { ...LISTING, whatsapp: '9876500011', title: '36V 10Ah e-bike battery' })).data;
      assert.equal(made.status, 'live');
      const up = await admin.raw('POST', '/api/upload?listing=' + made.id + '&name=front.png', png(), { 'Content-Type': 'application/octet-stream', 'X-LD-Upload': '1' });
      assert.equal(up.status, 200);
      const shown = (await client(s.base).get('/p/' + made.id + '-36v-10ah-e-bike-battery')).data;
      assert.match(shown, /Rao Energy Pvt Ltd/); assert.match(shown, /Chat on WhatsApp/); assert.match(shown, /\/img\/\d+/);
      assert.equal((await admin.get('/api/admin/sellers/9876500011')).data.listings.length, 1);
      assert.equal((await admin.put('/api/admin/listings/' + made.id, { title: '36V 12Ah e-bike battery', capacity_ah: '12', energy_wh: '' })).status, 200);
      const edited = (await admin.get('/api/admin/listings/' + made.id)).data.listing;
      assert.equal(edited.title, '36V 12Ah e-bike battery'); assert.equal(edited.photos.length, 1); assert.equal(edited.energy_wh, 576);
      assert.equal((await admin.del('/api/admin/listings/' + made.id)).status, 200);
      assert.equal((await admin.get('/api/admin/sellers/9876500011')).data.listings.length, 0);
    } finally { await s.stop(); }
  });

  test('the marketplace pages: category list and search on top, result rows with a WhatsApp button, and no contact details anywhere', async () => {
    const s = await boot();
    try {
      const seller = await s.login('9811122233'); const admin = await s.login('8112662827');
      await seller.put('/api/profile', { name: 'Anil', business: 'Shakti Batteries', city: 'Pune', state: 'Maharashtra' });
      const a = (await seller.post('/api/my/listings', LISTING)).data; await admin.patch('/api/admin/listings/' + a.id, { status: 'live' });
      const anon = client(s.base);
      const home = (await anon.get('/')).data;
      assert.match(home, /class="hsearch"/); assert.match(home, /class="catnav"/); assert.match(home, /Shop by category/); assert.match(home, /Chat with supplier/); assert.match(home, /Browse by state/);
      const list = (await anon.get('/browse?category=battery-packs')).data;
      assert.match(list, /class="lrow"/); assert.match(list, /Chat on WhatsApp/); assert.match(list, /View details/); assert.match(list, /1 product found/); assert.match(list, /Voltage<\/dt><dd>48 V/);
      assert.match((await anon.get('/browse?q=nothing-like-this')).data, /0 products found/);
      for (const p of ['/', '/browse', '/about', '/terms', '/p/' + a.id + '-x']) {
        const html = (await anon.get(p)).data;
        assert.doesNotMatch(html, /info@arambhika\.com|81126 62827|SK-201|www\.arambhika\.com/, p + ' shows no contact block');
      }
    } finally { await s.stop(); }
  });
});
