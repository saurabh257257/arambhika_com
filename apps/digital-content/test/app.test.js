// The Digital Content tool: real server-side login, generate-only behaviour, and no leaking of
// code or data. Starts the actual server on a free port with a throwaway database.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.dirname(__dirname);
const PASSWORD = 'correct-horse';

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
    s.on('error', reject);
  });
}

async function start(env = {}) {
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'digital-test-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH,
      PORT: String(port),
      DB_PATH: path.join(dir, 'test.db'),
      UPLOADS_DIR: path.join(dir, 'uploads'),
      ADMIN_PASSWORD: PASSWORD,
      SESSION_SECRET: 'test-secret',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i += 1) {
    try { if ((await fetch(`${base}/health`)).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 100));
    if (child.exitCode !== null) throw new Error(`server exited early:\n${out}`);
  }
  let cookie = '';
  const request = async (method, url, body, headers = {}) => {
    const res = await fetch(base + url, {
      method,
      redirect: 'manual',
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const line of set) { const pair = line.split(';')[0]; cookie = pair.endsWith('=') ? '' : pair; }
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, text, json, headers: res.headers };
  };
  return {
    base, dir, request, output: () => out,
    login: (pw = PASSWORD) => request('POST', '/api/auth/login', { password: pw }),
    forget: () => { cookie = ''; }, cookie: () => cookie,
    stop: async () => { child.kill(); await new Promise((r) => child.once('exit', r)); fs.rmSync(dir, { recursive: true, force: true }); },
  };
}

describe('startup', () => {
  test('refuses to start without a login password', async () => {
    const child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: { PATH: process.env.PATH, PORT: '0', DB_PATH: path.join(os.tmpdir(), `digital-nopw-${Date.now()}.db`) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stderr.on('data', (d) => { out += d; });
    const code = await new Promise((r) => child.on('exit', r));
    assert.notEqual(code, 0);
    assert.match(out, /ADMIN_PASSWORD is not set/);
  });
});

describe('login is enforced on the server', () => {
  let app;
  before(async () => { app = await start(); });
  after(async () => { await app.stop(); });

  test('health is open', async () => {
    assert.equal((await app.request('GET', '/health')).status, 200);
  });

  test('pages send a signed-out visitor to the login page', async () => {
    for (const p of ['/', '/image-generator.html', '/studio.html']) {
      const r = await app.request('GET', p);
      assert.equal(r.status, 302, p);
      assert.equal(r.headers.get('location'), '/login.html');
    }
  });

  test('the login page itself is reachable', async () => {
    const r = await app.request('GET', '/login.html');
    assert.equal(r.status, 200);
    assert.match(r.text, /<form/);
  });

  test('every API call needs a session', async () => {
    for (const [m, u, b] of [
      ['GET', '/api/products'],
      ['POST', '/api/products', { name: 'x' }],
      ['DELETE', '/api/products/1'],
      ['POST', '/api/byteplus/generate-image', { model: 'm', prompt: 'p' }],
      ['POST', '/api/anthropic/generate-caption', { prompt: 'p' }],
    ]) {
      const r = await app.request(m, u, b);
      assert.equal(r.status, 401, `${m} ${u} must require sign-in`);
    }
  });

  test('uploaded images need a session too', async () => {
    assert.equal((await app.request('GET', '/uploads/anything.jpg')).status, 302);
  });

  test('a wrong password is refused and sets no cookie', async () => {
    const r = await app.login('nope');
    assert.equal(r.status, 401);
    assert.equal(r.headers.get('set-cookie'), null);
  });

  test('the right password opens a signed, HttpOnly session', async () => {
    const r = await app.login();
    assert.equal(r.status, 200);
    assert.match(r.headers.get('set-cookie'), /dc_session=/);
    assert.match(r.headers.get('set-cookie'), /HttpOnly/i);
    assert.equal((await app.request('GET', '/api/auth/me')).json.authenticated, true);
    assert.equal((await app.request('GET', '/api/products')).status, 200);
    assert.equal((await app.request('GET', '/image-generator.html')).status, 200);
  });

  test('a forged cookie is not accepted', async () => {
    app.forget();
    const r = await app.request('GET', '/api/products', undefined, { Cookie: `dc_session=${Date.now() + 99999999}.forged` });
    assert.equal(r.status, 401);
  });

  test('logging out ends the session', async () => {
    await app.login();
    await app.request('POST', '/api/auth/logout');
    assert.equal((await app.request('GET', '/api/products')).status, 401);
  });

  test('guessing is rate limited', async () => {
    app.forget();
    let last;
    for (let i = 0; i < 11; i += 1) last = await app.login(`wrong-${i}`);
    assert.equal(last.status, 429);
    assert.equal((await app.login()).status, 429, 'even the right password waits out the lockout');
  });
});

describe('only front-end files are served', () => {
  let app;
  before(async () => { app = await start(); });
  after(async () => { await app.stop(); });

  test('code, config and the database are not downloadable', async () => {
    await app.login();
    for (const p of ['/server.js', '/package.json', '/package-lock.json', '/.env', '/.env.example', '/test.db', '/lib/drive.js', '/test/app.test.js']) {
      const r = await app.request('GET', p);
      assert.ok([302, 401, 404].includes(r.status) && !r.text.includes('require('), `${p} returned ${r.status}`);
    }
  });

  test('styles, scripts and the logo are public so the login page can render', async () => {
    app.forget();
    for (const p of ['/css/style.css', '/js/nav.js', '/assets/arambhika-logo.jpeg']) {
      assert.equal((await app.request('GET', p)).status, 200, p);
    }
  });

  test('search engines are told to stay away', async () => {
    const r = await app.request('GET', '/login.html');
    assert.match(r.headers.get('x-robots-tag') || '', /noindex/);
  });
});

describe('generate only: nothing publishes anywhere', () => {
  let app;
  before(async () => { app = await start({ IG_ACCESS_TOKEN: 'x', IG_USER_ID: '1', LINKEDIN_ACCESS_TOKEN: 'y', LINKEDIN_PERSON_URN: 'urn:li:person:1' }); await app.login(); });
  after(async () => { await app.stop(); });

  test('the Instagram and LinkedIn routes no longer exist, even with tokens present', async () => {
    for (const [m, u] of [
      ['POST', '/api/instagram/publish'],
      ['POST', '/api/linkedin/publish'],
      ['GET', '/api/linkedin/status'],
      ['GET', '/auth/linkedin'],
      ['GET', '/auth/linkedin/callback'],
    ]) {
      const r = await app.request(m, u, m === 'POST' ? { text: 'hi', images: ['http://x/y.jpg'] } : undefined);
      assert.equal(r.status, 404, `${m} ${u}`);
    }
  });

  test('Google Drive is gone: no routes, no library, no link on the page', async () => {
    for (const u of ['/api/google/status', '/api/google/drive-files', '/auth/google', '/auth/google/callback']) {
      assert.equal((await app.request('GET', u)).status, 404, u);
    }
    const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    assert.doesNotMatch(src, /googleapis|GOOGLE_|drive\.file|uploadImageBuffer/);
    assert.equal(fs.existsSync(path.join(ROOT, 'lib', 'drive.js')), false);
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    assert.equal(pkg.dependencies.googleapis, undefined);
    const page = fs.readFileSync(path.join(ROOT, 'image-generator.html'), 'utf8');
    assert.doesNotMatch(page, /Google Drive|driveLink|auth\/google|Saved to Drive/);
  });

  test('every generated image has a Download button', () => {
    const page = fs.readFileSync(path.join(ROOT, 'image-generator.html'), 'utf8');
    assert.match(page, /Download image/);
    assert.ok(page.includes('href="${esc(s.url)}" download='), 'the download link must carry the download attribute');
  });

  test('the code contains no Instagram or LinkedIn posting', () => {
    const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    assert.doesNotMatch(src, /graph\.instagram\.com|api\.linkedin\.com|linkedin\.com\/oauth/);
    const page = fs.readFileSync(path.join(ROOT, 'image-generator.html'), 'utf8');
    assert.doesNotMatch(page, /Post to LinkedIn|Open Instagram|publishToLinkedIn|openInstagramToPost|auth\/linkedin/);
  });

  test('image generation reports a missing key instead of calling out', async () => {
    const r = await app.request('POST', '/api/byteplus/generate-image', { model: 'm', prompt: 'p' });
    assert.equal(r.status, 400);
    assert.match(r.json.error, /BYTEPLUS_API_KEY/);
  });

  test('caption and post generation still validate their input', async () => {
    assert.equal((await app.request('POST', '/api/anthropic/generate-caption', {})).status, 400);
    assert.equal((await app.request('POST', '/api/anthropic/generate-linkedin-post', {})).status, 400);
  });
});

describe('file handling', () => {
  let app;
  before(async () => { app = await start(); await app.login(); });
  after(async () => { await app.stop(); });

  test('deleting an image cannot reach outside the uploads folder', async () => {
    const victim = path.join(app.dir, 'victim.txt');
    fs.writeFileSync(victim, 'keep me');
    const created = await app.request('POST', '/api/products', { sku: 'S1', category: 'c', name: 'n', price: '1', unit: 'KG' });
    const id = created.json.id;
    const r = await app.request('DELETE', `/api/products/${id}/images/${encodeURIComponent('../victim.txt')}`);
    assert.equal(r.status, 200);
    assert.ok(fs.existsSync(victim), 'a file outside uploads was deleted');
  });
});

describe('website catalogue in the Products page', () => {
  let app, stub;
  before(async () => {
    const http = require('node:http');
    const catalog = { categories: [
      { name: 'Nickel Strip', products: [
        { SKU: 'NS1', ProductCode: 'Nickel Strip 2P', Price: 100, Unit: 'KG', 'Minimum Quantity': 5, Availability: 'In Stock', Image_Link: ['/zimg/1/a.jpg'], Additional_Details: ['d1'] },
        { SKU: 'T', ProductCode: 'T', Price: 1 },
      ] },
      { name: 'Cells', products: [{ SKU: 'C1', ProductCode: 'Cell 21700', Price: 200, Unit: 'PCS', Image_Link: [] }] },
    ] };
    stub = http.createServer((req, res) => {
      if (req.url === '/products.json') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(catalog)); }
      if (req.url === '/zimg/1/a.jpg') { res.setHeader('content-type', 'image/jpeg'); return res.end(Buffer.from([0xff, 0xd8, 0xff, 0xd9])); }
      res.statusCode = 404; res.end();
    });
    await new Promise((r) => stub.listen(0, '127.0.0.1', r));
    app = await start({ WEBSITE_URL: `http://127.0.0.1:${stub.address().port}` });
    await app.login();
  });
  after(async () => { await app.stop(); stub.close(); });

  test('importing loads every real product with its photo, as reference products', async () => {
    const r = await app.request('POST', '/api/products/import-website', {});
    assert.equal(r.status, 200);
    assert.equal(r.json.added, 2);
    assert.equal(r.json.images, 1);
    const list = (await app.request('GET', '/api/products')).json.data;
    assert.equal(list.length, 2, 'placeholder product "T" is skipped');
    const ns = list.find((p) => p.sku === 'NS1');
    assert.equal(ns.category, 'Nickel Strip');
    assert.equal(ns.flag_reference_image, 1);
    const imgs = JSON.parse(ns.images);
    assert.equal(imgs.length, 1);
    assert.ok(fs.existsSync(path.join(app.dir, 'uploads', imgs[0])));
  });

  test('importing again does not duplicate', async () => {
    const r = await app.request('POST', '/api/products/import-website', {});
    assert.equal(r.json.added, 0);
    assert.equal((await app.request('GET', '/api/products')).json.data.length, 2);
  });

  test('a product removed here comes straight back on the next refresh: the tool always mirrors the website', async () => {
    const list = (await app.request('GET', '/api/products')).json.data;
    const id = list.find((p) => p.sku === 'NS1').id;
    const del = await app.request('POST', '/api/products/bulk-delete', { ids: [id] });
    assert.equal(del.json.removed, 1);
    await app.request('POST', '/api/products/import-website', {});
    assert.equal((await app.request('GET', '/api/products')).json.data.some((p) => p.sku === 'NS1'), true);
  });

  test('the import and bulk remove need a session', async () => {
    app.forget();
    assert.equal((await app.request('POST', '/api/products/import-website', {})).status, 401);
    assert.equal((await app.request('POST', '/api/products/bulk-delete', { ids: [1] })).status, 401);
  });
});

describe('collections and automatic refresh', () => {
  let app, stub
  before(async () => {
    const http = require('node:http');
    const catalog = {
      categories: [{ name: 'Cells', products: [
        { SKU: 'C1', ProductCode: 'Cell 18650 A', Price: 100, Unit: 'PCS', Image_Link: [] },
        { SKU: 'C2', ProductCode: 'Cell 21700 B', Price: 120, Unit: 'PCS', Image_Link: [] },
      ] }],
      collections: [{ name: '18650', products: ['Cell 18650 A'] }, { name: '21700', products: ['Cell 21700 B'] }],
    };
    stub = http.createServer((req, res) => {
      if (req.url === '/products.json') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(catalog)); }
      res.statusCode = 404; res.end();
    });
    await new Promise((r) => stub.listen(0, '127.0.0.1', r));
    app = await start({ WEBSITE_URL: `http://127.0.0.1:${stub.address().port}` });
    await app.login();
  });
  after(async () => { await app.stop(); stub.close(); });

  test('products keep the Zoho collections they belong to', async () => {
    await app.request('POST', '/api/products/import-website', {});
    const list = (await app.request('GET', '/api/products')).json.data;
    assert.deepEqual(JSON.parse(list.find((p) => p.sku === 'C1').collections), ['18650']);
    assert.deepEqual(JSON.parse(list.find((p) => p.sku === 'C2').collections), ['21700']);
  });

  test('the list refreshes every time the generator opens (not more than every 30 seconds)', async () => {
    const first = await app.request('POST', '/api/products/sync-if-stale', {});
    assert.equal(first.json.synced, false, 'just imported, so not stale');
    assert.equal((await app.request('POST', '/api/products/sync-if-stale')).status, 200);
  });

  test('the generator offers a collection filter', () => {
    const page = fs.readFileSync(path.join(ROOT, 'image-generator.html'), 'utf8');
    assert.match(page, /id="refCollection"/);
    assert.match(page, /sync-if-stale/);
  });
});

describe('the tool mirrors the website', () => {
  let app, stub, catalog;
  before(async () => {
    const http = require('node:http');
    catalog = { categories: [{ name: 'Cells', products: [{ SKU: 'M1', ProductCode: 'One', Price: 1, Unit: 'PCS', Image_Link: [] }, { SKU: 'M2', ProductCode: 'Two', Price: 2, Unit: 'PCS', Image_Link: [] }] }] };
    stub = http.createServer((req, res) => { if (req.url === '/products.json') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(catalog)); } res.statusCode = 404; res.end(); });
    await new Promise((r) => stub.listen(0, '127.0.0.1', r));
    app = await start({ WEBSITE_URL: `http://127.0.0.1:${stub.address().port}` });
    await app.login();
  });
  after(async () => { await app.stop(); stub.close(); });

  test('a product that leaves the website leaves the tool on the next refresh', async () => {
    await app.request('POST', '/api/products/import-website', {});
    assert.equal((await app.request('GET', '/api/products')).json.data.length, 2);
    catalog.categories[0].products.pop();
    const r = await app.request('POST', '/api/products/import-website', {});
    assert.equal(r.json.removed, 1);
    assert.deepEqual((await app.request('GET', '/api/products')).json.data.map((p) => p.sku), ['M1']);
  });
});

describe('daily marketing studio', () => {
  let app;
  before(async () => { app = await start(); });
  after(async () => { await app.stop(); });

  test('the studio, uploads and the WhatsApp writer need a login', async () => {
    assert.equal((await app.request('GET', '/studio.html')).status, 302);
    assert.equal((await app.request('POST', '/api/uploads')).status, 401);
    assert.equal((await app.request('POST', '/api/anthropic/generate-whatsapp', { brief: 'x' })).status, 401);
  });

  test('after login the landing page is the studio', async () => {
    await app.login();
    const r = await app.request('GET', '/');
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('location'), '/studio.html');
    const page = await app.request('GET', '/studio.html');
    assert.equal(page.status, 200);
    assert.match(page.text, /Daily Marketing Studio/);
  });

  test('an image can be uploaded, and a non-image is refused', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const good = new FormData();
    good.append('file', new Blob([png], { type: 'image/png' }), 'photo.png');
    const ok = await fetch(app.base + '/api/uploads', { method: 'POST', body: good, headers: { Cookie: app.cookie() } });
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.match(body.url, /^\/uploads\/.*photo\.png$/);
    assert.ok(fs.existsSync(path.join(app.dir, 'uploads', body.filename)));
    const bad = new FormData();
    bad.append('file', new Blob(['not an image'], { type: 'text/plain' }), 'notes.txt');
    const no = await fetch(app.base + '/api/uploads', { method: 'POST', body: bad, headers: { Cookie: app.cookie() } });
    assert.equal(no.status, 400);
  });

  test('the studio has templates for every channel, brand details and an upload box', () => {
    const page = fs.readFileSync(path.join(ROOT, 'studio.html'), 'utf8');
    for (const needle of ['data-ch="ig-image"', 'data-ch="ig-carousel"', 'data-ch="wa-message"', 'data-ch="wa-template"', 'id="brWa"', 'id="brWeb"', 'id="brLoc"', 'id="brLogoIn"', 'id="drop"', 'message_templates', "category: 'MARKETING'", 'noLogo: true']) {
      assert.ok(page.includes(needle), needle + ' is missing');
    }
  });
});

describe('library and refresh status', () => {
  let app;
  before(async () => { app = await start(); await app.login(); });
  after(async () => { await app.stop(); });
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  test('a generated post is stored with its picture, grouped by category', async () => {
    const r = await app.request('POST', '/api/creatives', { channel: 'ig-image', template: 'spotlight', category: 'BMS', title: 'Product spotlight', caption: 'Hello', images: [png], products: ['JBD 24S'] });
    assert.equal(r.status, 200);
    await app.request('POST', '/api/creatives', { channel: 'wa-message', category: 'Nickel Strip Plated', title: 'Daily offer', caption: 'Message', images: [] });
    const all = (await app.request('GET', '/api/creatives')).json.data;
    assert.equal(all.length, 2);
    const bms = (await app.request('GET', '/api/creatives?category=BMS')).json.data;
    assert.equal(bms.length, 1);
    assert.equal(bms[0].images.length, 1);
    assert.ok(fs.existsSync(path.join(app.dir, 'uploads', bms[0].images[0])));
    const wa = (await app.request('GET', '/api/creatives?channel=wa-message')).json.data;
    assert.equal(wa[0].category, 'Nickel Strip Plated');
  });

  test('bad images are refused and deleting removes the file', async () => {
    assert.equal((await app.request('POST', '/api/creatives', { images: ['data:text/html;base64,AAAA'] })).status, 400);
    const bms = (await app.request('GET', '/api/creatives?category=BMS')).json.data[0];
    const file = path.join(app.dir, 'uploads', bms.images[0]);
    assert.equal((await app.request('DELETE', '/api/creatives/' + bms.id)).status, 200);
    assert.equal(fs.existsSync(file), false);
    assert.equal((await app.request('GET', '/api/creatives?category=BMS')).json.data.length, 0);
  });

  test('the library and refresh status need a login', async () => {
    app.forget();
    assert.equal((await app.request('GET', '/api/creatives')).status, 401);
    assert.equal((await app.request('GET', '/api/sync-status')).status, 401);
    await app.login();
  });

  test('the studio has the three tabs, the description option and the refresh line', () => {
    const page = fs.readFileSync(path.join(ROOT, 'studio.html'), 'utf8');
    for (const needle of ['data-pt="create"', 'data-pt="plan"', 'data-pt="library"', 'id="incDesc"', 'id="syncWhen"', 'sync-status', '/api/creatives']) assert.ok(page.includes(needle), needle);
  });

  test('the Product card tab makes the same layout every time and a hidden tab really is hidden', () => {
    const page = fs.readFileSync(path.join(ROOT, 'studio.html'), 'utf8');
    for (const needle of ['data-pt="card"', 'id="pt-card"', 'id="pcCanvas"', 'id="pcTitle"', 'id="pcSub"', 'id="pcDownload"', 'id="pcSave"', "channel: 'product-card'", "'create', 'card', 'cat', 'plan', 'library'"]) assert.ok(page.includes(needle), needle);
    assert.ok(page.includes('.st-wrap[hidden] { display: none; }'), 'the display rule must not override hidden');
  });

  test('the Category image tab arranges several products on one image and saves it to the library', () => {
    const page = fs.readFileSync(path.join(ROOT, 'studio.html'), 'utf8');
    for (const needle of ['data-pt="cat"', 'id="pt-cat"', 'id="ciCanvas"', 'id="ciPicker"', 'id="ciLayout"', 'id="ciBg"', 'id="ciDownload"', 'id="ciSave"', "channel: 'category-image'", "'create', 'card', 'cat', 'plan', 'library'"]) assert.ok(page.includes(needle), needle);
  });
});
