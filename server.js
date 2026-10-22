import express from 'express'
import compression from 'compression'
import dns from 'node:dns'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import { fetchStorefrontCatalog, fetchImage, fetchCategoryImage } from './lib/zoho.js'
import { buildCatalog } from './lib/catalog.js'
import * as zohoAuth from './lib/zoho-oauth.js'
import { placeOrder, estimateOrder, CheckoutError } from './lib/zoho-checkout.js'
import { listSalesOrdersByEmail, getSalesOrderItems, getSalesOrderStatus, findInvoiceForSalesOrder, findEwayBillForInvoice, fetchBooksPdf, findShipmentsForSalesOrder } from './lib/zoho-admin.js'
import * as testStore from './lib/customer-store.js'
import * as otp from './lib/otp.js'
import { signSession, readSession, SESSION_COOKIE, SESSION_DAYS } from './lib/session.js'
import { syncProfileToZoho, fetchProfileFromZoho, clearContactCache } from './lib/zoho-contacts.js'
import { verifyGstin, providerConfigured as gstProviderConfigured } from './lib/gst.js'
import { selectableStates, findState, isValidPostalCode, isValidEmail } from './lib/india.js'
import { profileStatus } from './lib/profile-status.js'
import { renderProductPage, renderProductSitemap } from './lib/product-pages.js'
import { renderCategoryPage, renderBrowseList, listCategories } from './lib/category-pages.js'

try { process.loadEnvFile() } catch {}

// MSG91 only accepts calls from the whitelisted IPv4 address. Node prefers IPv6 when the host has
// one, which MSG91 then rejects ("IP is not whitelisted"), so resolve IPv4 first.
dns.setDefaultResultOrder('ipv4first')

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.join(ROOT, 'public')
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data')
const SNAPSHOT_FILE = path.join(DATA_DIR, 'snapshot.json')
const IMAGE_DIR = path.join(DATA_DIR, 'images')
const PORT = Number(process.env.PORT) || 3000
const REFRESH_EVERY = (Number(process.env.CATALOG_CACHE_SECONDS) || 30) * 1000
const PARTIAL_REFRESHES_ALLOWED = 5

// How the catalog is served:
//  - Visitors are always answered instantly from `current`, never by waiting on Zoho.
//  - A background loop refreshes from Zoho. Only a good result replaces `current`, and it is
//    saved to disk, so a Zoho outage or a server restart still shows the last good catalog.
//  - Product photos are also kept on disk, so they keep showing when Zoho is unreachable.
const localCatalog = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'products.local.json'), 'utf8')) } catch { return { categories: [] } }
})()

function readSnapshot() {
  try {
    const snap = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'))
    if (snap?.data?.categories?.length) return snap
  } catch {}
  return null
}

function writeSnapshot(snap) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    const tmp = `${SNAPSHOT_FILE}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(snap))
    fs.renameSync(tmp, SNAPSHOT_FILE) // atomic: a crash mid-write never leaves a broken snapshot
  } catch (err) {
    console.error('[snapshot] write failed:', err.message)
  }
}

const saved = readSnapshot()
let current = saved
  ? { data: saved.data, at: saved.at, source: 'snapshot' }
  : { data: localCatalog, at: 0, source: 'local-fallback' }

let refreshing = false
let partialInARow = 0
let lastError = ''

const countProducts = (data) => data.categories.reduce((n, c) => n + c.products.length, 0)

async function refreshCatalog() {
  if (refreshing) return
  refreshing = true
  try {
    const zoho = await fetchStorefrontCatalog()
    const data = buildCatalog(zoho, localCatalog)

    // Never replace a good catalog with an empty or half-fetched one.
    if (!countProducts(data)) throw new Error('Zoho returned no products; keeping the last snapshot')
    if (zoho.detailFailures && current.source !== 'local-fallback' && ++partialInARow <= PARTIAL_REFRESHES_ALLOWED) {
      throw new Error(`${zoho.detailFailures} product photo lists could not be fetched; keeping the last snapshot`)
    }
    partialInARow = 0

    current = { data, at: Date.now(), source: 'zoho' }
    writeSnapshot({ at: current.at, data })
    lastError = ''
    prefetchImages(data).catch(() => {})
  } catch (err) {
    if (err.message !== lastError) console.error('[catalog] refresh failed:', err.message)
    lastError = err.message
  } finally {
    refreshing = false
  }
}

// ---- Product photos: memory -> disk -> Zoho ----
const imageCache = new Map()
const IMAGE_CACHE_MAX = 400

const imagePaths = (key) => ({ body: path.join(IMAGE_DIR, key), meta: path.join(IMAGE_DIR, `${key}.type`) })

function readImageFromDisk(docId) {
  const { body, meta } = imagePaths(docId)
  try {
    return { buffer: fs.readFileSync(body), type: fs.readFileSync(meta, 'utf8').trim() || 'image/jpeg' }
  } catch { return null }
}

function writeImageToDisk(docId, img) {
  try {
    fs.mkdirSync(IMAGE_DIR, { recursive: true })
    const { body, meta } = imagePaths(docId)
    fs.writeFileSync(body, img.buffer)
    fs.writeFileSync(meta, img.type)
  } catch (err) {
    console.error('[image] disk write failed:', err.message)
  }
}

// size: undefined = the full photo; 200, 400 or 800 = a smaller copy for cards, tiles and thumbnails
async function getImage(docId, file, size) {
  const key = size ? `${docId}_${size}` : docId
  const memKey = `${key}/${file}`
  let img = imageCache.get(memKey) || readImageFromDisk(key)
  if (!img) {
    try { img = await fetchImage(docId, file, size ? `${size}x${size}` : undefined) } catch (err) { console.error('[image] fetch failed:', err.message) }
    if (img) writeImageToDisk(key, img)
  }
  if (img) {
    if (imageCache.size >= IMAGE_CACHE_MAX) imageCache.delete(imageCache.keys().next().value)
    imageCache.set(memKey, img)
  }
  return img
}

// After each good refresh, pull any photos we have not saved yet so the snapshot is complete.
async function prefetchImages(data) {
  const wanted = new Map()
  for (const cat of data.categories) {
    for (const p of cat.products) {
      for (const link of p.Image_Link || []) {
        const m = /^\/zimg\/(\d+)\/(.+)$/.exec(link)
        if (m && !fs.existsSync(imagePaths(m[1]).body)) wanted.set(m[1], decodeURIComponent(m[2]))
      }
    }
  }
  const queue = [...wanted]
  const worker = async () => {
    while (queue.length) {
      const [docId, file] = queue.shift()
      await getImage(docId, file)
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker))
  pruneImages(data)
}

// Keep exactly one snapshot: drop saved photos that the current catalog no longer uses.
function pruneImages(data) {
  const inUse = new Set()
  for (const cat of data.categories) {
    for (const p of cat.products) {
      for (const link of p.Image_Link || []) {
        const m = /^\/zimg\/(\d+)\//.exec(link)
        if (m) inUse.add(m[1])
      }
    }
  }
  try {
    for (const name of fs.readdirSync(IMAGE_DIR)) {
      if (!inUse.has(name.replace(/\.type$/, '').replace(/_\d+$/, ''))) fs.rmSync(path.join(IMAGE_DIR, name), { force: true })
    }
  } catch {}
}

const app = express()
app.use(compression())
// Anything that is not production must never be indexed (this runs before every route, including pages built on the server).
app.use((req, res, next) => {
  if ((process.env.APP_ENV || 'production') !== 'production') res.set('X-Robots-Tag', 'noindex, nofollow')
  next()
})
app.set('trust proxy', 1) // behind nginx: req.ip must be the visitor's IP, not nginx's, for OTP rate limits
app.disable('x-powered-by')

// ---- Zoho connection: one-time authorization, then the server refreshes its own token ----
function adminRequired(req, res, next) {
  const token = process.env.ADMIN_TOKEN
  if (!token) return res.status(503).send('Set ADMIN_TOKEN in .env to use the admin pages.')
  const given = req.query.token || ''
  const a = Buffer.from(String(given))
  const b = Buffer.from(token)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).send('Invalid admin token.')
  next()
}

app.get('/admin/zoho-connect', adminRequired, (req, res) => {
  if (!zohoAuth.isConfigured()) return res.status(503).send('Set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET in .env first.')
  if (zohoAuth.isConnected() && req.query.force !== '1') {
    return res.send('Zoho is already connected. <a href="/admin/zoho-connect?token=' + encodeURIComponent(req.query.token) + '&force=1">Reconnect anyway</a>')
  }
  res.redirect(zohoAuth.buildAuthorizeUrl(req))
})

app.get('/oauth/zoho/callback', async (req, res) => {
  const { code, error } = req.query
  if (error || !code) return res.status(400).send(`Zoho authorization was not completed (${error || 'no code received'}).`)
  try {
    await zohoAuth.exchangeCodeForTokens(code, req)
    res.send('<h1>Connected to Zoho</h1><p>You can close this tab. Orders can now be pushed to Zoho automatically.</p>')
  } catch (err) {
    console.error('[zoho-oauth] token exchange failed:', err.message)
    res.status(502).send(`Could not complete the Zoho connection: ${err.message}`)
  }
})

app.get('/admin/zoho-status', adminRequired, (req, res) => {
  res.json({ configured: zohoAuth.isConfigured(), connected: zohoAuth.isConnected() })
})

// ---- Customer login (MSG91 OTP), account, checkout and orders ----
// Sign up and log in are the same flow: any Indian mobile number gets an OTP; a number seen for
// the first time simply starts with an empty profile. Everything below is scoped to the mobile
// number in the signed session cookie (req.mobile).
//
// Until MSG91_AUTHKEY and MSG91_TEMPLATE_ID are set in .env, login falls back to the old
// single test number with no OTP, exactly as before — it never opens up to every number.
const ALLOWED_TEST_MOBILE = process.env.ALLOWED_TEST_MOBILE || '8886772827'

const cleanMobile = (v) => String(v || '').replace(/\D/g, '').slice(-10)
const validMobile = (m) => /^[6-9]\d{9}$/.test(m) // Indian mobile numbers start with 6-9

function testSessionRequired(req, res, next) {
  const mobile = readSession(req.headers.cookie)
  if (!mobile) return res.status(401).json({ error: 'Please log in first' })
  req.mobile = mobile
  next()
}

function startSession(req, res, mobile) {
  res.cookie(SESSION_COOKIE, signSession(mobile), {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  })
}

app.get('/api/test-auth/config', (req, res) => {
  res.json({ otp: otp.isConfigured(), otpLength: otp.otpLength(), testMode: !otp.isConfigured() })
})

app.post('/api/test-auth/send-otp', express.json(), async (req, res) => {
  const mobile = cleanMobile(req.body?.mobile)
  if (!validMobile(mobile)) return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' })

  if (!otp.isConfigured()) {
    if (mobile !== ALLOWED_TEST_MOBILE) {
      return res.status(401).json({ error: 'Login is not switched on yet for this number.' })
    }
    return res.json({ ok: true, testMode: true })
  }

  const blocked = otp.checkSendAllowed(mobile, req.ip)
  if (blocked) return res.status(429).json({ error: blocked })
  try {
    let r = req.body?.resend ? await otp.resendOtp(mobile) : await otp.sendOtp(mobile)
    // MSG91 can only retry a code it still has on record; otherwise just send a fresh one.
    if (!r.ok && req.body?.resend) r = await otp.sendOtp(mobile)
    if (!r.ok) {
      console.warn('[otp] send failed:', r.message)
      return res.status(502).json({ error: 'Could not send the OTP right now. Please try again in a moment.' })
    }
    otp.clearVerifyFailures(mobile)
    res.json({ ok: true })
  } catch (err) {
    console.error('[otp] send error:', err.message)
    res.status(502).json({ error: 'Could not send the OTP right now. Please try again in a moment.' })
  }
})

app.post('/api/test-auth/verify-otp', express.json(), async (req, res) => {
  const mobile = cleanMobile(req.body?.mobile)
  const code = String(req.body?.otp || '').replace(/\D/g, '')
  if (!validMobile(mobile)) return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' })

  if (!otp.isConfigured()) {
    if (mobile !== ALLOWED_TEST_MOBILE) return res.status(401).json({ error: 'Login is not switched on yet for this number.' })
  } else {
    if (code.length !== otp.otpLength()) return res.status(400).json({ error: `Enter the ${otp.otpLength()}-digit OTP.` })
    if (otp.verifyLocked(mobile)) {
      return res.status(429).json({ error: 'Too many wrong attempts. Please request a new OTP.' })
    }
    try {
      const r = await otp.verifyOtp(mobile, code)
      if (!r.ok) {
        console.warn('[otp] verify rejected:', r.message)
        otp.recordVerifyFailure(mobile)
        return res.status(401).json({ error: 'That OTP is not correct or has expired.' })
      }
    } catch (err) {
      console.error('[otp] verify error:', err.message)
      return res.status(502).json({ error: 'Could not verify the OTP right now. Please try again.' })
    }
    otp.clearVerifyFailures(mobile)
  }

  startSession(req, res, mobile)
  const profile = testStore.getProfile(mobile)
  // isNew tells the page to walk a first-time customer to their profile.
  res.json({ ok: true, mobile, profile, cart: testStore.getCart(mobile), isNew: !profile })
})

app.get('/api/test-auth/me', (req, res) => {
  const mobile = readSession(req.headers.cookie)
  res.json(mobile ? { loggedIn: true, mobile } : { loggedIn: false })
})

app.post('/api/test-auth/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' })
  res.json({ ok: true })
})

const SYNCED_FIELDS = ['firstName', 'lastName', 'email', 'address', 'city', 'state', 'postalCode']

// The page polls this every 30s. Zoho -> website: if the matched Zoho contact now differs from
// what we last pushed/read (zohoSnapshot), a change was made in Zoho and non-empty values are
// adopted into the profile. The first read only records a baseline so nothing is overwritten.
app.get('/api/test-account', testSessionRequired, async (req, res) => {
  let profile = testStore.getProfile(req.mobile)
  if (profile?.zohoContacts && Object.keys(profile.zohoContacts).length) {
    const remote = await fetchProfileFromZoho(profile.zohoContacts, req.mobile)
    if (remote) {
      const snap = profile.zohoSnapshot
      const next = { ...profile }
      const nextSnap = { ...(snap || {}) }
      let changed = !snap
      for (const f of SYNCED_FIELDS) {
        if (!remote[f]) continue // empty in Zoho never blanks what the customer has
        if (snap && remote[f] !== snap[f]) {
          next[f] = remote[f] // edited in Zoho since we last looked
          changed = true
        }
        nextSnap[f] = remote[f]
      }
      next.zohoSnapshot = nextSnap
      if (changed) profile = testStore.saveProfile(req.mobile, next)
    }
  }
  res.json({ profile, status: profileStatus(profile) })
})

// States for the address dropdown, and whether live GST confirmation is switched on.
app.get('/api/meta/states', (req, res) => {
  res.json({
    states: selectableStates().map((s) => ({ name: s.name, code: s.code, gst: s.gst })),
    gstLookup: gstProviderConfigured(),
  })
})

// Checks a GST number: format and check digit always, and against the GST portal when a provider
// is configured. The wizard calls this before it lets a customer tick "I have GST" and continue.
const gstAttempts = new Map() // mobile -> [timestamps]
app.post('/api/test-gst/verify', express.json(), testSessionRequired, async (req, res) => {
  const recent = (gstAttempts.get(req.mobile) || []).filter((t) => t > Date.now() - 10 * 60 * 1000)
  if (recent.length >= 15) return res.status(429).json({ error: 'Too many checks. Please wait a few minutes.' })
  recent.push(Date.now())
  gstAttempts.set(req.mobile, recent)

  const result = await verifyGstin(req.body?.gstin)
  const profile = testStore.getProfile(req.mobile)
  const state = findState(profile?.state)
  res.json({
    ...result,
    // A business can ship to a state other than the one it is registered in, so this only informs.
    stateMismatch: Boolean(result.ok && state && result.state && state.name !== result.state),
  })
})

// Partial saves are fine (the sign-up wizard saves one step at a time): only fields present in the
// request change, and a first name is always required. What is needed to actually place an order
// is decided by profileStatus() and enforced at checkout.
app.post('/api/test-account', express.json(), testSessionRequired, async (req, res) => {
  const body = req.body || {}
  const existing = testStore.getProfile(req.mobile) || {}
  const pick = (key) => (body[key] !== undefined ? String(body[key] ?? '').trim() : String(existing[key] ?? ''))

  const firstName = pick('firstName')
  if (!firstName) return res.status(400).json({ error: 'Please enter your first name', field: 'firstName' })
  // Last name is only demanded once a customer sets up their details (the sign-up wizard sends it
  // together with the email); older saves and Zoho-driven updates may not carry it yet.
  if (body.lastName !== undefined && !String(body.lastName).trim()) {
    return res.status(400).json({ error: 'Please enter your last name', field: 'lastName' })
  }

  const lastName = pick('lastName')
  const email = pick('email')
  if (email && !isValidEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address', field: 'email' })

  let state = pick('state')
  if (state) {
    const found = findState(state)
    if (!found) return res.status(400).json({ error: 'Please choose your state from the list', field: 'state' })
    state = found.name
  }

  const postalCode = pick('postalCode')
  if (postalCode && !isValidPostalCode(postalCode)) {
    return res.status(400).json({ error: 'PIN code must be 6 digits', field: 'postalCode' })
  }

  // GST: "no" clears everything; "yes" needs a number that passes verification.
  let gst = {
    hasGst: existing.hasGst,
    gstin: existing.gstin || '',
    gstVerified: existing.gstVerified || '',
    gstLegalName: existing.gstLegalName || '',
    gstTradeName: existing.gstTradeName || '',
  }
  if (body.hasGst !== undefined) {
    const has = body.hasGst === true || body.hasGst === 'true' || body.hasGst === 'on'
    if (!has) {
      gst = { hasGst: false, gstin: '', gstVerified: '', gstLegalName: '', gstTradeName: '' }
    } else {
      const wanted = String(body.gstin ?? existing.gstin ?? '').replace(/\s+/g, '').toUpperCase()
      if (existing.gstin === wanted && existing.gstVerified === 'verified') {
        gst = { ...gst, hasGst: true } // already confirmed with the portal; do not ask again
      } else {
        const v = await verifyGstin(wanted)
        if (!v.ok) return res.status(400).json({ error: v.message, field: 'gstin', code: 'GSTIN_INVALID' })
        gst = {
          hasGst: true, gstin: v.gstin, gstVerified: v.verified,
          gstLegalName: v.legalName || '', gstTradeName: v.tradeName || '',
        }
      }
    }
  }

  const known = existing.zohoContacts || {}
  const prevSnapshot = existing.zohoSnapshot || {}
  const profile = testStore.saveProfile(req.mobile, {
    zohoContacts: known,
    zohoSnapshot: prevSnapshot,
    firstName,
    lastName,
    email,
    phone: req.mobile,
    address: pick('address'),
    city: pick('city'),
    state,
    postalCode,
    ...gst,
  })
  // Saved locally first, so a Zoho problem never loses the edit. Then pushed to the Zoho Books /
  // Inventory contact with the same mobile number (the session cookie is that number).
  const zoho = await syncProfileToZoho(profile, known)
  // Remember which Zoho contact was matched, so later saves keep updating that same one.
  const zohoContacts = { ...known }
  for (const r of zoho) if (r.status === 'updated') zohoContacts[r.key] = r.contactId
  // Record what Zoho now holds, so the next poll doesn't mistake our own push for a Zoho-side edit.
  const zohoSnapshot = { ...prevSnapshot }
  if (zoho.some((r) => r.status === 'updated')) {
    for (const f of ['firstName', 'lastName', 'email']) zohoSnapshot[f] = profile[f]
    if (profile.address && profile.city && profile.state && profile.postalCode) {
      for (const f of ['address', 'city', 'state', 'postalCode']) zohoSnapshot[f] = profile[f]
    }
  }
  clearContactCache()
  const saved = testStore.saveProfile(req.mobile, { ...profile, zohoContacts, zohoSnapshot })
  res.json({ ok: true, profile: saved, status: profileStatus(saved), zoho })
})

// Favourites: saved against the logged-in mobile number, so every device shows the same hearts.
app.get('/api/wishlist', testSessionRequired, (req, res) => {
  res.json({ items: testStore.getWishlist(req.mobile) })
})

app.post('/api/wishlist', express.json(), testSessionRequired, (req, res) => {
  const name = String(req.body?.name ?? '').replace(/\s+/g, ' ').trim()
  const variantId = String(req.body?.variantId ?? '').trim()
  if (!name || name.length > 200) return res.status(400).json({ error: 'Which product?' })
  if (variantId && !/^\d{1,30}$/.test(variantId)) return res.status(400).json({ error: 'Invalid product' })
  try {
    res.json({ items: testStore.setWishlistItem(req.mobile, { name, variantId }, req.body?.saved !== false) })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.get('/api/test-cart', testSessionRequired, (req, res) => {
  res.json({ cart: testStore.getCart(req.mobile) })
})

app.post('/api/test-cart', express.json(), testSessionRequired, (req, res) => {
  const cart = testStore.saveCart(req.mobile, req.body?.cart || {})
  res.json({ ok: true, cart })
})

// GST and total as Zoho will charge them, for the basket and the customer's saved address.
// Cached briefly so reopening the page does not create a new Zoho cart every time.
const estimateCache = new Map()
app.post('/api/checkout/estimate', express.json(), testSessionRequired, async (req, res) => {
  const profile = testStore.getProfile(req.mobile)
  if (!profileStatus(profile).complete) return res.status(400).json({ error: 'Complete your delivery details to see GST.', code: 'PROFILE_INCOMPLETE' })
  const items = Array.isArray(req.body?.items) ? req.body.items : []
  if (!items.length || items.some((it) => !it.variantId)) return res.status(400).json({ error: 'Your cart has an item that cannot be ordered online.' })
  const key = JSON.stringify([req.mobile, items.map((i) => [i.variantId, i.qty]), profile.state, profile.postalCode])
  const hit = estimateCache.get(key)
  if (hit && Date.now() - hit.at < 60_000) return res.json({ ok: true, ...hit.summary })
  try {
    const summary = await estimateOrder({ items, customer: profile })
    if (estimateCache.size > 200) estimateCache.clear()
    estimateCache.set(key, { at: Date.now(), summary })
    res.json({ ok: true, ...summary })
  } catch (err) {
    console.error('[estimate] failed:', err.message)
    res.status(err instanceof CheckoutError ? 400 : 502).json({ error: err.message })
  }
})

// Same figures before sign-in, so the breakup is visible from the first step. There is no address yet,
// so the business's own state stands in: the rate is right, and the CGST/SGST or IGST split is
// confirmed once the customer's real address is saved. Cached and rate limited per visitor.
const publicEstimateHits = new Map()
app.post('/api/checkout/estimate-preview', express.json(), async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 30) : []
  if (!items.length || items.some((it) => !it.variantId || !/^\d+$/.test(String(it.variantId)))) return res.status(400).json({ error: 'Nothing to estimate.' })
  const now = Date.now()
  const recent = (publicEstimateHits.get(req.ip) || []).filter((t) => t > now - 10 * 60 * 1000)
  if (recent.length >= 60) return res.status(429).json({ error: 'Please try again in a few minutes.' })
  recent.push(now); publicEstimateHits.set(req.ip, recent)
  const key = 'preview:' + JSON.stringify(items.map((i) => [i.variantId, i.qty]))
  const hit = estimateCache.get(key)
  if (hit && now - hit.at < 60_000) return res.json({ ok: true, preview: true, ...hit.summary })
  try {
    const summary = await estimateOrder({
      items,
      customer: { firstName: 'Guest', lastName: 'Visitor', email: 'guest@arambhika.com', phone: '9999999999', address: 'Sector 116', city: 'Noida', state: 'Uttar Pradesh', postalCode: '201301' },
    })
    if (estimateCache.size > 200) estimateCache.clear()
    estimateCache.set(key, { at: now, summary })
    res.json({ ok: true, preview: true, ...summary })
  } catch (err) {
    res.status(err instanceof CheckoutError ? 400 : 502).json({ error: err.message })
  }
})

// Places a real order on Zoho (cart -> address -> shipping -> offline payment), then
// verifies against the Admin API that Zoho actually created it before reporting success.
app.post('/api/test-checkout', express.json(), testSessionRequired, async (req, res) => {
  const profile = testStore.getProfile(req.mobile)
  // Everything the sign-up wizard collects must be done before an order can be placed.
  const status = profileStatus(profile)
  if (!status.complete) {
    return res.status(400).json({
      error: 'Please complete your profile to place an order',
      code: 'PROFILE_INCOMPLETE',
      missing: status.missing,
      status,
    })
  }

  const items = Array.isArray(req.body?.items) ? req.body.items : []
  if (!items.length) return res.status(400).json({ error: 'Your cart is empty' })
  for (const it of items) {
    if (!it.variantId) return res.status(400).json({ error: `${it.label || 'A product'} can't be ordered online yet (missing Zoho variant id)` })
  }

  const localOrder = testStore.addOrder(req.mobile, {
    id: `local_${Date.now()}`,
    placedAt: new Date().toISOString(),
    items,
    status: 'awaiting_payment',
  })

  try {
    // Gets the cart through address + shipping and hands back Zoho's real payment page
    // (Razorpay, configured in Zoho Commerce). Zoho creates the Sales Order itself only once
    // the customer actually pays there — see /api/test-orders/:id/confirm-payment below.
    const result = await placeOrder({ items, customer: profile })
    testStore.updateOrder(req.mobile, localOrder.id, { total: result.total, tax: result.summary?.tax })
    res.json({ ok: true, orderId: localOrder.id, paymentUrl: result.paymentUrl, total: result.total, summary: result.summary })
  } catch (err) {
    console.error('[test-checkout] failed:', err.message)
    testStore.updateOrder(req.mobile, localOrder.id, { status: 'failed', note: err.message })
    const status = err instanceof CheckoutError ? 400 : 502
    res.status(status).json({ error: err.message })
  }
})

// There is no payment webhook, so paid orders are found by listing the customer's Zoho sales
// orders (matched by email) and linking every one not yet on the account:
//  - to the closest earlier local order still awaiting payment, or
//  - as a new confirmed order of its own if none is waiting (e.g. paid after the page closed,
//    or two payments close together), so a paid order can never go missing.
const lastReconcileAt = new Map() // mobile -> ms
async function reconcileOrders(mobile, { force = false } = {}) {
  const profile = testStore.getProfile(mobile)
  if (!profile?.email) return
  if (!force && Date.now() - (lastReconcileAt.get(mobile) || 0) < 15000) return
  lastReconcileAt.set(mobile, Date.now())
  let rows
  try { rows = await listSalesOrdersByEmail(profile.email) } catch (err) {
    console.warn('[orders] could not list Zoho sales orders:', err.message)
    return
  }
  for (const so of rows) {
    const orders = testStore.getOrders(mobile)
    if (orders.some((o) => o.zohoSalesOrderId === so.salesorder_id)) continue
    const created = new Date(so.created_time).getTime()
    const waiting = orders
      .filter((o) => !o.zohoSalesOrderId && o.status === 'awaiting_payment')
      .filter((o) => !Number.isFinite(created) || new Date(o.placedAt).getTime() <= created + 60000)
      .sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt))[0]
    const link = {
      status: 'confirmed',
      zohoSalesOrderId: so.salesorder_id,
      zohoSalesOrderNumber: so.salesorder_number,
      total: so.total,
    }
    if (waiting) {
      testStore.updateOrder(mobile, waiting.id, link)
    } else {
      let items = []
      try { items = await getSalesOrderItems(so.salesorder_id) } catch {}
      testStore.addOrder(mobile, {
        id: `zoho_${so.salesorder_id}`,
        placedAt: so.created_time || new Date().toISOString(),
        items,
        ...link,
      })
    }
  }
}

// Called by the payment screen while it waits for the customer to finish paying.
app.post('/api/test-orders/:id/confirm-payment', testSessionRequired, async (req, res) => {
  const order = testStore.getOrders(req.mobile).find((o) => o.id === req.params.id)
  if (!order) return res.status(404).json({ error: 'Order not found' })
  try {
    await reconcileOrders(req.mobile, { force: true })
    const now = testStore.getOrders(req.mobile).find((o) => o.id === order.id)
    if (now?.zohoSalesOrderNumber) return res.json({ ok: true, salesOrderNumber: now.zohoSalesOrderNumber })
    res.json({ ok: false, message: 'Waiting for your payment to reach Zoho…' })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

app.get('/api/test-orders', testSessionRequired, async (req, res) => {
  await reconcileOrders(req.mobile)
  const orders = [...testStore.getOrders(req.mobile)].sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt))
  const enriched = await Promise.all(orders.map(async (o) => {
    if (!o.zohoSalesOrderId) return o
    try {
      const live = await getSalesOrderStatus(o.zohoSalesOrderId)
      return { ...o, live }
    } catch (err) {
      return { ...o, liveError: err.message }
    }
  }))
  res.json({ orders: enriched })
})

app.get('/api/test-orders/:id/invoice', testSessionRequired, async (req, res) => {
  const order = testStore.getOrders(req.mobile).find((o) => o.id === req.params.id)
  if (!order?.zohoSalesOrderNumber) return res.status(404).json({ error: 'Order not found' })
  try {
    const invoice = await findInvoiceForSalesOrder(order.zohoSalesOrderNumber, process.env.ZOHO_BOOKS_ORG_ID)
    if (!invoice) return res.json({ invoice: null, message: 'No invoice has been raised for this order yet.' })
    let ewaybill = null
    try { ewaybill = await findEwayBillForInvoice(invoice.invoice_id, process.env.ZOHO_INVENTORY_ORG_ID) } catch {}
    res.json({ invoice, ewaybill })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

// The paper that matches where the order is: the sales order until it ships, then the shipment,
// then the invoice once delivered. The PDFs are streamed through here so Zoho links never reach the browser.
app.get('/api/test-orders/:id/document', testSessionRequired, async (req, res) => {
  const order = testStore.getOrders(req.mobile).find((o) => o.id === req.params.id)
  if (!order?.zohoSalesOrderId) return res.status(404).json({ error: 'Order not found' })
  try {
    let pdf, name
    if (req.query.type === 'invoice') {
      const invoice = await findInvoiceForSalesOrder(order.zohoSalesOrderNumber, process.env.ZOHO_BOOKS_ORG_ID)
      if (!invoice) return res.status(404).json({ error: 'No invoice has been raised for this order yet.' })
      pdf = await fetchBooksPdf('invoices', invoice.invoice_id, process.env.ZOHO_BOOKS_ORG_ID)
      name = invoice.invoice_number || 'invoice'
    } else {
      pdf = await fetchBooksPdf('salesorders', order.zohoSalesOrderId, process.env.ZOHO_BOOKS_ORG_ID)
      name = order.zohoSalesOrderNumber || 'sales-order'
    }
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${String(name).replace(/[^\w.-]/g, '_')}.pdf"`, 'Cache-Control': 'private, no-store' })
    res.send(pdf)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

app.get('/api/test-orders/:id/shipment', testSessionRequired, async (req, res) => {
  const order = testStore.getOrders(req.mobile).find((o) => o.id === req.params.id)
  if (!order?.zohoSalesOrderId) return res.status(404).json({ error: 'Order not found' })
  try {
    res.json({ shipments: await findShipmentsForSalesOrder(order.zohoSalesOrderId, process.env.ZOHO_INVENTORY_ORG_ID) })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

app.get('/admin/zoho-orders', adminRequired, (req, res) => {
  res.json({ orders: testStore.getAllOrders() })
})

// One address per product, with its own title, description, canonical link and structured data.
app.get('/product/:slug', (req, res) => {
  let template
  try { template = fs.readFileSync(path.join(PUBLIC_DIR, 'product.html'), 'utf8') } catch { return res.status(500).send('Product page template missing') }
  const html = renderProductPage(template, current.data, String(req.params.slug || '').toLowerCase())
  if (!html) {
    res.status(404).set('X-Robots-Tag', 'noindex')
    return res.send('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Product not found | Arambhika</title><meta name="robots" content="noindex"><body style="font-family:system-ui;padding:40px;text-align:center"><h1>We could not find that product</h1><p><a href="/">Back to the store</a></p>')
  }
  res.set('Cache-Control', 'no-cache').type('html').send(html)
})

// One address per category, from Zoho's own category handle.
app.get('/category/:slug', (req, res) => {
  let template
  try { template = fs.readFileSync(path.join(PUBLIC_DIR, 'category.html'), 'utf8') } catch { return res.status(500).send('Category page template missing') }
  const html = renderCategoryPage(template, current.data, String(req.params.slug || '').toLowerCase())
  if (!html) return sendNotFound(req, res)
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600').type('html').send(html)
})

// The home page carries a plain-HTML list of every category and product, so it is crawlable without JavaScript.
function sendHome(req, res, next) {
  let html
  try { html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8') } catch { return next() }
  html = html.replace(/<!-- browse:start -->[\s\S]*?<!-- browse:end -->/, () => `<!-- browse:start -->${renderBrowseList(current.data)}<!-- browse:end -->`)
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600').type('html').send(html)
}
app.get(['/', '/index.html'], sendHome)

// A friendly, indexable-free 404 with the way back into the store.
function sendNotFound(req, res) {
  let template
  try { template = fs.readFileSync(path.join(PUBLIC_DIR, '404.html'), 'utf8') } catch { return res.status(404).type('text').send('Not found') }
  const cats = listCategories(current.data)
  const main = `<h1 class="cp-title">We could not find that page</h1>
      <p class="cp-intro">The link may be old or mistyped. Here is where to go next.</p>
      <nav class="cp-others" aria-label="Categories"><h2>Shop by category</h2>${cats.map((c) => `<a href="/category/${c.slug}">${c.name}</a>`).join('')}</nav>
      <p class="cp-intro"><a href="/">Back to the store</a> &middot; <a href="/blog/">Read the guides</a> &middot; <a href="/faq.html">FAQs</a> &middot; <a href="https://wa.me/919315545821" target="_blank" rel="noopener">Ask us on WhatsApp</a></p>`
  res.status(404).set('X-Robots-Tag', 'noindex').type('html').send(template.replace('<!--SEO_HEAD-->', () => '<title>Page not found | Arambhika</title>\n  <meta name="robots" content="noindex" />').replace('<!--PAGE_MAIN-->', () => main))
}

app.get('/product-sitemap.xml', (req, res) => {
  res.set('Cache-Control', 'public, max-age=900').type('application/xml').send(renderProductSitemap(current.data))
})

app.get('/products.json', (req, res) => {
  res.set({
    'Cache-Control': 'no-cache',
    'X-Catalog-Source': current.source,
    'X-Catalog-Age-Seconds': current.at ? String(Math.round((Date.now() - current.at) / 1000)) : 'unknown',
  })
  res.json(current.data)
})

const categoryImageCache = new Map()
app.get('/zcat/:id/:file', async (req, res) => {
  const { id, file } = req.params
  if (!/^\d+$/.test(id) || !/^[A-Za-z0-9_.+%-]+$/.test(file)) return res.status(400).end()
  let img = categoryImageCache.get(`${id}/${file}`)
  if (!img) {
    try { img = await fetchCategoryImage(id, file) } catch (err) { console.error('[category image]', err.message) }
    if (img) categoryImageCache.set(`${id}/${file}`, img)
  }
  if (!img) return res.status(404).end()
  res.set({ 'Content-Type': img.type, 'Cache-Control': 'public, max-age=86400' })
  res.send(img.buffer)
})

app.get('/zimg/:docId/:file', async (req, res) => {
  const { docId, file } = req.params
  if (!/^\d+$/.test(docId)) return res.status(400).end()
  const w = [200, 400, 800].includes(Number(req.query.w)) ? Number(req.query.w) : undefined
  const img = await getImage(docId, file, w)
  if (!img) return res.status(404).end()
  res.set({ 'Content-Type': img.type, 'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400' })
  res.send(img.buffer)
})

// Anything that is not production must never be indexed, so a dev server cannot compete with the
// real site in search results. APP_ENV is "production" on the live server (and when unset).
const IS_PRODUCTION = (process.env.APP_ENV || 'production') === 'production'
if (!IS_PRODUCTION) {
  app.use((req, res, next) => { res.set('X-Robots-Tag', 'noindex, nofollow'); next() })
  app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /\n'))
}

// Used by the deploy pipeline to confirm a release actually came up.
app.get('/healthz', (req, res) => {
  res.json({ ok: true, env: process.env.APP_ENV || 'production', catalog: current.source })
})

// Stylesheets are served with comments and extra whitespace removed (cached by file time).
const cssCache = new Map()
function minifyCss(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};,])\s*/g, '$1').replace(/;}/g, '}').trim()
}
app.get(['/styles.css', '/_theme_overrides.css', '/blog/blog.css'], (req, res, next) => {
  const file = path.join(PUBLIC_DIR, req.path)
  try {
    const mtime = fs.statSync(file).mtimeMs
    let hit = cssCache.get(file)
    if (!hit || hit.mtime !== mtime) { hit = { mtime, body: minifyCss(fs.readFileSync(file, 'utf8')) }; cssCache.set(file, hit) }
    // revalidated on every visit (a cheap 304 when unchanged), so a release never leaves a visitor with old styles next to new pages
    res.set('Cache-Control', 'public, max-age=0, must-revalidate').type('text/css').send(hit.body)
  } catch { next() }
})

app.use(express.static(PUBLIC_DIR, {
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (/\.(png|jpe?g|webp|svg|ico|gif|woff2?|pdf)$/i.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=604800')
    // scripts and styles are revalidated on each visit, so they always match the page they belong to
  },
}))
app.use(sendNotFound)

app.listen(PORT, () => {
  console.log(`Arambhika store running at http://localhost:${PORT} (catalog source: ${current.source})`)
  if (!process.env.ZOHO_STOREFRONT_DOMAIN) console.warn('ZOHO_STOREFRONT_DOMAIN is not set: Zoho product photos will not load')
  // Tests set DISABLE_CATALOG_REFRESH so they never reach out to Zoho.
  if (!process.env.DISABLE_CATALOG_REFRESH) {
    refreshCatalog()
    setInterval(refreshCatalog, REFRESH_EVERY)
  }
})
