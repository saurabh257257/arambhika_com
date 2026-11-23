// Zoho Commerce *storefront* API: public and token-free. It returns exactly what is
// switched on in the online store (product and category "Show in Online Store").

import { getAccessToken, isConnected } from './zoho-oauth.js'

const dc = () => (process.env.ZOHO_DC === 'com' ? 'com' : 'in')
const IMAGE_SIZE = () => process.env.ZOHO_IMAGE_SIZE || '1000x1000'

function storefrontDomain() {
  const domain = process.env.ZOHO_STOREFRONT_DOMAIN
  if (!domain) throw new Error('Missing ZOHO_STOREFRONT_DOMAIN')
  return domain
}

async function storefrontGet(pathAndQuery) {
  const res = await fetch(`https://commerce.zoho.${dc()}/storefront/api/v1${pathAndQuery}`, {
    headers: { 'domain-name': storefrontDomain() },
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || json?.status_code !== '0') {
    throw new Error(`Zoho storefront ${res.status}: ${json?.status_message || 'request failed'}`)
  }
  return json.payload
}

// Zoho's page parameter is `page_number` (a plain `page` is ignored and returns page 1 forever).
// Items are de-duplicated by id and paging stops when a page adds nothing new, so a repeated page
// can never multiply the catalog.
export async function fetchAllPages(path, key, get = storefrontGet) {
  const items = []
  const seen = new Set()
  for (let page = 1; page <= 20; page++) {
    const payload = await get(`${path}${path.includes('?') ? '&' : '?'}page_number=${page}`)
    let added = 0
    for (const item of payload[key] || []) {
      const id = item.product_id || item.category_id || item.id || JSON.stringify(item)
      if (seen.has(id)) continue
      seen.add(id)
      items.push(item)
      added++
    }
    if (!added || !payload.pagination?.has_more_page) break
  }
  return items
}

// The product list API returns only the first photo of each product; the detail API
// returns all of them. Details are cached so the 30s catalog refresh stays cheap.
const DETAIL_TTL = (Number(process.env.PRODUCT_DETAIL_CACHE_SECONDS) || 300) * 1000
const detailCache = new Map()

async function fetchProductDetail(product) {
  const hit = detailCache.get(product.product_id)
  if (hit && Date.now() - hit.at < DETAIL_TTL) return hit.detail
  try {
    const payload = await storefrontGet(`/products/${product.handle}/${product.product_id}`)
    const detail = payload.product
    detailCache.set(product.product_id, { detail, at: Date.now() })
    return detail
  } catch (err) {
    console.error('[detail] failed for', product.name, '-', err.message)
    return hit?.detail || null
  }
}

// A product's photos come back in one of two places depending on how they were added in Zoho: as the
// product's `documents`, or (for photos attached to the variant) as `images`, with a placeholder
// picture when there is none. Both become the same shape.
export function photosFrom(detail) {
  if (detail?.documents?.length) return detail.documents
  const out = []
  for (const im of detail?.images || []) {
    if (!im || im.is_placeholder_image || !im.id || String(im.id) === '-1') continue
    const m = /^\/product-images\/([^/]+)\//.exec(im.url || '')
    if (!m) continue
    let name = m[1]
    try { name = decodeURIComponent(m[1]) } catch { /* keep the raw name */ }
    out.push({ document_id: String(im.id), name, attachment_order: im.order || 0 })
  }
  return out
}

// ---- Photos from the Zoho Commerce admin API ----
// The public store feed lists only a product's own photos. Many products have their photo attached to the variant (the inventory side),
// which the feed shows as "no preview image". The admin product list has every photo of every product and variant, so it is used for photos.
// It needs the Zoho connection to include the ZohoCommerce.products.READ permission; without it everything works as before, minus those photos.
const ADMIN_PHOTO_TTL = () => (Number(process.env.ADMIN_PHOTO_CACHE_SECONDS) || 300) * 1000
let adminPhotoCache = { at: 0, map: null }
let lastPhotoWarning = ''

export function resetAdminPhotoCache() {
  adminPhotoCache = { at: 0, map: null }
  lastPhotoWarning = ''
}

async function adminProductsPage(page) {
  const token = await getAccessToken()
  const res = await fetch(`https://commerce.zoho.${dc()}/store/api/v1/products?per_page=200&page=${page}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'domain-name': storefrontDomain() },
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json || (json.code !== undefined && json.code !== 0)) throw new Error(json?.message || `Zoho admin API error (${res.status})`)
  return json
}

// product id -> its photos in Zoho's own order, from the product and from every variant, each photo once
export async function fetchAdminPhotoMap(getPage = adminProductsPage) {
  const map = new Map()
  for (let page = 1; page <= 20; page++) {
    const json = await getPage(page)
    for (const p of json.products || []) {
      const docs = [...(p.documents || []), ...(p.variants || []).flatMap((v) => v.documents || [])]
      const seen = new Set()
      const list = []
      for (const d of docs) {
        const id = String(d?.document_id || '')
        const name = d?.file_name || d?.name
        if (!id || id === '-1' || !name || seen.has(id)) continue
        seen.add(id)
        list.push({ document_id: id, name, attachment_order: Number(d.attachment_order) || 0 })
      }
      list.sort((a, b) => a.attachment_order - b.attachment_order)
      map.set(String(p.product_id), list)
    }
    if (!json.page_context?.has_more_page) break
  }
  return map
}

export function applyAdminPhotos(products, map) {
  return products.map((p) => {
    const docs = map.get(String(p.product_id))
    return docs ? { ...p, documents: docs, photosFromAdmin: true } : p
  })
}

// The photo map, kept for a few minutes. null when Zoho is not connected, the permission is missing or Zoho cannot be reached
// (then the store feed's own photos are used, and the reason is logged once).
export async function adminPhotos(getPage) {
  if (!getPage && !isConnected()) return null
  if (adminPhotoCache.map && Date.now() - adminPhotoCache.at < ADMIN_PHOTO_TTL()) return adminPhotoCache.map
  try {
    const map = await fetchAdminPhotoMap(getPage)
    adminPhotoCache = { at: Date.now(), map }
    lastPhotoWarning = ''
    return map
  } catch (err) {
    if (err.message !== lastPhotoWarning) console.error(`[photos] could not read product photos from Zoho (${err.message}). If the Zoho connection was made before this feature, reconnect it once at /admin/zoho-connect so it includes the product photo permission.`)
    lastPhotoWarning = err.message
    return adminPhotoCache.map
  }
}

async function withFullDocuments(products, { skipDetail = false } = {}) {
  const out = new Array(products.length)
  let failures = 0
  let next = 0
  const worker = async () => {
    while (next < products.length) {
      const i = next++
      if (skipDetail || products[i].photosFromAdmin) { out[i] = products[i]; continue } // photos already complete from the admin list
      const detail = await fetchProductDetail(products[i])
      if (!detail) failures++
      const docs = photosFrom(detail)
      out[i] = docs.length ? { ...products[i], documents: docs } : products[i]
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  return { products: out, failures }
}

// `detailFailures` counts products whose full photo list could not be fetched; the caller
// decides whether such a partial result is good enough to replace the last good snapshot.
// Collections (e.g. 18650, 21700, 32650) are set up in Zoho Commerce; we read them as they are.
// A failure here must never take the catalogue down, so it just means "no collections this time".
export async function fetchCollections() {
  try {
    const list = await fetchAllPages('/collections', 'collections')
    const out = []
    for (const c of list) {
      const members = await fetchAllPages(`/products?collection_id=${c.id}`, 'products')
      out.push({ name: c.name, handle: c.handle, productIds: members.map((p) => String(p.product_id)) })
    }
    return out
  } catch (err) {
    console.error('[collections] failed:', err.message)
    return null
  }
}

export async function fetchStorefrontCatalog() {
  const [categories, products, collections] = await Promise.all([
    fetchAllPages('/categories', 'categories'),
    fetchAllPages('/products', 'products'),
    fetchCollections(),
  ])
  const photoMap = await adminPhotos()
  const full = await withFullDocuments(photoMap ? applyAdminPhotos(products, photoMap) : products, { skipDetail: !!photoMap })
  return { categories, products: full.products, collections, detailFailures: full.failures }
}

export async function fetchCategoryImage(id, file, size = 500) {
  const res = await fetch(`https://${storefrontDomain()}/category-images/${file}/${id}/${size}x${size}`)
  if (!res.ok) return null
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    type: (res.headers.get('content-type') || 'image/webp').split(';')[0],
  }
}

export async function fetchImage(documentId, fileName, size) {
  const url = `https://${storefrontDomain()}/product-images/${encodeURIComponent(fileName)}/${documentId}/${size || IMAGE_SIZE()}`
  const res = await fetch(url)
  if (!res.ok) return null
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    type: (res.headers.get('content-type') || 'image/jpeg').split(';')[0],
  }
}
