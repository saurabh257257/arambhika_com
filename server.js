import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import { fetchStorefrontCatalog, fetchImage } from './lib/zoho.js'
import { buildCatalog } from './lib/catalog.js'
import * as zohoAuth from './lib/zoho-oauth.js'
import { placeOrder, CheckoutError } from './lib/zoho-checkout.js'
import { listSalesOrdersByEmail, getSalesOrderItems, getSalesOrderStatus, findInvoiceForSalesOrder, findEwayBillForInvoice } from './lib/zoho-admin.js'
import * as testStore from './lib/customer-store.js'
import * as otp from './lib/otp.js'
import { signSession, readSession, SESSION_COOKIE, SESSION_DAYS } from './lib/session.js'
import { syncProfileToZoho, fetchProfileFromZoho, clearContactCache } from './lib/zoho-contacts.js'

try { process.loadEnvFile() } catch {}

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.join(ROOT, 'public')
const DATA_DIR = path.join(ROOT, 'data')
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

const imagePaths = (docId) => ({ body: path.join(IMAGE_DIR, docId), meta: path.join(IMAGE_DIR, `${docId}.type`) })

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

async function getImage(docId, file) {
  const memKey = `${docId}/${file}`
  let img = imageCache.get(memKey) || readImageFromDisk(docId)
  if (!img) {
    try { img = await fetchImage(docId, file) } catch (err) { console.error('[image] fetch failed:', err.message) }
    if (img) writeImageToDisk(docId, img)
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
      if (!inUse.has(name.replace(/\.type$/, ''))) fs.rmSync(path.join(IMAGE_DIR, name), { force: true })
    }
  } catch {}
}

const app = express()
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
    const r = req.body?.resend ? await otp.resendOtp(mobile) : await otp.sendOtp(mobile)
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
  res.json({ profile })
})

// Only the name is required to save a profile at all — full address is checked separately,
// only at the moment of actually checking out (see /api/test-checkout below).
app.post('/api/test-account', express.json(), testSessionRequired, async (req, res) => {
  const { firstName, lastName, email, address, city, state, postalCode } = req.body || {}
  if (!firstName) return res.status(400).json({ error: 'Please enter your name' })
  const known = testStore.getProfile(req.mobile)?.zohoContacts || {}
  const prevSnapshot = testStore.getProfile(req.mobile)?.zohoSnapshot || {}
  const profile = testStore.saveProfile(req.mobile, {
    zohoContacts: known,
    firstName,
    lastName: lastName || '',
    email: email || '',
    phone: req.mobile,
    address: address || '',
    city: city || '',
    state: state || '',
    postalCode: postalCode || '',
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
  res.json({ ok: true, profile: saved, zoho })
})

// Zoho's checkout API rejects the order if last_name or email is blank ("Mandatory field ...
// is not given"), confirmed live one at a time — so both are required at checkout time too,
// not just the address fields.
function profileAddressIsComplete(profile) {
  return Boolean(
    profile?.firstName && profile?.lastName && profile?.email &&
    profile?.address && profile?.city && profile?.state && profile?.postalCode
  )
}

app.get('/api/test-cart', testSessionRequired, (req, res) => {
  res.json({ cart: testStore.getCart(req.mobile) })
})

app.post('/api/test-cart', express.json(), testSessionRequired, (req, res) => {
  const cart = testStore.saveCart(req.mobile, req.body?.cart || {})
  res.json({ ok: true, cart })
})

// Places a real order on Zoho (cart -> address -> shipping -> offline payment), then
// verifies against the Admin API that Zoho actually created it before reporting success.
app.post('/api/test-checkout', express.json(), testSessionRequired, async (req, res) => {
  const profile = testStore.getProfile(req.mobile)
  if (!profileAddressIsComplete(profile)) {
    return res.status(400).json({ error: 'Please add your shipping address to checkout', code: 'ADDRESS_REQUIRED' })
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
    testStore.updateOrder(req.mobile, localOrder.id, { total: result.total })
    res.json({ ok: true, orderId: localOrder.id, paymentUrl: result.paymentUrl, total: result.total })
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

app.get('/admin/zoho-orders', adminRequired, (req, res) => {
  res.json({ orders: testStore.getAllOrders() })
})

app.get('/products.json', (req, res) => {
  res.set({
    'Cache-Control': 'no-cache',
    'X-Catalog-Source': current.source,
    'X-Catalog-Age-Seconds': current.at ? String(Math.round((Date.now() - current.at) / 1000)) : 'unknown',
  })
  res.json(current.data)
})

app.get('/zimg/:docId/:file', async (req, res) => {
  const { docId, file } = req.params
  if (!/^\d+$/.test(docId)) return res.status(400).end()
  const img = await getImage(docId, file)
  if (!img) return res.status(404).end()
  res.set({ 'Content-Type': img.type, 'Cache-Control': 'public, max-age=86400' })
  res.send(img.buffer)
})

app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }))

app.listen(PORT, () => {
  console.log(`Arambhika store running at http://localhost:${PORT} (catalog source: ${current.source})`)
  if (!process.env.ZOHO_STOREFRONT_DOMAIN) console.warn('ZOHO_STOREFRONT_DOMAIN is not set: Zoho product photos will not load')
  refreshCatalog()
  setInterval(refreshCatalog, REFRESH_EVERY)
})
