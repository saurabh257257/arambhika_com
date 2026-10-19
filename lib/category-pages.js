// Category pages: /category/<handle>. Built on the server from the live catalogue, so a new, renamed or
// hidden category in Zoho Commerce shows up here within the 30-second refresh. The address uses Zoho's own
// category handle, which does not change when the category is renamed.

import { slugify, allProducts, publicProduct, SITE_URL } from './product-pages.js'

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const jsonForScript = (obj) =>
  JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')

export const categorySlug = (category) => slugify(category.Handle || category.name || category.Category)

export function listCategories(catalog) {
  return (catalog?.categories || [])
    .map((c) => ({ name: c.name || c.Category || '', slug: categorySlug(c), image: c.Image || '', products: allProducts({ categories: [c] }) }))
    .filter((c) => c.name && c.products.length)
}

export function findCategory(catalog, slug) {
  return listCategories(catalog).find((c) => c.slug === slug) || null
}

const sized = (src, w) => (/^\/zimg\//.test(src) ? `${src}?w=${w}` : src)

export function productCardHtml(p) {
  const img = p.images[0]
  const price = p.price ? `&#8377;${esc(p.price.toLocaleString('en-IN'))} <small>/ ${esc(p.unit)} &middot; MOQ ${esc(p.min)}</small>` : 'Price on request'
  return `<div class="prod-card">
      <a class="prod-link" href="/product/${esc(p.slug)}" aria-label="${esc(p.name)}">
        <span class="prod-img">${img ? `<img src="${esc(sized(img, 400))}" alt="${esc(p.name)}" width="400" height="400" loading="lazy" decoding="async" />` : ''}</span>
        <span class="prod-name">${esc(p.name)}</span>
      </a>
      <div class="prod-price">${price}</div>
      <div class="prod-action"><a class="prod-btn" href="/product/${esc(p.slug)}">View details</a></div>
    </div>`
}

export function renderCategoryPage(template, catalog, slug) {
  const all = listCategories(catalog)
  const cat = all.find((c) => c.slug === slug)
  if (!cat) return null
  const site = SITE_URL()
  const url = `${site}/category/${cat.slug}`
  const items = cat.products.map(({ product, category }) => publicProduct(product, category))
  const title = `${cat.name} Supplier in India | Arambhika`
  const description = `${cat.name}: ${items.length} product${items.length === 1 ? '' : 's'} from Arambhika, a lithium battery component manufacturer and supplier in India. GST invoice and delivery across India.`.slice(0, 300)
  const abs = (src) => (/^https?:/i.test(src) ? src : `${site}${src.startsWith('/') ? '' : '/'}${src}`)
  const ogImage = items.find((p) => p.images[0])?.images[0]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: cat.name,
        url,
        description,
        isPartOf: { '@type': 'WebSite', name: 'Arambhika', url: site },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: items.length,
          itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${site}/product/${p.slug}`, name: p.name })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Store', item: `${site}/` },
          { '@type': 'ListItem', position: 2, name: cat.name, item: url },
        ],
      },
    ],
  }

  const head = `<title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(url)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(url)}" />
  <meta property="og:image" content="${esc(ogImage ? abs(ogImage) : site + '/assets/logo.png')}" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${jsonForScript(jsonLd)}</script>`

  const others = all.filter((c) => c.slug !== cat.slug)
  const main = `<nav class="pp-crumbs" aria-label="Breadcrumb"><a href="/">Store</a> &rsaquo; ${esc(cat.name)}</nav>
      <h1 class="cp-title">${esc(cat.name)}</h1>
      <p class="cp-intro">${items.length} product${items.length === 1 ? '' : 's'} from Arambhika, a lithium battery component manufacturer and supplier in India. Prices are per ${esc(items[0]?.unit || 'KG')} with GST invoiced separately. Order online or ask us for a bulk quote on WhatsApp.</p>
      <div class="cat-grid cp-grid">${items.map(productCardHtml).join('\n')}</div>
      ${others.length ? `<nav class="cp-others" aria-label="Other categories"><h2>More categories</h2>${others.map((c) => `<a href="/category/${esc(c.slug)}">${esc(c.name)}</a>`).join('')}</nav>` : ''}`

  return template.replace('<!--SEO_HEAD-->', () => head).replace('<!--PAGE_MAIN-->', () => main)
}

/** A compact, plain-HTML list of every category and product for the home page, so crawlers that do not
 *  run JavaScript (and people with it blocked) can still follow a link to each one. */
export function renderBrowseList(catalog) {
  const cats = listCategories(catalog)
  if (!cats.length) return ''
  return cats
    .map(
      (c) => `<div class="seo-browse-group"><h3><a href="/category/${esc(c.slug)}">${esc(c.name)}</a> <small>(${c.products.length})</small></h3><ul>${c.products
        .map(({ product }) => `<li><a href="/product/${esc(slugify(product.ProductCode))}">${esc(String(product.ProductCode).replace(/\s+/g, ' ').trim())}</a></li>`)
        .join('')}</ul></div>`,
    )
    .join('')
}
