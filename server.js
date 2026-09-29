import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchStorefrontCatalog, fetchImage } from './lib/zoho.js'
import { buildCatalog } from './lib/catalog.js'

try { process.loadEnvFile() } catch {}

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.join(ROOT, 'public')
const PORT = Number(process.env.PORT) || 3000
const CATALOG_TTL = (Number(process.env.CATALOG_CACHE_SECONDS) || 30) * 1000
const RETRY_AFTER_FAILURE = 15_000

const localCatalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.local.json'), 'utf8'))

let cache = null
let inflight = null

async function loadCatalog() {
  try {
    const data = buildCatalog(await fetchStorefrontCatalog(), localCatalog)
    cache = { data, at: Date.now(), source: 'zoho' }
  } catch (err) {
    console.error('[catalog] Zoho fetch failed:', err.message)
    cache = {
      data: cache?.data || localCatalog,
      at: Date.now() - CATALOG_TTL + RETRY_AFTER_FAILURE,
      source: cache?.data ? 'zoho-stale' : 'local-fallback',
    }
  }
  return cache
}

async function getCatalog() {
  if (cache && Date.now() - cache.at < CATALOG_TTL) return cache
  if (!inflight) inflight = loadCatalog().finally(() => { inflight = null })
  return inflight
}

const imageCache = new Map()
const IMAGE_CACHE_MAX = 400

const app = express()
app.disable('x-powered-by')

app.get('/products.json', async (req, res) => {
  const { data, source } = await getCatalog()
  res.set({ 'Cache-Control': 'no-cache', 'X-Catalog-Source': source })
  res.json(data)
})

app.get('/zimg/:docId/:file', async (req, res) => {
  const { docId, file } = req.params
  if (!/^\d+$/.test(docId)) return res.status(400).end()

  const cacheKey = `${docId}/${file}`
  let img = imageCache.get(cacheKey)
  if (!img) {
    try { img = await fetchImage(docId, file) } catch (err) {
      console.error('[image] fetch failed:', err.message)
    }
    if (!img) return res.status(404).end()
    if (imageCache.size >= IMAGE_CACHE_MAX) imageCache.delete(imageCache.keys().next().value)
    imageCache.set(cacheKey, img)
  }
  res.set({ 'Content-Type': img.type, 'Cache-Control': 'public, max-age=86400' })
  res.send(img.buffer)
})

app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }))

app.listen(PORT, () => {
  console.log(`Arambhika store running at http://localhost:${PORT}`)
  if (!process.env.ZOHO_STOREFRONT_DOMAIN) console.warn('ZOHO_STOREFRONT_DOMAIN is not set: Zoho product photos will not load')
})
