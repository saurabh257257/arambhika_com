// Generates the static blog pages in public/blog/ (static HTML so search engines index the full text).
// Header and footer are lifted from public/index.html so they never drift from the main site.
// Run: node scripts/build-blog.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { posts as materialPosts, guides } from './blog-content.mjs'
import { posts as howtoPosts } from './blog-content-howto.mjs'
import { posts as morePosts } from './blog-content-more.mjs'

const posts = [...materialPosts, ...howtoPosts, ...morePosts]

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')
const OUT = path.join(ROOT, 'blog')
const SITE = 'https://www.arambhika.com' // same canonical host as the rest of the site
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')

const grab = (re) => {
  const m = index.match(re)
  if (!m) throw new Error(`index.html is missing ${re}`)
  return m[0]
}

// Make the copied header/footer work from /blog/ by making every relative link root-absolute.
const absolutize = (html) => html
  .replace(/(href|src)="(?!https?:|tel:|mailto:|#|\/|data:)([^"]*)"/g, '$1="/$2"')
  .replace(/href="#home"/g, 'href="/"')
  .replace(/href="#catalog"/g, 'href="/#catalog"')

// The home page header carries a product search and the logged-in sub-nav; blog pages have
// neither (their scripts are not loaded), so take just the logo and the Store / account links.
// the home page's tagline is its H1; on blog pages it is plain text so each page keeps a single H1
const headerPlain = (h) => h.replace(/<h1 class="brand-tag" id="brandTag">([^<]*)<\/h1>/, '<p class="brand-tag">$1</p>')
const header = absolutize(headerPlain(
  grab(/<header class="site-header[^"]*">[\s\S]*?<\/header>/)
    .replace(/<header class="site-header[^"]*">/, '<header class="site-header">')
    .replace(/<div class="header-search">[\s\S]*?<div class="search-suggestions"[^>]*><\/div>\s*<\/div>/, '')
    .replace(/<div class="acct-subnav"[\s\S]*?<\/div>\s*<\/div>/, '')
))
const footer = absolutize(grab(/<footer class="site-footer">[\s\S]*?<\/footer>/))

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const productLink = (name) => `/?product=${encodeURIComponent(name)}#catalog`

// ---- Product data: every blog image is a photo of a product the post links to ----
async function loadCatalog() {
  const base = (process.env.CATALOG_URL || 'https://www.arambhika.com').replace(/\/+$/, '')
  try {
    const r = await fetch(base + '/products.json', { signal: AbortSignal.timeout(20000) })
    if (r.ok) return await r.json()
  } catch { /* fall back to the saved snapshot below */ }
  const snap = path.join(ROOT, '..', 'data', 'snapshot.json')
  if (fs.existsSync(snap)) return JSON.parse(fs.readFileSync(snap, 'utf8')).data
  throw new Error('Cannot load the product catalogue (live site and data/snapshot.json both unavailable)')
}
const catalog = await loadCatalog()
const norm = (v) => String(v || '').toLowerCase().replace(/\u00d7/g, 'x').replace(/[^a-z0-9.]+/g, ' ').trim()
const slugOf = (v) => String(v || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const byName = new Map()
const byCategory = new Map()
for (const c of catalog.categories || []) {
  for (const pr of c.products || []) {
    if (!pr.ProductCode || pr.ProductCode.trim().length < 2) continue
    const item = { name: pr.ProductCode, url: '/product/' + slugOf(pr.ProductCode), image: (pr.Image_Link || []).find(Boolean) || '', price: pr.Price, unit: pr.Unit, category: c.name }
    byName.set(norm(pr.ProductCode), item)
    if (!byCategory.has(c.name)) byCategory.set(c.name, [])
    byCategory.get(c.name).push(item)
  }
}
const firstWithPhoto = (cat) => (byCategory.get(cat) || []).find((x) => x.image)

// Punchy headlines for the cards and the page; the long titles stay in <title> for search.
const SHORT = {
  'nickel-plated-strip-ev-battery-packs-india': ['Nickel-Plated Strip, Explained', 'Sizes, uses and what to buy for EV packs'],
  'pure-nickel-strip-lithium-battery-packs-india': ['Pure Nickel Strip for High-Current Packs', 'When plain nickel beats plated'],
  'copper-busbar-battery-ess-india': ['Tin-Coated Copper Busbars', 'Bolted links for EV and energy-storage packs'],
  'spot-weld-nickel-strip-18650-21700-battery-pack-guide': ['Spot-Welding Nickel Strip, Step by Step', 'Settings and tips for 18650 and 21700 cells'],
  'build-48v-lithium-battery-pack-electric-scooter-india': ['Build a 48V Scooter Battery Pack', 'Strip choice and layout, start to finish'],
  'lfp-battery-pack-solar-inverter-nickel-strip-busbar-india': ['LFP Packs for Solar and Inverters', 'Which strip and busbar to use'],
  'how-to-calculate-nickel-strip-size-battery-pack-current': ['Size Your Nickel Strip Right', 'Worked examples from pack current'],
  'battery-pack-heating-nickel-strip-weak-welds-troubleshooting': ['Why Your Battery Pack Runs Hot', 'Weak welds, thin strip and busbar fixes'],
  'nickel-strip-price-per-kg-india-plated-vs-pure': ['Nickel Strip Price per kg', 'What decides the rate: plated vs pure'],
  'e-rickshaw-e-auto-battery-pack-nickel-strip-busbar-india': ['Packs for E-Rickshaws and E-Autos', 'Strip and busbar that survive daily cycling'],
  'power-tool-cordless-battery-pack-nickel-strip-india': ['Power-Tool Battery Packs', 'Strip choices for cordless tools'],
  'ups-telecom-backup-battery-pack-copper-busbar-nickel-strip': ['UPS and Telecom Backup Packs', 'Copper busbar and nickel strip for standby power'],
  'solar-street-light-off-grid-lighting-battery-pack-nickel-strip': ['Solar Street-Light Packs', 'Reliable links for off-grid lighting'],
  'how-to-choose-nickel-strip-copper-busbar-manufacturer-india': ['Choosing a Strip and Busbar Supplier', 'What to check before you order'],
  'common-mistakes-buying-nickel-strip-bulk-india': ['Bulk Nickel Strip: Mistakes to Avoid', 'Buying lessons from real pack builders'],
}

const usedHeroes = new Set()
for (const post of posts) {
  const names = [...String(post.body).matchAll(/\/\?product=([^#"]+)#catalog/g)].map((m) => decodeURIComponent(m[1]))
  const listed = []
  for (const n of names) {
    const hit = byName.get(norm(n))
    if (hit && !listed.includes(hit)) listed.push(hit)
  }
  if (!listed.length) {
    const cat = String(post.category).split(',')[0].trim()
    for (const it of (byCategory.get(cat) || []).slice(0, 3)) listed.push(it)
  }
  const withPhoto = listed.filter((x) => x.image)
  if (!withPhoto.length) throw new Error('No product photo available for post ' + post.slug)
  post.listed = listed
  // prefer a listed product whose photo no other post has used yet, so the tiles do not all look the same
  const cats = String(post.category).split(',').map((c) => c.trim())
  const pool = [...withPhoto, ...cats.flatMap((c) => (byCategory.get(c) || []).filter((x) => x.image))]
  const hero = pool.find((x) => !usedHeroes.has(x.image)) || withPhoto[0]
  usedHeroes.add(hero.image)
  post.heroImage = hero.image
  post.heroProduct = hero
  post.imageAlt = hero.name
  if (!post.listed.includes(hero)) post.listed.unshift(hero)
  // links in the text go to the product page itself
  post.body = String(post.body).replace(/href="\/\?product=([^#"]+)#catalog"/g, (m, enc) => {
    const hit = byName.get(norm(decodeURIComponent(enc)))
    return hit ? 'href="' + hit.url + '"' : m
  })
  const [headline, sub] = SHORT[post.slug] || [post.title, post.teaser]
  post.headline = headline
  post.metaTitle = `${headline} | Arambhika Blog`.length <= 60 ? `${headline} | Arambhika Blog` : `${headline} | Arambhika`
  post.subline = sub
}
for (const g of guides) {
  const cat = /copper/i.test(g.href) ? 'Copper Bus Bar' : /plated-vs-pure/i.test(g.href) ? 'Nickel Strip Pure' : 'Nickel Strip Plated'
  const hit = firstWithPhoto(cat)
  if (!hit) throw new Error('No product photo for guide ' + g.href)
  g.heroImage = hit.image
  g.imageAlt = hit.name
}

// ---- FAQs: a question, one line of the answer, "Show more", and one page that holds them all ----
const homeFaqs = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'faq-home.json'), 'utf8'))
const faqItem = (q, a) => `<div class="faq-item"><h3 class="faq-q">${q}</h3><p class="faq-a">${a}</p><button type="button" class="faq-more" aria-expanded="false" hidden>Show more</button></div>`

const GA = `<script async src="https://www.googletagmanager.com/gtag/js?id=G-HREHJPZYC1"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-HREHJPZYC1');
  </script>`

const baseHead = ({ title, description, keywords, url, image, type, jsonld }) => `<!DOCTYPE html>
<html lang="en-IN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="keywords" content="${esc(keywords)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="${url}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:type" content="${type}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:locale" content="en_IN" />
  <meta property="og:site_name" content="Arambhika" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${image}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Poppins:wght@600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/_theme_overrides.css" />
  <link rel="stylesheet" href="/blog/blog.css" />
  <link rel="icon" type="image/png" href="/assets/favicon.png" />
  ${GA}
  <script type="application/ld+json">
${JSON.stringify(jsonld, null, 2)}
  </script>
</head>`

const ORG = {
  '@type': 'Organization',
  name: 'Arambhika',
  url: SITE,
  logo: { '@type': 'ImageObject', url: `${SITE}/assets/logo.png` },
}

function renderPost(post, all) {
  const url = `${SITE}/blog/${post.slug}.html`
  const image = `${SITE}${post.heroImage}`
  const faqLd = {
    '@type': 'FAQPage',
    mainEntity: post.faq.map(([q, a]) => ({
      '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') },
    })),
  }
  const articleLd = {
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    image,
    author: ORG,
    publisher: ORG,
    mainEntityOfPage: url,
    datePublished: post.date,
    dateModified: post.date,
    inLanguage: 'en-IN',
  }
  const crumbLd = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/blog/` },
      { '@type': 'ListItem', position: 3, name: post.title, item: url },
    ],
  }
  const jsonld = { '@context': 'https://schema.org', '@graph': [articleLd, crumbLd, faqLd] }

  const at = all.findIndex((p) => p.slug === post.slug)
  const related = [1, 2, 3].map((n) => all[(at + n) % all.length]).map((p) => `
        <a class="blog-tile" href="/blog/${p.slug}.html" data-tile-cat="${esc(p.category)}">
          <div class="blog-tile-img"><img src="${p.heroImage}?w=300" alt="${esc(p.imageAlt)}" loading="lazy" /></div>
          <div class="blog-tile-body"><span class="blog-tag">${esc(p.tag)}</span><h3>${esc(p.headline)}</h3><span class="blog-more">Read blog &rarr;</span></div>
        </a>`).join('')

  const faq = `<div class="faq-list">${post.faq.map(([q, a]) => faqItem(esc(q), a)).join('')}</div>
        <p class="faq-all"><a class="blog-btn blog-btn-ghost" href="/faq.html">See all FAQs &rarr;</a></p>`

  return `${baseHead({ title: post.metaTitle, description: post.description, keywords: post.keywords, url, image, type: 'article', jsonld })}
<body class="blog-page">
  ${header}
  <main>
    <article class="blog-article">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/blog/">Blog</a> &rsaquo; <span>${esc(post.tag)}</span></nav>
      <p class="blog-tag">${esc(post.tag)}</p>
      <h1>${esc(post.headline)}</h1>
      <p class="blog-subline">${esc(post.subline)}</p>
      <p class="blog-meta">By Arambhika &middot; <time datetime="${post.date}">${post.dateLabel}</time> &middot; ${post.readTime} min read</p>
      <figure class="blog-hero"><a href="${post.heroProduct.url}"><img src="${post.heroImage}" alt="${esc(post.imageAlt)}" width="720" height="480" /></a><figcaption>Featured product: <a href="${post.heroProduct.url}">${esc(post.heroProduct.name)}</a></figcaption></figure>
      <p class="blog-intro">${post.intro}</p>
      ${post.body}

      <section class="blog-listed" aria-label="Products in this guide">
        <h2>Products in this guide</h2>
        <div class="blog-listed-grid">${post.listed.slice(0, 6).map((x) => `
          <a class="blog-listed-card" href="${x.url}">
            <span class="blog-listed-img">${x.image ? `<img src="${x.image}?w=300" alt="${esc(x.name)}" loading="lazy" />` : ''}</span>
            <span class="blog-listed-name">${esc(x.name)}</span>
            <span class="blog-listed-price">${x.price ? '\u20B9' + Number(x.price).toLocaleString('en-IN') + ' / ' + esc(x.unit || 'KG') : 'Price on request'}</span>
          </a>`).join('')}
        </div>
      </section>

      <section class="blog-products" data-category="${esc(post.category)}" data-limit="8" aria-label="${esc(post.category)} products">
        <h2>${esc(post.productsHeading)}</h2>
        <p class="blog-products-note">Live stock and price from our store. Tap a product to add it to your quote.</p>
        <div class="blog-product-grid" id="blogProductGrid"><p class="blog-loading">Loading products&hellip;</p></div>
        <noscript><p>Browse every size on our <a href="/#catalog">product store</a>.</p></noscript>
        <p><a class="blog-btn blog-btn-ghost" href="/#catalog">View the full product store &rarr;</a></p>
      </section>

      <aside class="blog-cta">
        <div>
          <h2>${esc(post.ctaHeading)}</h2>
          <p>Share your pack design, quantity and city. We reply on WhatsApp with a quote and dispatch plan from Noida.</p>
        </div>
        <a class="blog-btn" href="https://wa.me/919315545821?text=${encodeURIComponent(post.waText)}" target="_blank" rel="noopener">Get a quote on WhatsApp</a>
      </aside>

      <section class="blog-faq">
        <h2>Frequently asked questions</h2>
        ${faq}
      </section>

      <section class="blog-related">
        <h2>More from the Arambhika blog</h2>
        <div class="blog-tiles">${related}
        </div>
      </section>
    </article>
  </main>
  ${footer}
  <script src="/request-modal.js" defer></script>
  <script src="/wishlist.js" defer></script>
  <script src="/blog/blog.js" defer></script>
</body>
</html>
`
}

function renderIndex(all) {
  const url = `${SITE}/blog/`
  const title = 'Battery Pack Guides | Arambhika Blog'
  const description = 'Practical guides for Indian battery pack makers: nickel-plated strip, pure nickel strip and copper busbars for EV, e-bike, inverter and solar storage packs. Sizes, welding tips and live prices.'
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url,
    publisher: ORG,
    inLanguage: 'en-IN',
    hasPart: [
      ...all.map((p) => ({ '@type': 'Article', headline: p.title, url: `${SITE}/blog/${p.slug}.html` })),
      ...guides.map((g) => ({ '@type': 'Article', headline: g.title, url: `${SITE}${g.href}` })),
    ],
  }
  const tiles = all.map((p) => `
        <a class="blog-tile" href="/blog/${p.slug}.html" data-tile-cat="${esc(p.category)}">
          <div class="blog-tile-img"><img src="${p.heroImage}?w=300" alt="${esc(p.imageAlt)}" loading="lazy" /></div>
          <div class="blog-tile-body"><span class="blog-tag">${esc(p.tag)}</span><h3>${esc(p.headline)}</h3><p>${esc(p.subline)}</p><span class="blog-more">Read blog &rarr;</span></div>
        </a>`).join('')
  // Older guides live at their original URLs (kept for SEO) but are listed as ordinary blog tiles.
  const guideTiles = guides.map((g) => `
        <a class="blog-tile" href="${g.href}">
          <div class="blog-tile-img"><img src="${g.heroImage}?w=300" alt="${esc(g.imageAlt)}" loading="lazy" /></div>
          <div class="blog-tile-body"><span class="blog-tag">${esc(g.tag)}</span><h3>${esc(g.title)}</h3><p>${esc(g.text)}</p><span class="blog-more">Read guide &rarr;</span></div>
        </a>`).join('')

  return `${baseHead({ title, description, keywords: 'nickel strip blog India, battery pack guide India, copper busbar guide, 18650 nickel strip India, EV battery components India', url, image: `${SITE}/assets/logo.png`, type: 'website', jsonld })}
<body class="blog-page">
  ${header}
  <main>
    <section class="blog-article blog-landing">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <span>Blog</span></nav>
      <p class="blog-tag">Arambhika Blog</p>
      <h1>Guides for battery pack makers</h1>
      <p class="blog-intro">One guide for each material we sell, written for e-bike, e-rickshaw, inverter and solar storage builders across India. Each guide links straight to the products with live stock and price.</p>
      <div class="blog-tiles blog-tiles-lg">${tiles}${guideTiles}
      </div>
    </section>
  </main>
  ${footer}
  <script src="/request-modal.js" defer></script>
  <script src="/wishlist.js" defer></script>
  <script src="/blog/blog.js" defer></script>
</body>
</html>
`
}

// Home page: refresh the featured blog tiles between the markers in index.html.
const BOOK_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-1px;margin-right:4px"><path d="M4 19.5V5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M8 7h6M8 11h6"/></svg>'
const homeTile = (p) => `
          <a class="blog-tile" href="/blog/${p.slug}.html">
            <div class="blog-tile-img"><img src="${p.heroImage}?w=300" alt="${esc(p.imageAlt)}" loading="lazy" /></div>
            <div class="blog-tile-body"><span class="blog-tag">${BOOK_ICON}Blog &middot; ${esc(p.tag)}</span><h3>${esc(p.headline)}</h3><p>${esc(p.subline)}</p><span class="blog-more">Read blog &rarr;</span></div>
          </a>`
const homeGuideTile = (g) => `
          <a class="blog-tile" href="${g.href}">
            <div class="blog-tile-img"><img src="${g.heroImage}?w=300" alt="${esc(g.imageAlt)}" loading="lazy" /></div>
            <div class="blog-tile-body"><span class="blog-tag">${BOOK_ICON}${esc(g.tag)}</span><h3>${esc(g.title)}</h3><p>${esc(g.text)}</p><span class="blog-more">Read guide &rarr;</span></div>
          </a>`
const homeHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
fs.writeFileSync(path.join(ROOT, 'index.html'), homeHtml.replace(
  /<!-- blog-tiles:start -->[\s\S]*?<!-- blog-tiles:end -->/,
  () => `<!-- blog-tiles:start -->${posts.map(homeTile).join('')}${guides.map(homeGuideTile).join('')}\n        <!-- blog-tiles:end -->`,
))

fs.mkdirSync(OUT, { recursive: true })

const homeNow = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
fs.writeFileSync(path.join(ROOT, 'index.html'), homeNow.replace(
  /<!-- faq:start -->[\s\S]*?<!-- faq:end -->/,
  () => `<!-- faq:start -->${homeFaqs.map(([q, a]) => faqItem(q, a)).join('')}<!-- faq:end -->`,
))

function renderFaqPage() {
  const url = `${SITE}/faq.html`
  const groups = [
    { title: 'Ordering, sizes and delivery', faqs: homeFaqs },
    ...posts.map((p) => ({ title: p.headline, faqs: p.faq.map(([q, a]) => [esc(q), a]) })),
  ]
  const flat = groups.flatMap((g) => g.faqs)
  const plain = (h) => String(h).replace(/<[^>]+>/g, '')
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [{
      '@type': 'FAQPage',
      mainEntity: flat.map(([q, a]) => ({ '@type': 'Question', name: plain(q), acceptedAnswer: { '@type': 'Answer', text: plain(a) } })),
    }],
  }
  const title = 'Nickel Strip & Busbar FAQs | Arambhika'
  const description = 'Every question we get about nickel strip, copper busbar, welding, sizing, pricing and ordering, answered in one place.'
  return `${baseHead({ title, description, keywords: 'nickel strip FAQ, copper busbar FAQ, battery pack questions India', url, image: `${SITE}/assets/logo.png`, type: 'website', jsonld })}
<body class="blog-page">
  ${header}
  <main>
    <section class="blog-article faq-page">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <span>FAQ</span></nav>
      <p class="blog-tag">Help centre</p>
      <h1>Frequently asked questions</h1>
      <p class="blog-subline">${flat.length} answers on strips, busbars, welding, sizing and ordering.</p>
      <input type="search" id="faqSearch" class="faq-search" placeholder="Search the FAQs..." aria-label="Search the FAQs" />
      ${groups.map((g) => `
      <section class="faq-group">
        <h2>${esc(g.title)}</h2>
        <div class="faq-list">${g.faqs.map(([q, a]) => faqItem(q, a)).join('')}</div>
      </section>`).join('')}
      <p class="faq-empty" id="faqEmpty" hidden>No question matches. <a href="https://wa.me/919315545821" target="_blank" rel="noopener">Ask us on WhatsApp</a>.</p>
    </section>
  </main>
  ${footer}
  <script src="/request-modal.js" defer></script>
  <script src="/wishlist.js" defer></script>
  <script src="/blog/blog.js" defer></script>
</body>
</html>
`
}
fs.writeFileSync(path.join(ROOT, 'faq.html'), renderFaqPage())
for (const post of posts) {
  fs.writeFileSync(path.join(OUT, `${post.slug}.html`), renderPost(post, posts))
}
fs.writeFileSync(path.join(OUT, 'index.html'), renderIndex(posts))

// Sitemap: keep it in step with the blog pages.
const sitemapPath = path.join(ROOT, 'sitemap.xml')
let sitemap = fs.readFileSync(sitemapPath, 'utf8')
sitemap = sitemap.replace(/\s*<url>\s*<loc>[^<]*\/(?:blog\/|faq\.html)[^<]*<\/loc>[\s\S]*?<\/url>/g, '')
const entries = [`${SITE}/blog/`, `${SITE}/faq.html`, ...posts.map((p) => `${SITE}/blog/${p.slug}.html`)].map((loc, i) => `  <url>
    <loc>${loc}</loc>
    <changefreq>${i ? 'monthly' : 'weekly'}</changefreq>
    <priority>${i ? '0.7' : '0.8'}</priority>
  </url>`).join('\n')
sitemap = sitemap.replace('</urlset>', `${entries}\n</urlset>`)
fs.writeFileSync(sitemapPath, sitemap)

console.log(`Wrote ${posts.length + 1} blog pages and updated sitemap.xml`)
