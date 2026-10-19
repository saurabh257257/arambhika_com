// Server-rendered product pages: /product/<slug>
//
// Every catalog product gets its own address, its own <title>, description, canonical link and
// Product structured data, so it can be found and shared. The page body is drawn in the browser
// by public/product.js from the same data; the basics (name, price, specs) are also written into
// the HTML so crawlers and slow connections see a real page.

export const SITE_URL = () => (process.env.SITE_URL || 'https://www.arambhika.com').replace(/\/+$/, '')

// Must match the browser's toDomToken(normalizeProductCode(name)) in script.js.
export const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const productUrl = (name) => `/product/${slugify(name)}`

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// Safe to place inside a <script> element.
const jsonForScript = (obj) =>
  JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : [])
const priceNumber = (p) => Number(String(p ?? '').replace(/[^\d.]/g, '')) || 0

export function allProducts(catalog) {
  const out = []
  for (const category of catalog?.categories || []) {
    for (const product of category.products || []) {
      if (!product?.ProductCode || product.ProductCode.trim().length < 2) continue
      out.push({ product, category: category.name || category.Category || '' })
    }
  }
  return out
}

export function findBySlug(catalog, slug) {
  return allProducts(catalog).find(({ product }) => slugify(product.ProductCode) === slug) || null
}

/** The slim shape the browser needs for one product. */
export function publicProduct(product, category) {
  return {
    name: String(product.ProductCode).replace(/\s+/g, ' ').trim(),
    slug: slugify(product.ProductCode),
    category,
    sku: product.SKU || '',
    price: priceNumber(product.Price),
    unit: product.Unit || 'KG',
    min: Number(product['Minimum Quantity']) || 1,
    availability: product.Availability || 'Now',
    dimensions: product.Product_Dimensions || '',
    details: asArray(product.Additional_Details).map((d) => String(d).trim()).filter(Boolean),
    images: asArray(product.Image_Link).filter(Boolean),
    variantId: product.ZohoVariantId || '',
  }
}

const AVAILABILITY_SCHEMA = {
  now: 'https://schema.org/InStock',
  'on request': 'https://schema.org/PreOrder',
  notify: 'https://schema.org/OutOfStock',
}

export function renderProductPage(template, catalog, slug) {
  const found = findBySlug(catalog, slug)
  if (!found) return null
  const p = publicProduct(found.product, found.category)
  const site = SITE_URL()
  const url = `${site}/product/${p.slug}`
  const abs = (src) => (/^https?:/i.test(src) ? src : `${site}${src.startsWith('/') ? '' : '/'}${src}`)
  const images = p.images.map(abs)

  const title = `${p.name} | Arambhika`
  const parts = [
    `${p.name}${p.sku ? ` (SKU ${p.sku})` : ''} from Arambhika, a lithium battery component manufacturer and supplier in India.`,
    p.price ? `Rs ${p.price} per ${p.unit}.` : '',
    `Minimum order ${p.min} ${p.unit}.`,
    'GST invoice and delivery across India.',
  ]
  const description = parts.filter(Boolean).join(' ').slice(0, 300)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    sku: p.sku || undefined,
    category: p.category || undefined,
    description,
    image: images.length ? images : undefined,
    brand: { '@type': 'Brand', name: 'Arambhika' },
    offers: p.price
      ? {
          '@type': 'Offer',
          url,
          priceCurrency: 'INR',
          price: String(p.price),
          availability: AVAILABILITY_SCHEMA[p.availability.toLowerCase()] || 'https://schema.org/InStock',
          seller: { '@type': 'Organization', name: 'Arambhika' },
        }
      : undefined,
  }

  const head = `<title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(url)}" />
  <meta property="og:type" content="product" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(url)}" />
  ${images[0] ? `<meta property="og:image" content="${esc(images[0])}" />` : `<meta property="og:image" content="${esc(site)}/assets/logo.png" />`}
  <script type="application/ld+json">${jsonForScript(jsonLd)}</script>`

  // Plain-HTML version of the essentials, replaced by product.js once it runs.
  const ssr = `<nav class="pp-crumbs" aria-label="Breadcrumb"><a href="/">Store</a> &rsaquo; ${esc(p.category)} &rsaquo; ${esc(p.name)}</nav>
      <h1 class="pp-title">${esc(p.name)}</h1>
      ${p.price ? `<p class="pp-price">&#8377;${esc(p.price)} <small>per ${esc(p.unit)}</small></p>` : ''}
      <p>Minimum order ${esc(p.min)} ${esc(p.unit)}.</p>
      ${p.dimensions ? `<p>${esc(p.dimensions)}</p>` : ''}
      ${p.details.length ? `<ul>${p.details.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}`

  const related = allProducts(catalog)
    .filter((x) => x.category === found.category && slugify(x.product.ProductCode) !== slug)
    .slice(0, 12)
    .map((x) => publicProduct(x.product, x.category))

  const data = `<script>window.__PRODUCT__=${jsonForScript(p)};window.__RELATED__=${jsonForScript(related)};</script>`

  return template
    .replace('<!--SEO_HEAD-->', () => head)
    .replace('<!--PRODUCT_SSR-->', () => ssr)
    .replace('<!--PRODUCT_DATA-->', () => data)
}

export function renderProductSitemap(catalog) {
  const site = SITE_URL()
  const urls = allProducts(catalog).map(({ product }) => {
    const images = asArray(product.Image_Link).filter(Boolean)
    const loc = `${site}/product/${slugify(product.ProductCode)}`
    const imageTags = images
      .slice(0, 5)
      .map((src) => `<image:image><image:loc>${esc(/^https?:/i.test(src) ? src : site + src)}</image:loc></image:image>`)
      .join('')
    return `  <url><loc>${esc(loc)}</loc>${imageTags}</url>`
  })
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>
`
}
