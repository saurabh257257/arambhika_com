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
    const product = blocks.find((b) => b['@type'] === 'Product')
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
    assert.match(home, /<h1>Lithium Battery Component B2B Manufacturer and Supplier<\/h1>/)
  })

  test('there is no banner: the title is one slim line above the categories', () => {
    assert.doesNotMatch(home, /home-hero|heroThumbs|hero-btn/)
    assert.match(home, /<section id="home" class="home-title"/)
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
