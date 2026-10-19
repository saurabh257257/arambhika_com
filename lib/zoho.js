// Zoho Commerce *storefront* API: public and token-free. It returns exactly what is
// switched on in the online store (product and category "Show in Online Store").

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

async function withFullDocuments(products) {
  const out = new Array(products.length)
  let failures = 0
  let next = 0
  const worker = async () => {
    while (next < products.length) {
      const i = next++
      const detail = await fetchProductDetail(products[i])
      if (!detail) failures++
      out[i] = detail?.documents?.length ? { ...products[i], documents: detail.documents } : products[i]
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
  const full = await withFullDocuments(products)
  return { categories, products: full.products, collections, detailFailures: full.failures }
}

export async function fetchCategoryImage(id, file) {
  const res = await fetch(`https://${storefrontDomain()}/category-images/${file}/${id}/500x500`)
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
