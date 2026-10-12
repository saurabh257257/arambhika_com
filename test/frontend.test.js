// Front-end integrity: scripts parse, local files that pages point at exist, and the pages the
// customer flow depends on contain the elements the scripts look for.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const PUBLIC = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'public')
const read = (rel) => fs.readFileSync(path.join(PUBLIC, rel), 'utf8')

function walk(dir, base = '') {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.posix.join(base, e.name)
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), rel))
    else out.push(rel)
  }
  return out
}
const files = walk(PUBLIC)
const htmlPages = files.filter((f) => f.endsWith('.html'))
const scripts = files.filter((f) => f.endsWith('.js'))

describe('JavaScript files', () => {
  for (const file of scripts) {
    test(`${file} parses`, () => {
      assert.doesNotThrow(() => new vm.Script(read(file), { filename: file }))
    })
  }
})

// Broken local references that existed before this suite. Same rule as the SEO list: it can only
// shrink, and fixing one makes its entry fail until removed.
const KNOWN_BROKEN = {
  'index.html': [
    'assets/products/nickel-plated/np-20-1.jpg',
    'assets/products/nickel-pure/n-15-1.jpg',
    'assets/products/copper-bus-bars/cb-10-1.jpg',
  ],
}

describe('local references resolve', () => {
  for (const page of htmlPages) {
    test(`${page}: scripts, styles, images and links point at files that exist`, () => {
      const html = read(page)
      const dir = path.posix.dirname(page)
      const refs = [...html.matchAll(/\b(?:src|href)=["']([^"'#?]+)(?:[?#][^"']*)?["']/gi)].map((m) => m[1])
      const missing = []
      for (const ref of refs) {
        if (/^(https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(ref)) continue
        const target = ref.startsWith('/') ? ref.slice(1) : path.posix.join(dir, ref)
        if (!target) continue
        const candidates = [target, `${target}.html`, path.posix.join(target, 'index.html')]
        if (!candidates.some((c) => fs.existsSync(path.join(PUBLIC, c)))) missing.push(ref)
      }
      const known = KNOWN_BROKEN[page] || []
      assert.deepEqual(missing.sort(), [...known].sort(), `${page} refers to files that do not exist (or a known-broken one was fixed: remove it from KNOWN_BROKEN)`)
    })
  }
})

describe('customer flow markup', () => {
  test('account.html has the OTP login container, dashboard tabs and profile form', () => {
    const html = read('account.html')
    for (const id of ['acctOtpLogin', 'acctDashboard', 'acctProfileForm', 'acctOrdersList', 'acctInvoicesList', 'statConfirmed', 'statPending', 'statInvoices']) {
      assert.match(html, new RegExp(`id=["']${id}["']`), `account.html is missing #${id}`)
    }
    assert.match(html, /otp-login\.js/, 'account.html must load otp-login.js')
    assert.ok(html.indexOf('otp-login.js') < html.indexOf('account.js'), 'otp-login.js must load before account.js')
  })

  test('the dashboard shows at most three tiles', () => {
    const tiles = read('account.html').match(/class=["'][^"']*acct-stat-card/g) || []
    assert.ok(tiles.length <= 3, `dashboard has ${tiles.length} tiles`)
  })

  test('the checkout modal on index.html uses the OTP login and loads it first', () => {
    const html = read('index.html')
    assert.match(html, /id=["']testOtpLogin["']/)
    assert.ok(html.indexOf('otp-login.js') > -1 && html.indexOf('otp-login.js') < html.indexOf('test-account.js'))
  })

  test('no page still contains the old test-build login copy', () => {
    for (const page of htmlPages) assert.doesNotMatch(read(page), /Log in \(test build\)|pending MSG91 approval/i, page)
  })

  test('the OTP login script exposes initOtpLogin', () => {
    assert.match(read('otp-login.js'), /window\.initOtpLogin\s*=/)
  })

  test('the payment screen polls for confirmation and closes the Zoho tab', () => {
    const js = read('test-account.js')
    assert.match(js, /startPaymentPolling/)
    assert.match(js, /closePayWindow/)
    assert.match(js, /await sessionReady/, 'Proceed must wait for the login check')
  })

  test('account.js refreshes every 30 seconds', () => {
    assert.match(read('account.js'), /setInterval\(refreshAll,\s*30000\)/)
  })
})
