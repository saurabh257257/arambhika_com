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
const KNOWN_BROKEN = {}

describe('local references resolve', () => {
  for (const page of htmlPages) {
    test(`${page}: scripts, styles, images and links point at files that exist`, () => {
      const html = read(page)
      const dir = path.posix.dirname(page)
      const refs = [...html.matchAll(/\b(?:src|href)=["']([^"'#?]+)(?:[?#][^"']*)?["']/gi)].map((m) => m[1])
      const missing = []
      for (const ref of refs) {
        if (/^(https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(ref)) continue
        if (/^\/(zimg|zcat|product)\//.test(ref)) continue // served by server.js, not files in public/
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
  test('account.html has the OTP login container, dashboard tabs and profile section', () => {
    const html = read('account.html')
    for (const id of ['acctOtpLogin', 'acctDashboard', 'acctProfileWizard', 'acctOrdersList', 'acctInvoicesList', 'statConfirmed', 'statPending', 'statInvoices']) {
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

  test('the sign-up wizard script exposes initProfileWizard and covers every step', () => {
    const js = read('profile-wizard.js')
    assert.match(js, /window\.initProfileWizard\s*=/)
    for (const step of ['mobile', 'details', 'address', 'gst']) assert.match(js, new RegExp(`"${step}"`))
    for (const f of ['firstName', 'lastName', 'email', 'address', 'state', 'city', 'postalCode', 'hasGst', 'gstin']) {
      assert.match(js, new RegExp(f), `wizard is missing the ${f} field`)
    }
    assert.match(js, /\/api\/meta\/states/, 'state dropdown must come from the server list')
    assert.match(js, /\/api\/test-gst\/verify/)
  })

  test('My Account hosts the wizard: overlay, banner, profile form and script order', () => {
    const html = read('account.html')
    for (const id of ['acctWizardOverlay', 'acctWizardRoot', 'acctCompleteBanner', 'acctProfileWizard']) {
      assert.match(html, new RegExp(`id=["']${id}["']`), `account.html is missing #${id}`)
    }
    assert.ok(html.indexOf('profile-wizard.js') > -1 && html.indexOf('profile-wizard.js') < html.indexOf('account.js'))
    assert.doesNotMatch(html, /id=["']acctProfileForm["']/, 'the old free-text profile form must be gone')
  })

  test('the checkout popup uses the wizard and no longer has the old address form', () => {
    const html = read('index.html')
    assert.match(html, /id=["']testStepWizard["']/)
    assert.match(html, /id=["']testWizardRoot["']/)
    assert.doesNotMatch(html, /id=["']testProfileForm["']/)
    assert.ok(html.indexOf('profile-wizard.js') < html.indexOf('test-account.js'))
    const js = read('test-account.js')
    assert.match(js, /initProfileWizard\(/)
    assert.match(js, /PROFILE_INCOMPLETE/, 'server refusal must reopen the wizard')
    assert.match(js, /checkout"\) === "1"/, 'arriving from My Account with a basket must carry on')
  })

  test('every page header offers only Store and the account icon', () => {
    const withNav = htmlPages.filter((p) => /<nav class="nav-links">/.test(read(p)))
    assert.ok(withNav.length >= 12, `expected the site pages, found ${withNav.length}`)
    for (const page of withNav) {
      const nav = read(page).match(/<nav class="nav-links">([\s\S]*?)<\/nav>/)[1]
      const links = [...nav.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((m) => m[1])
      assert.equal(links.length, 2, `${page} header has ${links.length} links: ${links.join(', ')}`)
      assert.match(links[0], /#catalog$/)
      assert.match(links[1], /account\.html$/)
      assert.doesNotMatch(nav, /nav-dropdown|nav-contact|navHome/, `${page} still has the old header items`)
    }
  })

  test('the pages that were in the More menu are linked from every footer', () => {
    const wanted = ['/blog/', '/catalog.html?autoprint=1', '/capabilities.html', '/about.html', '/terms.html', '/refund-policy.html']
    const withFooter = htmlPages.filter((p) => /<footer class="site-footer">/.test(read(p)))
    assert.ok(withFooter.length >= 12)
    for (const page of withFooter) {
      const html = read(page)
      assert.match(html, /class="footer-col" aria-label="Company"/, `${page} footer has no Company column`)
      assert.match(html, /class="footer-bottom"/, `${page} footer has no bottom bar`)
      for (const href of wanted) assert.ok(html.includes(`href="${href}"`), `${page} footer is missing ${href}`)
    }
  })

  test('the store page uses the slide-over cart', () => {
    const html = read('index.html')
    assert.match(html, /<script src="cart-drawer\.js"><\/script>/)
    assert.ok(html.indexOf('script.js') < html.indexOf('cart-drawer.js'), 'drawer needs script.js first')
    const drawer = read('cart-drawer.js')
    assert.match(drawer, /cart:added/)
    assert.match(drawer, /checkout\.html/)
    assert.match(drawer, /window\.openCartDrawer\s*=/)
    const store = read('script.js')
    assert.match(store, /new CustomEvent\("cart:added"/)
    assert.match(store, /new CustomEvent\("cart:changed"/)
    assert.match(store, /window\.openCartDrawer/, 'the old quote sheet must hand over to the drawer')
  })

  test('checkout page: three steps, summary, login, wizard and payment confirmation', () => {
    const html = read('checkout.html')
    for (const id of ['ckStepAccount', 'ckStepDelivery', 'ckStepPay', 'ckSummaryBody', 'ckEmpty', 'ckDone']) {
      assert.match(html, new RegExp(`id="${id}"`), `checkout.html is missing #${id}`)
    }
    assert.match(html, /noindex/)
    const order = ['otp-login.js', 'profile-wizard.js', 'checkout.js'].map((s) => html.indexOf(s))
    assert.ok(order.every((i) => i > -1) && order[0] < order[2] && order[1] < order[2])
    const js = read('checkout.js')
    assert.match(js, /\/api\/test-checkout/)
    assert.match(js, /confirm-payment/)
    assert.match(js, /PROFILE_INCOMPLETE/)
    assert.match(js, /initProfileWizard\(/)
    assert.match(js, /initOtpLogin\(/)
  })

  test('My Account has a way back to the store and shows a waiting basket', () => {
    const html = read('account.html')
    assert.match(html, /id="acctShopLink"/)
    assert.match(html, /id="acctCartBanner"[^>]*href="checkout\.html"/)
    assert.match(read('account.js'), /\/api\/test-cart/)
  })

  test('the home page no longer has the "Our Strengths" carousel', () => {
    const html = read('index.html')
    assert.doesNotMatch(html, /id="solutions"|solutionsCarousel|solution-card/)
    assert.doesNotMatch(html, /Our Strengths|What Sets Us Apart/i)
  })

  test('the old client-side address rule is gone (the server decides)', () => {
    assert.doesNotMatch(read('test-account.js'), /profileAddressIsComplete/)
    assert.doesNotMatch(read('account.js'), /fillProfileForm/)
  })
})
