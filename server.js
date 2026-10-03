import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchStorefrontCatalog, fetchImage } from './lib/zoho.js'
import { buildCatalog } from './lib/catalog.js'

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
