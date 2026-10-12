// Behaviour that differs between production and non-production servers, plus basic health.

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { startApp } from '../test-helpers/server.js'

describe('production server', () => {
  let app
  before(async () => { app = await startApp({ env: { APP_ENV: 'production' } }) })
  after(async () => { await app.stop() })

  test('/healthz reports ok and the environment', async () => {
    const r = await app.newClient().get('/healthz')
    assert.equal(r.status, 200)
    assert.equal(r.json.ok, true)
    assert.equal(r.json.env, 'production')
  })

  test('robots.txt is the public one and pages are not marked noindex', async () => {
    const c = app.newClient()
    const robots = await c.get('/robots.txt')
    assert.match(robots.text, /Sitemap:/)
    const home = await c.get('/')
    assert.equal(home.status, 200)
    assert.equal(home.headers.get('x-robots-tag'), null)
  })

  test('the home page and key pages are served', async () => {
    const c = app.newClient()
    for (const p of ['/', '/account.html', '/about.html', '/terms.html', '/sitemap.xml']) {
      const r = await c.get(p)
      assert.equal(r.status, 200, `${p} should be served`)
    }
  })

  test('the admin pages refuse requests without the token', async () => {
    const c = app.newClient()
    for (const p of ['/admin/zoho-connect', '/admin/zoho-orders', '/admin/zoho-status']) {
      const r = await c.get(p)
      assert.ok([401, 503].includes(r.status), `${p} returned ${r.status}`)
    }
  })

  test('the products feed is JSON', async () => {
    const r = await app.newClient().get('/products.json')
    assert.equal(r.status, 200)
    assert.ok(r.json, 'products.json must be valid JSON')
  })
})

describe('dev (non-production) server', () => {
  let app
  before(async () => { app = await startApp({ env: { APP_ENV: 'dev' } }) })
  after(async () => { await app.stop() })

  test('tells search engines not to index anything', async () => {
    const c = app.newClient()
    const home = await c.get('/')
    assert.match(home.headers.get('x-robots-tag') || '', /noindex/)
    const robots = await c.get('/robots.txt')
    assert.match(robots.text, /Disallow:\s*\/\s*$/m)
  })

  test('/healthz reports the dev environment', async () => {
    const r = await app.newClient().get('/healthz')
    assert.equal(r.json.env, 'dev')
  })
})

describe('retired domain notice page', () => {
  const page = fs.readFileSync(path.join(import.meta.dirname, '..', 'deploy', 'old-domain', 'index.html'), 'utf8')

  test('tells visitors to go to www.arambhika.com and links there', () => {
    assert.match(page, /Please visit <strong>www\.arambhika\.com<\/strong>/)
    assert.match(page, /<a[^>]+href="https:\/\/www\.arambhika\.com\/"/)
  })

  test('is a complete, mobile-friendly page that points search engines at the real site', () => {
    assert.match(page, /<html lang="en">/)
    assert.match(page, /name="viewport"/)
    assert.match(page, /<link rel="canonical" href="https:\/\/www\.arambhika\.com\/"/)
    assert.doesNotMatch(page, /noindex/i, 'must not drop the old domain from search before it is consolidated')
  })

  test('the production nginx config serves it for both old names', () => {
    const conf = fs.readFileSync(path.join(import.meta.dirname, '..', 'deploy', 'nginx-arambhika.conf'), 'utf8')
    assert.match(conf, /server_name arambhikaenablers\.in www\.arambhikaenablers\.in;/)
    assert.match(conf, /root \/var\/www\/old-domain;/)
    assert.match(conf, /try_files \/index\.html =404;/)
  })
})
