import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import { fetchStorefrontCatalog, fetchImage } from './lib/zoho.js'
import { buildCatalog } from './lib/catalog.js'
import * as zohoAuth from './lib/zoho-oauth.js'
import { placeOrder, CheckoutError } from './lib/zoho-checkout.js'
import { findRecentSalesOrderByPhone, getSalesOrderStatus, findInvoiceForSalesOrder, findEwayBillForInvoice } from './lib/zoho-admin.js'
import * as testStore from './lib/test-store.js'

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
  if (zohoAuth.isConnected()) {
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

// ---- TEMPORARY test-mode login, account, checkout and orders ----
// Login is restricted to one hardcoded number and skips real OTP verification entirely,
// so this can be tested today while MSG91's DLT registration is still pending. Before any
// real customer can use this, swap this block for the real MSG91 OTP flow.
const ALLOWED_TEST_MOBILE = process.env.ALLOWED_TEST_MOBILE || '8886772827'
const TEST_SESSION_COOKIE = 'arambhika_test_session'

function testSessionRequired(req, res, next) {
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map((p) => p.trim().split('=')))
  if (cookies[TEST_SESSION_COOKIE] !== ALLOWED_TEST_MOBILE) return res.status(401).json({ error: 'Please log in first' })
  next()
}

app.post('/api/test-auth/login', express.json(), (req, res) => {
  const mobile = String(req.body?.mobile || '').replace(/\D/g, '').slice(-10)
  if (mobile !== ALLOWED_TEST_MOBILE) {
    return res.status(401).json({ error: `This test build only accepts ${ALLOWED_TEST_MOBILE}. Real OTP login for any number comes once MSG91 is approved.` })
  }
  res.cookie(TEST_SESSION_COOKIE, mobile, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  })
  res.json({ ok: true, mobile })
})

app.get('/api/test-auth/me', (req, res) => {
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map((p) => p.trim().split('=')))
  const mobile = cookies[TEST_SESSION_COOKIE]
  res.json(mobile === ALLOWED_TEST_MOBILE ? { loggedIn: true, mobile } : { loggedIn: false })
})

app.post('/api/test-auth/logout', (req, res) => {
  res.clearCookie(TEST_SESSION_COOKIE, { path: '/' })
  res.json({ ok: true })
})

app.get('/api/test-account', testSessionRequired, (req, res) => {
  res.json({ profile: testStore.getProfile() })
})

app.post('/api/test-account', express.json(), testSessionRequired, (req, res) => {
  const { firstName, lastName, email, address, city, state, postalCode } = req.body || {}
  if (!firstName || !address || !city || !state || !postalCode) {
    return res.status(400).json({ error: 'Please fill in name, address, city, state and PIN code' })
  }
  const profile = testStore.saveProfile({ firstName, lastName: lastName || '', email: email || '', phone: ALLOWED_TEST_MOBILE, address, city, state, postalCode })
  res.json({ ok: true, profile })
})

// Places a real order on Zoho (cart -> address -> shipping -> offline payment), then
// verifies against the Admin API that Zoho actually created it before reporting success.
app.post('/api/test-checkout', express.json(), testSessionRequired, async (req, res) => {
  const profile = testStore.getProfile()
  if (!profile) return res.status(400).json({ error: 'Please fill in your profile/address first' })

  const items = Array.isArray(req.body?.items) ? req.body.items : []
  if (!items.length) return res.status(400).json({ error: 'Your cart is empty' })
  for (const it of items) {
    if (!it.variantId) return res.status(400).json({ error: `${it.label || 'A product'} can't be ordered online yet (missing Zoho variant id)` })
  }

  const localOrder = testStore.addOrder({
    id: `local_${Date.now()}`,
    placedAt: new Date().toISOString(),
    items,
    status: 'placing',
  })

  try {
    const result = await placeOrder({ items, customer: profile })
    if (!result.hadShippingMethod) {
      testStore.updateOrder(localOrder.id, { status: 'failed', note: 'No shipping method is configured in Zoho Commerce (Settings > Shipping) — the order could not complete.' })
      return res.status(409).json({ error: 'No shipping method is configured in Zoho yet. Add one under Settings > Shipping in Zoho Commerce, then try again.' })
    }

    // Zoho's offline-payment response is unreliable to parse directly, so confirm for real.
    await new Promise((r) => setTimeout(r, 2000))
    const salesOrder = await findRecentSalesOrderByPhone(profile.phone)
    if (!salesOrder) {
      testStore.updateOrder(localOrder.id, { status: 'unconfirmed', note: 'Checkout completed but no matching Sales Order was found in Zoho yet.' })
      return res.status(502).json({ error: 'Checkout ran, but Zoho has not shown the Sales Order yet. Check /admin/zoho-orders in a minute.' })
    }

    testStore.updateOrder(localOrder.id, {
      status: 'confirmed',
      zohoSalesOrderId: salesOrder.salesorder_id,
      zohoSalesOrderNumber: salesOrder.salesorder_number,
    })
    res.json({ ok: true, salesOrderNumber: salesOrder.salesorder_number })
  } catch (err) {
    console.error('[test-checkout] failed:', err.message)
    testStore.updateOrder(localOrder.id, { status: 'failed', note: err.message })
    const status = err instanceof CheckoutError ? 400 : 502
    res.status(status).json({ error: err.message })
  }
})

app.get('/api/test-orders', testSessionRequired, async (req, res) => {
  const orders = testStore.getOrders()
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
  const order = testStore.getOrders().find((o) => o.id === req.params.id)
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
  res.json({ orders: testStore.getOrders() })
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
