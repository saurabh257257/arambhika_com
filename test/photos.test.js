// Product photos from the Zoho Commerce admin list: photos attached to a variant (shown as "no preview" by the public store feed) still reach the shop.

import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { fetchAdminPhotoMap, applyAdminPhotos, adminPhotos, resetAdminPhotoCache } from '../lib/zoho.js'
import { buildCatalog } from '../lib/catalog.js'

const doc = (id, file, order = 1) => ({ document_id: id, file_name: file, attachment_order: order })
const pages = (list) => async (page) => list[page - 1] || { products: [], page_context: { has_more_page: false } }

// what the admin list returns: one product with its own photo, one with the photo only on its variant, one with no photo at all
const ADMIN = [
  {
    products: [
      { product_id: '1', name: 'Strip 1P', documents: [doc('11', 'strip-a.jpeg', 1), doc('12', 'strip-b.jpeg', 2)], variants: [{ documents: [doc('11', 'strip-a.jpeg', 1)] }] },
      { product_id: '2', name: 'Highstar LFP Cell 3.2V 314Ah Laser Welding', documents: [], variants: [{ documents: [doc('780163', 'LFP4.png')] }] },
    ],
    page_context: { has_more_page: true },
  },
  {
    products: [{ product_id: '3', name: 'No photo anywhere', documents: [], variants: [{ documents: [] }] }],
    page_context: { has_more_page: false },
  },
]

describe('product photos from the admin list', () => {
  beforeEach(() => resetAdminPhotoCache())

  test('every photo of a product and of its variants is collected once, in Zoho order, across pages', async () => {
    const map = await fetchAdminPhotoMap(pages(ADMIN))
    assert.deepEqual(map.get('1').map((d) => d.document_id), ['11', '12'], 'the same photo on the product and its variant counts once')
    assert.deepEqual(map.get('2'), [{ document_id: '780163', name: 'LFP4.png', attachment_order: 1 }], 'a photo that is only on the variant is found')
    assert.deepEqual(map.get('3'), [])
  })

  test('a product whose photo is only on its variant gets that photo in the shop', async () => {
    const map = await fetchAdminPhotoMap(pages(ADMIN))
    // the public feed: a placeholder for products 2 and 3, a real photo for product 1
    const feed = [
      { product_id: '1', name: 'Strip 1P', category_id: 'c1', documents: [{ document_id: '11', name: 'strip-a.jpeg', attachment_order: 0 }], variants: [{}] },
      { product_id: '2', name: 'Highstar LFP Cell 3.2V 314Ah Laser Welding', category_id: 'c1', documents: [], variants: [{}] },
      { product_id: '3', name: 'No photo anywhere', category_id: 'c1', documents: [], variants: [{}] },
    ]
    const out = buildCatalog({ categories: [{ category_id: 'c1', name: 'Cells', visibility: true, sub_categories: [] }], products: applyAdminPhotos(feed, map) })
    const by = Object.fromEntries(out.categories[0].products.map((p) => [p.ProductCode, p.Image_Link]))
    assert.deepEqual(by['Strip 1P'], ['/zimg/11/strip-a.jpeg', '/zimg/12/strip-b.jpeg'], 'extra photos of a product come along too')
    assert.deepEqual(by['Highstar LFP Cell 3.2V 314Ah Laser Welding'], ['/zimg/780163/LFP4.png'])
    assert.deepEqual(by['No photo anywhere'], [])
  })

  test('a product the admin list does not mention keeps the photos the public feed gave it', () => {
    const feed = [{ product_id: '9', name: 'Other', documents: [{ document_id: '5', name: 'o.png' }] }]
    assert.deepEqual(applyAdminPhotos(feed, new Map()), feed)
  })

  test('when Zoho refuses (for example the connection lacks the permission) nothing breaks and there are no photos from the admin list', async () => {
    const errors = []
    const original = console.error
    console.error = (m) => errors.push(String(m))
    try {
      const map = await adminPhotos(async () => { throw new Error('You are not authorized to perform this operation') })
      assert.equal(map, null)
      assert.equal((await adminPhotos(async () => { throw new Error('You are not authorized to perform this operation') })), null)
    } finally { console.error = original }
    assert.equal(errors.length, 1, 'the reason is logged once, not every refresh')
    assert.match(errors[0], /reconnect it once at \/admin\/zoho-connect/)
  })

  test('the photo map is kept for a few minutes instead of asking Zoho every 30 seconds', async () => {
    let asked = 0
    const getPage = async (page) => { asked++; return pages(ADMIN)(page) }
    await adminPhotos(getPage)
    const first = asked
    await adminPhotos(getPage)
    assert.equal(asked, first)
  })
})
