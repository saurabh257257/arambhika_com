// Guides and FAQ: collapsed on the home page, and five of each under every product (also collapsed).

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startApp } from '../test-helpers/server.js'
import { blogIndex, guidesFor, faqsFor } from '../lib/product-extras.js'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

describe('the home page keeps its guides and FAQ closed', () => {
  const home = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8')
  test('both are details elements with no open attribute, so nothing shows until asked for', () => {
    assert.match(home, /<details class="home-fold" id="blogFold">/)
    assert.match(home, /<details class="home-fold" id="faqFold">/)
    assert.equal((home.match(/<details class="home-fold"[^>]*\sopen/g) || []).length, 0)
    assert.equal(home.split('<details class="home-fold"').length - 1, home.split('</details>').length - 1, 'every details is closed again')
  })
  test('a link to #blog or #faq opens the one it points at', () => {
    const js = fs.readFileSync(path.join(ROOT, 'public', 'script.js'), 'utf8')
    assert.match(js, /blogFold/)
    assert.match(js, /faqFold/)
    assert.match(js, /hashchange/)
  })
})

describe('five guides and five questions under every product', () => {
  test('the product page has both, collapsed, plus FAQ markup for search engines', async () => {
    const app = await startApp()
    try {
      const c = app.newClient()
      const r = await c.get('/product/nickel-strip-plated-1p-8x0-15-mm')
      assert.equal(r.status, 200)
      assert.equal((r.text.match(/<details class="pp-fold"[^>]*>/g) || []).length, 2)
      assert.equal((r.text.match(/<details class="pp-fold"[^>]*\sopen/g) || []).length, 0, 'both start closed')
      assert.equal((r.text.match(/<li><a href="\/blog\/[^"]+">/g) || []).length, 5, 'five guides')
      assert.equal((r.text.match(/class="pp-faq-item"/g) || []).length, 5, 'five questions')
      const ld = JSON.parse(r.text.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])
      const faq = ld['@graph'].find((x) => x['@type'] === 'FAQPage')
      assert.equal(faq.mainEntity.length, 5)
      assert.ok(faq.mainEntity.every((q) => q.name && q.acceptedAnswer.text))
      // the browser script draws the same two sections from the data written into the page
      assert.match(r.text, /window\.__PRODUCT__=/)
      assert.match(r.text, /"guides":\[/)
      assert.match(r.text, /"faqs":\[/)
    } finally { await app.stop() }
  })
})

describe('picking the guides and writing the questions', () => {
  test('every blog post is indexed with a title and address', () => {
    const posts = blogIndex()
    assert.ok(posts.length >= 80)
    assert.ok(posts.every((p) => p.title && p.url.startsWith('/blog/')))
  })

  test('always five different guides, with the matching subject first', () => {
    const bms = guidesFor({ name: 'DALY LFP 8S-20AMP HARDWARE BMS', category: 'BMS' })
    assert.equal(bms.length, 5)
    assert.equal(new Set(bms.map((g) => g.url)).size, 5)
    assert.match(bms[0].title, /bms/i)
    const strip = guidesFor({ name: 'Nickel Strip Plated 1P 8x0.15 mm', category: 'Nickel Strip Plated' })
    assert.match(strip[0].title, /nickel/i)
    const odd = guidesFor({ name: 'Something unrelated entirely', category: 'Misc' })
    assert.equal(odd.length, 5, 'even an unknown product gets five')
  })

  test('words are matched whole: "red" is not found inside "compared", and "Highstar" is not HST', () => {
    const wire = guidesFor({ name: 'Silicone Wire 10AWG Red', category: 'Silicone Wire' }, [
      { slug: 'cells-compared', url: '/blog/cells-compared.html', title: 'Cells Compared', description: '', keywords: '' },
      { slug: 'red-silicone-wire', url: '/blog/red-silicone-wire.html', title: 'Red Silicone Wire', description: '', keywords: '' },
    ])
    assert.equal(wire[0].url, '/blog/red-silicone-wire.html')
    const cell = faqsFor({ name: 'Highstar LFP Cell 3.2V 314Ah Laser Welding', category: 'Prismatic Cells', unit: 'pcs', min: 100, price: 6349 })
    assert.match(cell[0].a, /lithium cell/i)
    assert.doesNotMatch(cell[0].a, /heat shrink/i)
  })

  test('the five questions use the product\'s own price, minimum order and unit, and only claim what we know', () => {
    const f = faqsFor({ name: 'Nickel Strip Plated 1P 8x0.15 mm', category: 'Nickel Strip Plated', unit: 'KG', min: 4, price: 480 })
    assert.equal(f.length, 5)
    assert.match(f[1].a, /spot welding/)
    assert.match(f[2].a, /minimum order is 4 KG/)
    assert.match(f[2].a, /₹480 per KG/)
    assert.match(faqsFor({ name: 'Nickel Strip Plated 1P 8x0.30 mm', category: 'Nickel Strip Plated', unit: 'KG', min: 4 })[1].a, /laser welding/)
    assert.match(faqsFor({ name: 'DALY LFP 8S-20AMP HARDWARE BMS', category: 'BMS', unit: 'pcs', min: 1 })[2].a, /on request/)
    assert.match(faqsFor({ name: 'DALY LFP 8S-20AMP HARDWARE BMS', category: 'BMS', unit: 'pcs', min: 1 })[1].q, /choose the right BMS/)
  })
})
