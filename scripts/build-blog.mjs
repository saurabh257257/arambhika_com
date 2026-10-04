// Generates the static blog pages in public/blog/ (static HTML so search engines index the full text).
// Header and footer are lifted from public/index.html so they never drift from the main site.
// Run: node scripts/build-blog.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { posts as materialPosts, guides } from './blog-content.mjs'
import { posts as howtoPosts } from './blog-content-howto.mjs'

const posts = [...materialPosts, ...howtoPosts]

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')
const OUT = path.join(ROOT, 'blog')
const SITE = 'https://www.arambhikaenablers.in' // same canonical host as the rest of the site
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

const header = absolutize(grab(/<header class="site-header">[\s\S]*?<\/header>/))
const footer = absolutize(grab(/<footer class="site-footer">[\s\S]*?<\/footer>/))

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const productLink = (name) => `/?product=${encodeURIComponent(name)}#catalog`

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
          <div class="blog-tile-img"><img src="${p.heroImage}" alt="${esc(p.imageAlt)}" loading="lazy" /></div>
          <div class="blog-tile-body"><span class="blog-tag">${esc(p.tag)}</span><h3>${esc(p.title)}</h3><span class="blog-more">Read blog &rarr;</span></div>
        </a>`).join('')

  const faq = post.faq.map(([q, a]) => `
      <details><summary>${esc(q)}</summary><p>${a}</p></details>`).join('')

  return `${baseHead({ title: post.metaTitle, description: post.description, keywords: post.keywords, url, image, type: 'article', jsonld })}
<body class="blog-page">
  ${header}
  <main>
    <article class="blog-article">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/blog/">Blog</a> &rsaquo; <span>${esc(post.tag)}</span></nav>
      <p class="blog-tag">${esc(post.tag)}</p>
      <h1>${esc(post.title)}</h1>
      <p class="blog-meta">By Arambhika &middot; <time datetime="${post.date}">${post.dateLabel}</time> &middot; ${post.readTime} min read</p>
      <figure class="blog-hero"><img src="${post.heroImage}" alt="${esc(post.imageAlt)}" width="720" height="480" /></figure>
      <p class="blog-intro">${post.intro}</p>
      ${post.body}

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
        <h2>Frequently asked questions</h2>${faq}
      </section>

      <section class="blog-related">
        <h2>More from the Arambhika blog</h2>
        <div class="blog-tiles">${related}
        </div>
      </section>
    </article>
  </main>
  ${footer}
  <script src="/blog/blog.js" defer></script>
</body>
</html>
`
}

function renderIndex(all) {
  const url = `${SITE}/blog/`
  const title = 'Arambhika Blog | Nickel Strip, Copper Busbar & Battery Pack Guides for India'
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
          <div class="blog-tile-img"><img src="${p.heroImage}" alt="${esc(p.imageAlt)}" loading="lazy" /></div>
          <div class="blog-tile-body"><span class="blog-tag">${esc(p.tag)}</span><h3>${esc(p.title)}</h3><p>${esc(p.teaser)}</p><span class="blog-more">Read blog &rarr;</span></div>
        </a>`).join('')
  // Older guides live at their original URLs (kept for SEO) but are listed as ordinary blog tiles.
  const guideTiles = guides.map((g) => `
        <a class="blog-tile" href="${g.href}">
          <div class="blog-tile-img"><img src="${g.heroImage}" alt="${esc(g.imageAlt)}" loading="lazy" /></div>
          <div class="blog-tile-body"><span class="blog-tag">${esc(g.tag)}</span><h3>${esc(g.title)}</h3><p>${esc(g.text)}</p><span class="blog-more">Read guide &rarr;</span></div>
        </a>`).join('')

  return `${baseHead({ title, description, keywords: 'nickel strip blog India, battery pack guide India, copper busbar guide, 18650 nickel strip India, EV battery components India', url, image: `${SITE}/assets/logo.png`, type: 'website', jsonld })}
<body class="blog-page">
  ${header}
  <main>
    <section class="blog-article blog-landing">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <span>Blog</span></nav>
      <p class="blog-tag">Arambhika Blog</p>
      <h1>Battery pack materials, explained for Indian makers</h1>
      <p class="blog-intro">One guide for each material we sell, written for e-bike, e-rickshaw, inverter and solar storage builders across India. Each guide links straight to the products with live stock and price.</p>
      <div class="blog-tiles blog-tiles-lg">${tiles}${guideTiles}
      </div>
    </section>
  </main>
  ${footer}
  <script src="/blog/blog.js" defer></script>
</body>
</html>
`
}

// Home page: refresh the featured blog tiles between the markers in index.html.
const BOOK_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-1px;margin-right:4px"><path d="M4 19.5V5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M8 7h6M8 11h6"/></svg>'
const homeTile = (p) => `
          <a class="blog-tile" href="/blog/${p.slug}.html">
            <div class="blog-tile-img"><img src="${p.heroImage}" alt="${esc(p.imageAlt)}" loading="lazy" /></div>
            <div class="blog-tile-body"><span class="blog-tag">${BOOK_ICON}Blog &middot; ${esc(p.tag)}</span><h3>${esc(p.title)}</h3><p>${esc(p.teaser)}</p><span class="blog-more">Read blog &rarr;</span></div>
          </a>`
const homeHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
fs.writeFileSync(path.join(ROOT, 'index.html'), homeHtml.replace(
  /<!-- blog-tiles:start -->[\s\S]*?<!-- blog-tiles:end -->/,
  () => `<!-- blog-tiles:start -->${posts.filter((p) => p.featured).map(homeTile).join('')}\n        <!-- blog-tiles:end -->`,
))

fs.mkdirSync(OUT, { recursive: true })
for (const post of posts) {
  fs.writeFileSync(path.join(OUT, `${post.slug}.html`), renderPost(post, posts))
}
fs.writeFileSync(path.join(OUT, 'index.html'), renderIndex(posts))

// Sitemap: keep it in step with the blog pages.
const sitemapPath = path.join(ROOT, 'sitemap.xml')
let sitemap = fs.readFileSync(sitemapPath, 'utf8')
sitemap = sitemap.replace(/\s*<url>\s*<loc>[^<]*\/blog\/[^<]*<\/loc>[\s\S]*?<\/url>/g, '')
const entries = [`${SITE}/blog/`, ...posts.map((p) => `${SITE}/blog/${p.slug}.html`)].map((loc, i) => `  <url>
    <loc>${loc}</loc>
    <changefreq>${i ? 'monthly' : 'weekly'}</changefreq>
    <priority>${i ? '0.7' : '0.8'}</priority>
  </url>`).join('\n')
sitemap = sitemap.replace('</urlset>', `${entries}\n</urlset>`)
fs.writeFileSync(sitemapPath, sitemap)

console.log(`Wrote ${posts.length + 1} blog pages and updated sitemap.xml`)
