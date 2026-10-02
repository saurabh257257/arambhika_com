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

async function fetchAllPages(path, key) {
  const items = []
  for (let page = 1; page <= 20; page++) {
    const payload = await storefrontGet(`${path}?page=${page}`)
    items.push(...(payload[key] || []))
    if (!payload.pagination?.has_more_page) break
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
  let next = 0
  const worker = async () => {
    while (next < products.length) {
      const i = next++
      const detail = await fetchProductDetail(products[i])
      out[i] = detail?.documents?.length ? { ...products[i], documents: detail.documents } : products[i]
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  return out
}

export async function fetchStorefrontCatalog() {
  const [categories, products] = await Promise.all([
    fetchAllPages('/categories', 'categories'),
    fetchAllPages('/products', 'products'),
  ])
  return { categories, products: await withFullDocuments(products) }
}

export async function fetchImage(documentId, fileName) {
  const url = `https://${storefrontDomain()}/product-images/${encodeURIComponent(fileName)}/${documentId}/${IMAGE_SIZE()}`
  const res = await fetch(url)
  if (!res.ok) return null
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    type: (res.headers.get('content-type') || 'image/jpeg').split(';')[0],
  }
}
