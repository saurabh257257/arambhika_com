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
    forget: () => { cookie = ''; },
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
    for (const p of ['/', '/image-generator.html', '/products.html']) {
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
