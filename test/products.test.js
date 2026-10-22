// Product pages (/product/<name>), the product sitemap, and the new store home markup.

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startApp } from '../test-helpers/server.js'
import { slugify, renderProductPage, findBySlug } from '../lib/product-pages.js'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'products.local.json'), 'utf8'))
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const SLUG = 'nickel-strip-plated-1p-8x0-15-mm'

describe('slugs', () => {
  test('are lowercase, dash separated and stable', () => {
    assert.equal(slugify('Nickel Strip Plated 1P 8x0.15 mm'), SLUG)
    assert.equal(slugify('  COPPER BUS BAR Universal (55x20x2mm) - Tin Coated '), 'copper-bus-bar-universal-55x20x2mm-tin-coated')
  })

  test('are unique across the catalog', () => {
    const slugs = fixture.categories.flatMap((c) => c.products.map((p) => slugify(p.ProductCode)))
    assert.equal(new Set(slugs).size, slugs.length)
  })

  test('match the slug the browser builds for the card link', () => {
    const script = read('public/script.js')
    assert.match(script, /toDomToken\(normalizeProductCode\(name\)\)/)
    assert.match(script, /\/product\/\$\{/)
  })
})

describe('/product/<slug>', () => {
  let app
  before(async () => { app = await startApp() })
  after(async () => { await app.stop() })

  const get = (p) => app.newClient().get(p)

  test('serves a real page with its own title, description and canonical link', async () => {
    const r = await get(`/product/${SLUG}`)
    assert.equal(r.status, 200)
    assert.match(r.text, /<title>Nickel Strip Plated 1P 8x0\.15 mm \| Arambhika<\/title>/)
    const desc = (r.text.match(/<meta name="description" content="([^"]*)"/) || [])[1]
    assert.ok(desc && desc.length >= 50 && desc.length <= 320, `description is ${desc?.length} characters`)
    assert.match(r.text, new RegExp(`<link rel="canonical" href="https://www\\.arambhika\\.com/product/${SLUG}"`))
    assert.equal((r.text.match(/<h1[\s>]/g) || []).length, 1)
  })

  test('has valid Product structured data with price, SKU and Zoho images', async () => {
    const r = await get(`/product/${SLUG}`)
    const blocks = [...r.text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]))
    const product = blocks.flatMap((b) => b['@graph'] || [b]).find((b) => b['@type'] === 'Product')
    assert.ok(product, 'no Product JSON-LD')
    assert.equal(product.sku, 'T-NP1')
    assert.equal(product.offers.price, '480')
    assert.equal(product.offers.priceCurrency, 'INR')
    assert.equal(product.offers.availability, 'https://schema.org/InStock')
    assert.deepEqual(product.image, ['https://www.arambhika.com/zimg/111/one.jpg', 'https://www.arambhika.com/zimg/222/two.jpg'])
  })

  test('uses Open Graph tags and the first Zoho photo as the share image', async () => {
    const r = await get(`/product/${SLUG}`)
    assert.match(r.text, /<meta property="og:image" content="https:\/\/www\.arambhika\.com\/zimg\/111\/one\.jpg"/)
    assert.match(r.text, /<meta property="og:type" content="product"/)
  })

  test('hands the page the product and its category neighbours as JSON', async () => {
    const r = await get(`/product/${SLUG}`)
    const product = JSON.parse(r.text.match(/window\.__PRODUCT__=(\{[\s\S]*?\});window\.__RELATED__/)[1])
    assert.equal(product.min, 4)
    assert.equal(product.unit, 'KG')
    assert.deepEqual(product.images.length, 2)
    const related = JSON.parse(r.text.match(/window\.__RELATED__=(\[[\s\S]*?\]);<\/script>/)[1])
    assert.ok(related.length >= 1 && related.every((x) => x.category === 'Nickel Strip Plated' && x.name !== product.name))
  })

  test('product names and details cannot inject markup', async () => {
    const slug = slugify(fixture.categories[0].products[2].ProductCode)
    const r = await get(`/product/${slug}`)
    assert.equal(r.status, 200)
    assert.ok(!r.text.includes('<script>alert(1)</script>'), 'raw script tag leaked into the page')
    assert.ok(!r.text.includes('<b>bold</b>'), 'raw tag from details leaked into the page')
  })

  test('an out-of-stock product is marked OutOfStock', async () => {
    const slug = slugify(fixture.categories[0].products[2].ProductCode)
    const r = await get(`/product/${slug}`)
    assert.match(r.text, /https:\/\/schema\.org\/OutOfStock/)
  })

  test('a product without photos falls back to the logo for sharing', async () => {
    const slug = slugify(fixture.categories[0].products[2].ProductCode)
    const r = await get(`/product/${slug}`)
    assert.match(r.text, /<meta property="og:image" content="https:\/\/www\.arambhika\.com\/assets\/logo\.png"/)
  })

  test('slug lookup ignores case', async () => {
    assert.equal((await get(`/product/${SLUG.toUpperCase()}`)).status, 200)
  })

  test('an unknown product is a 404 that search engines are told to ignore', async () => {
    const r = await get('/product/does-not-exist')
    assert.equal(r.status, 404)
    assert.match(r.headers.get('x-robots-tag') || '', /noindex/)
  })

  test('the product sitemap lists every product with its photos', async () => {
    const r = await get('/product-sitemap.xml')
    assert.equal(r.status, 200)
    assert.match(r.headers.get('content-type'), /xml/)
    const locs = [...r.text.matchAll(/<loc>(https:\/\/www\.arambhika\.com\/product\/[^<]+)<\/loc>/g)].map((m) => m[1])
    assert.equal(locs.length, 4)
    assert.ok(locs.includes(`https://www.arambhika.com/product/${SLUG}`))
    assert.match(r.text, /<image:loc>https:\/\/www\.arambhika\.com\/zimg\/111\/one\.jpg<\/image:loc>/)
  })

  test('robots.txt points at the product sitemap', () => {
    assert.match(read('public/robots.txt'), /Sitemap: https:\/\/www\.arambhika\.com\/product-sitemap\.xml/)
  })
})

describe('renderProductPage (unit)', () => {
  const template = '<head><!--SEO_HEAD--></head><main><!--PRODUCT_SSR--></main><!--PRODUCT_DATA-->'
  test('returns null for a product that is not in the catalog', () => {
    assert.equal(renderProductPage(template, fixture, 'nope'), null)
    assert.equal(findBySlug(fixture, 'nope'), null)
  })
  test('fills every placeholder', () => {
    const html = renderProductPage(template, fixture, SLUG)
    assert.ok(!/<!--(SEO_HEAD|PRODUCT_SSR|PRODUCT_DATA)-->/.test(html))
    assert.match(html, /<h1 class="pp-title">Nickel Strip Plated 1P 8x0\.15 mm<\/h1>/)
  })
})

describe('store home markup', () => {
  const home = read('public/index.html')

  test('the page title is the h1, and there is exactly one', () => {
    assert.equal((home.match(/<h1[\s>]/g) || []).length, 1)
    assert.match(home, /<h1 class="brand-tag" id="brandTag">Lithium Ion Battery B2B Component Manufacturer and Supplier<\/h1>/)
  })

  test('there is no banner and no separate title strip: the H1 is the tagline under the logo', () => {
    assert.doesNotMatch(home, /home-hero|heroThumbs|hero-btn|class="home-title"/)
  })

  test('there is no Track order anywhere in the header (orders live in the profile)', () => {
    const header = home.match(/<header class="site-header[\s\S]*?<\/header>/)[0]
    assert.doesNotMatch(header, /track\s*order/i)
  })

  test('header has the cart button and the account link, with no category strip', () => {
    assert.match(home, /id="headerCart"/)
    assert.match(home, /id="headerCartBadge"/)
    assert.doesNotMatch(home, /class="chips"/)
  })

  test('catalog has category tiles, cell-type pills and a sectioned grid', () => {
    for (const id of ['categoryFilters', 'cellPills', 'catalogGrid']) assert.match(home, new RegExp(`id="${id}"`))
    assert.match(home, /class="cat-tiles"/)
  })

  test('cards link to the product page, add live, and have no Update/Quote wording', () => {
    const script = read('public/script.js')
    assert.match(script, /class="prod-link" href="\$\{href\}"/)
    assert.match(script, /data-step/)
    assert.doesNotMatch(script, /Add to Quote/)
    assert.doesNotMatch(script, /Update cart/i)
    assert.doesNotMatch(script, /\b1P\b.*pill|photos<\/span>/)
  })

  test('categories stay on one line and scroll sideways, on every screen size', () => {
    const css = read('public/_theme_overrides.css')
    const tail = css.slice(css.lastIndexOf('categories: always one line'))
    assert.match(tail, /\.cat-tiles[^{]*\{[^}]*flex-wrap:\s*nowrap\s*!important[^}]*overflow-x:\s*auto/)
    assert.match(tail, /\.cat-tile[^{]*\{[^}]*flex:\s*0 0 auto\s*!important/)
  })

  test('phones: the header cart icon is hidden where the tab bar already has the cart', () => {
    const css = read('public/_theme_overrides.css')
    assert.match(css, /body:has\(#mobileTabbar\)\s*\.nav-cart-btn\s*\{\s*display:\s*none/)
  })

  test('product images come from Zoho only, never from local product folders', () => {
    for (const file of ['public/script.js', 'public/product.js', 'public/cart-drawer.js', 'public/checkout.js', 'lib/product-pages.js']) {
      assert.doesNotMatch(read(file), /assets\/products/, `${file} references a local product image`)
    }
  })
})

describe('product page script', () => {
  const js = read('public/product.js')
  test('quantity is the cart: no update button, live changes, below-minimum removes', () => {
    assert.doesNotMatch(js, /Update cart/i)
    assert.match(js, /below the minimum removes it/)
    assert.match(js, /the cart follows every tap/)
  })
  test('has a sticky mobile buy bar with the quantity stepper', () => {
    assert.match(js, /ppSticky/)
    assert.match(read('public/_theme_overrides.css'), /\.pp-sticky\s*\{[^}]*position:\s*fixed/)
  })
  test('shows no strip-type pill or photo-count wording', () => {
    assert.doesNotMatch(js, /\bphotos?<\/|\d+ photos/)
  })
})

describe('Zoho paging never repeats products', () => {
  test('a page that ignores the page number does not multiply the catalog', async () => {
    const { fetchAllPages } = await import('../lib/zoho.js')
    const same = { products: [{ product_id: 'a' }, { product_id: 'b' }], pagination: { has_more_page: true } }
    const items = await fetchAllPages('/products', 'products', async () => same)
    assert.equal(items.length, 2)
  })
  test('asks for page_number and follows real pages', async () => {
    const { fetchAllPages } = await import('../lib/zoho.js')
    const urls = []
    const pages = { 1: { products: [{ product_id: 'a' }], pagination: { has_more_page: true } }, 2: { products: [{ product_id: 'b' }], pagination: { has_more_page: false } } }
    const items = await fetchAllPages('/products', 'products', async (u) => { urls.push(u); return pages[u.split('=')[1]] })
    assert.deepEqual(items.map((i) => i.product_id), ['a', 'b'])
    assert.match(urls[0], /page_number=1/)
  })
})

describe('blog images come from the products they list', () => {
  const blogDir = path.join(ROOT, 'public', 'blog')
  const pages = fs.readdirSync(blogDir).filter((f) => f.endsWith('.html'))

  test('no blog page, tile or the home page uses an old local product image', () => {
    for (const f of pages) assert.doesNotMatch(fs.readFileSync(path.join(blogDir, f), 'utf8'), /assets\/products/, f)
    assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'), /assets\/products/)
  })

  test('every post has a product photo as its hero, linked to that product page', () => {
    for (const f of pages.filter((n) => n !== 'index.html')) {
      const html = fs.readFileSync(path.join(blogDir, f), 'utf8')
      assert.match(html, /<figure class="blog-hero"><a href="\/product\/[a-z0-9-]+"><img src="\/zimg\//, f)
      assert.match(html, /class="blog-listed-card" href="\/product\/[a-z0-9-]+"/, `${f} lists no products`)
    }
  })
})

describe('requesting an unavailable product', () => {
  test('the store and product pages load the request modal, and neither opens WhatsApp directly for these items', () => {
    assert.match(fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8'), /request-modal\.js/)
    assert.match(fs.readFileSync(path.join(ROOT, 'public/product.html'), 'utf8'), /request-modal\.js/)
    const product = fs.readFileSync(path.join(ROOT, 'public/product.js'), 'utf8')
    assert.match(product, /openProductRequest/)
    assert.doesNotMatch(product, /pp-btn-yellow" href="https:\/\/wa\.me/)
  })

  test('the modal asks for sign-in, then quantity and a note, before WhatsApp', () => {
    const modal = fs.readFileSync(path.join(ROOT, 'public/request-modal.js'), 'utf8')
    assert.match(modal, /api\/test-auth\/me/)
    assert.match(modal, /initOtpLogin/)
    assert.match(modal, /id="rqQty"/)
    assert.match(modal, /id="rqNote"/)
    assert.match(modal, /if \(session\) showForm\(product, session\); else showLogin\(product\)/, 'a signed-out visitor is sent to sign-in first')
  })

  test('every footer has the direct WhatsApp help button with a Call button beside it', () => {
    for (const f of ['index.html', 'about.html', 'blog/index.html', 'faq.html']) {
      const html = fs.readFileSync(path.join(ROOT, 'public', f), 'utf8')
      assert.match(html, /class="footer-wa" href="https:\/\/wa\.me\/919315545821"/, f)
      assert.match(html, /class="footer-call" href="tel:\+918112662827"/, f)
    }
  })
})

describe('Shop by cell comes from the Zoho collections', () => {
  test('the catalogue carries the collections exactly as set up in Zoho', async () => {
    const { buildCatalog } = await import('../lib/catalog.js')
    const zoho = {
      categories: [{ category_id: '1', name: 'Nickel Strip Plated', visibility: true, sub_categories: [] }],
      products: [
        { product_id: 'a', name: 'Strip 2P(18650) 26x0.15 mm', category_id: '1', variants: [{}] },
        { product_id: 'b', name: 'Strip 1P 8x0.15 mm', category_id: '1', variants: [{}] },
      ],
      collections: [{ name: '18650', handle: '18650', productIds: ['a'] }, { name: 'Empty', handle: 'e', productIds: [] }],
    }
    const out = buildCatalog(zoho, { categories: [] })
    assert.deepEqual(out.collections.map((c) => [c.name, c.products.length]), [['18650', 1]], 'empty collections are left out')
    assert.equal(out.collections[0].products[0], 'Strip 2P(18650) 26x0.15 mm')
  })

  test('without collections the catalogue has none, so an older snapshot still works', async () => {
    const { buildCatalog } = await import('../lib/catalog.js')
    const out = buildCatalog({ categories: [], products: [], collections: null }, { categories: [] })
    assert.equal(out.collections, undefined)
  })

  test('the pills are built from the collections, not invented from product names', () => {
    const js = fs.readFileSync(path.join(ROOT, 'public/script.js'), 'utf8')
    assert.match(js, /categories\.collections/)
    assert.doesNotMatch(js, /zig\s\*zag/i)
  })
})

describe('GST is shown at checkout from Zoho', () => {
  test('the checkout page asks the server for GST and shows each tax line and the total', () => {
    const js = fs.readFileSync(path.join(ROOT, 'public/checkout.js'), 'utf8')
    assert.match(js, /\/api\/checkout\/estimate/)
    assert.match(js, /estimate-preview/, 'the breakup shows before sign-in too')
    assert.match(js, /e\.taxes/)
    assert.doesNotMatch(js, /Shipping &amp; tax<\/span><span>Shown on the payment page/, 'the old "shown later" line is gone')
  })

  test('the estimate route needs a login and a complete profile, and takes its figures from Zoho', () => {
    const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8')
    assert.match(server, /app\.post\('\/api\/checkout\/estimate', express\.json\(\), testSessionRequired/)
    const lib = fs.readFileSync(path.join(ROOT, 'lib/zoho-checkout.js'), 'utf8')
    assert.match(lib, /order\.taxes/)
    assert.doesNotMatch(lib, /\* 0\.18|\/ 100 \* 18|GST_RATE/, 'no hard-coded GST rate')
  })
})

describe('shipping at checkout', () => {
  test('the token shipping charge is never shown; customers are told shipping comes on the final invoice', () => {
    const js = fs.readFileSync(path.join(ROOT, 'public/checkout.js'), 'utf8')
    assert.match(js, /Shipping is added in the final invoice/)
    assert.match(js, /totalBeforeShipping/)
    assert.doesNotMatch(js, /<span>Shipping<\/span><span>/, 'no shipping amount row')
  })
})

describe('the cart shows the tax breakup before checkout', () => {
  test('the cart drawer asks for GST and the total, and no longer says taxes come later', () => {
    const js = fs.readFileSync(path.join(ROOT, 'public/cart-drawer.js'), 'utf8')
    assert.match(js, /estimate-preview/)
    assert.match(js, /Total \(estimate\)/)
    assert.doesNotMatch(js, /Shipping and taxes are shown on the payment page/)
  })
})

describe('photo zoom on the product page', () => {
  test('each photo has a zoom button that opens a full-screen pop-up with zoom, navigation and close', () => {
    const js = fs.readFileSync(path.join(ROOT, 'public/product.js'), 'utf8')
    assert.match(js, /id="ppZoom"/)
    for (const id of ['zmIn', 'zmOut', 'zmReset', 'zmClose', 'zmPrev', 'zmNext']) assert.match(js, new RegExp(`id="${id}"`), id)
    assert.match(js, /e\.key === "Escape"/)
    assert.match(js, /role", "dialog"/)
  })
})

describe('payment hand-off, category row and phone fields', () => {
  const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8')
  test('checkout goes to Zoho in the same tab and resumes when the customer comes back', () => {
    const js = read('public/checkout.js')
    assert.match(js, /location\.assign\(r\.data\.paymentUrl\)/)
    assert.doesNotMatch(js, /window\.open\(r\.data\.paymentUrl/)
    assert.match(js, /ckPending/)
    assert.match(js, /Confirming your payment/)
    assert.match(js, /Continue to payment/)
  })
  test('the category row starts with an All tile', () => {
    assert.match(read('public/script.js'), /cat-tile-all/)
  })
  test('the mobile number box is large and 16px or more so phones do not zoom', () => {
    const css = read('public/_theme_overrides.css')
    assert.match(css, /\[data-otp-mobile\], \.otp-code-input \{[^}]*height: 52px[^}]*font-size: 17px/)
  })
  test('category circles share one top edge', () => {
    assert.match(read('public/_theme_overrides.css'), /justify-content: flex-start !important; align-self: flex-start/)
  })
})

describe('choosing a category', () => {
  test('scrolls from measured heights so the first row is never under the pinned bar', () => {
    const js = fs.readFileSync(path.join(ROOT, 'public/script.js'), 'utf8')
    assert.match(js, /const scrollToProducts = /)
    assert.match(js, /scrollToProducts\(\);/)
    assert.match(js, /setTimeout\(\(\) => go\("auto"\), 800\)/)
  })
})

describe('dashboard', () => {
  test('has a welcome banner, quick actions and recent orders, and still only three stat tiles', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public/account.html'), 'utf8')
    assert.match(html, /acct-hero-banner/)
    assert.match(html, /id="acctRecent"/)
    assert.equal((html.match(/acct-quick-card/g) || []).length, 4)
    assert.ok((html.match(/class=["'][^"']*acct-stat-card/g) || []).length <= 3)
  })
})

describe('category row arrows', () => {
  test('the row has left and right arrows and no visible scrollbar', () => {
    const js = fs.readFileSync(path.join(ROOT, 'public/script.js'), 'utf8')
    assert.match(js, /cat-arrow-/)
    assert.match(js, /Show earlier categories/)
    assert.match(fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8'), /id="catScroller"/)
    const css = fs.readFileSync(path.join(ROOT, 'public/_theme_overrides.css'), 'utf8')
    assert.match(css, /\.cat-tiles::-webkit-scrollbar \{ display: none !important; \}/)
  })
})

describe('product photos from Zoho', () => {
  test('photos listed under images (not documents) are used, and placeholders are ignored', async () => {
    const { photosFrom } = await import('../lib/zoho.js')
    const withImage = { documents: [], images: [{ id: '4027527000001101033', is_placeholder_image: false, url: '/product-images/JBD1.jpg/4027527000001101033', order: 1 }] }
    assert.deepEqual(photosFrom(withImage), [{ document_id: '4027527000001101033', name: 'JBD1.jpg', attachment_order: 1 }])
    const placeholder = { documents: [], images: [{ id: '-1', is_placeholder_image: true, url: '/zs-common/images/no-preview-image.jpg' }] }
    assert.deepEqual(photosFrom(placeholder), [])
    const docs = { documents: [{ document_id: '1', name: 'a.jpg' }], images: [] }
    assert.equal(photosFrom(docs).length, 1, 'documents still win when present')
  })
})

describe('a basket with a renamed or removed product', () => {
  test('checkout and the cart drawer tidy it instead of blocking payment', () => {
    const co = fs.readFileSync(path.join(ROOT, 'public/checkout.js'), 'utf8')
    assert.match(co, /function reconcileCart\(\)/)
    assert.match(co, /reconcileCart\(\);\n\s*renderAll\(\);/)
    assert.match(co, /removed from your cart/)
    const cd = fs.readFileSync(path.join(ROOT, 'public/cart-drawer.js'), 'utf8')
    assert.match(cd, /function tidyCart\(\)/)
    assert.match(cd, /catalogue not loaded yet/)
    assert.match(fs.readFileSync(path.join(ROOT, 'public/script.js'), 'utf8'), /variantId: product\.ZohoVariantId/)
  })
})

describe('checkout talks to Zoho on the store host', () => {
  test('so the customer is returned to the store after paying', () => {
    const src = fs.readFileSync(path.join(ROOT, 'lib/zoho-checkout.js'), 'utf8')
    assert.ok(src.includes('const BASE = () => `https://${domain()}`'))
    assert.ok(!src.includes('commerce.zoho.'))
  })
})

describe('the checkout confirmation screen', () => {
  test('hides the payment step once the order is confirmed', () => {
    const css = fs.readFileSync(path.join(ROOT, 'public/_theme_overrides.css'), 'utf8')
    assert.ok(css.includes('.ck-layout[hidden]'))
    const js = fs.readFileSync(path.join(ROOT, 'public/checkout.js'), 'utf8')
    assert.match(js, /async function done\(orderNumber\) \{\s*clearInterval\(pollTimer\);/)
  })
})
