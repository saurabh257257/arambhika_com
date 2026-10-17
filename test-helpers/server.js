// Starts the real server.js on a free port with a throwaway data folder and a fake MSG91, so
// tests exercise the actual HTTP surface without touching Zoho, MSG91 or real customer data.

import { spawn } from 'node:child_process'
import http from 'node:http'
import net from 'node:net'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

// A stand-in for MSG91: issues the code "1234" for every number and checks it back.
export async function startFakeMsg91({ authkey = 'TEST_KEY', code = '1234' } = {}) {
  const issued = new Map()
  const calls = []
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x')
    const mobile = u.searchParams.get('mobile')
    calls.push({ method: req.method, path: u.pathname, mobile })
    const send = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)) }
    if (req.headers.authkey !== authkey) return send({ type: 'error', message: 'bad authkey' })
    if (u.pathname.endsWith('/otp/verify')) {
      const ok = issued.get(mobile) === u.searchParams.get('otp')
      return send(ok ? { type: 'success', message: 'OTP verified success' } : { type: 'error', message: 'OTP not match' })
    }
    if (u.pathname.endsWith('/otp/retry')) {
      return send(issued.has(mobile) ? { type: 'success', message: 'retried' } : { type: 'error', message: 'No OTP request found' })
    }
    if (u.pathname.endsWith('/otp') && req.method === 'POST') {
      issued.set(mobile, code)
      return send({ type: 'success', message: 'request-id' })
    }
    send({ type: 'error', message: 'unknown' })
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    code,
    calls,
    close: () => new Promise((r) => server.close(r)),
  }
}

export async function startApp({ env = {}, msg91 = null } = {}) {
  const port = await freePort()
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arambhika-test-'))
  // a small, known catalog so product pages and the sitemap can be tested without Zoho
  fs.copyFileSync(path.join(ROOT, 'test', 'fixtures', 'products.local.json'), path.join(dataDir, 'products.local.json'))
  const fullEnv = {
    ...process.env,
    PORT: String(port),
    DATA_DIR: dataDir,
    DISABLE_CATALOG_REFRESH: '1',
    ZOHO_REFRESH_TOKEN: '',
    ZOHO_STOREFRONT_DOMAIN: 'example.invalid',
    ALLOWED_TEST_MOBILE: '8886772827',
    SESSION_SECRET: 'test-session-secret',
    ...(msg91
      ? { MSG91_AUTHKEY: 'TEST_KEY', MSG91_TEMPLATE_ID: 'TEMPLATE', MSG91_BASE: msg91.url, MSG91_OTP_LENGTH: '4' }
      : { MSG91_AUTHKEY: '', MSG91_TEMPLATE_ID: '' }),
    ...env,
  }
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: fullEnv, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', (d) => { output += d })
  child.stderr.on('data', (d) => { output += d })

  const base = `http://127.0.0.1:${port}`
  const deadline = Date.now() + 15000
  for (;;) {
    try {
      const r = await fetch(`${base}/healthz`)
      if (r.ok) break
    } catch {}
    if (Date.now() > deadline) {
      child.kill()
      throw new Error(`server did not start:\n${output}`)
    }
    await new Promise((r) => setTimeout(r, 100))
  }

  // Tiny client that keeps cookies per "browser", so tests can model two customers.
  function client() {
    let cookie = ''
    return {
      get cookie() { return cookie },
      set cookie(v) { cookie = v },
      async request(method, url, body, headers = {}) {
        const res = await fetch(base + url, {
          method,
          redirect: 'manual',
          headers: {
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            ...(cookie ? { Cookie: cookie } : {}),
            ...headers,
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        })
        const set = res.headers.getSetCookie?.() || []
        for (const line of set) {
          const pair = line.split(';')[0]
          if (pair.endsWith('=') || /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(line)) cookie = ''
          else cookie = pair
        }
        const text = await res.text()
        let json = null
        try { json = JSON.parse(text) } catch {}
        return { status: res.status, json, text, headers: res.headers }
      },
    }
  }
  const make = () => {
    const c = client()
    c.get = (url, headers) => c.request('GET', url, undefined, headers)
    c.post = (url, body, headers) => c.request('POST', url, body ?? {}, headers)
    return c
  }

  return {
    base,
    dataDir,
    newClient: make,
    output: () => output,
    async stop() {
      child.kill()
      await new Promise((r) => child.once('exit', r))
      fs.rmSync(dataDir, { recursive: true, force: true })
    },
  }
}

// Logs a client in through the OTP flow against the fake MSG91.
export async function login(app, msg91, mobile) {
  const c = app.newClient()
  const sent = await c.post('/api/test-auth/send-otp', { mobile })
  if (sent.status !== 200) throw new Error(`send-otp failed: ${sent.text}`)
  const verified = await c.post('/api/test-auth/verify-otp', { mobile, otp: msg91.code })
  if (verified.status !== 200) throw new Error(`verify-otp failed: ${verified.text}`)
  return c
}
