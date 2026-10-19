// Per-customer data: profiles, carts and orders must never leak between mobile numbers.

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startApp, startFakeMsg91, login } from '../test-helpers/server.js'

describe('customer profile, cart and isolation', () => {
  let app, msg91, alice, bob
  before(async () => {
    msg91 = await startFakeMsg91()
    app = await startApp({ msg91 })
    alice = await login(app, msg91, '9876511111')
    bob = await login(app, msg91, '9876522222')
  })
  after(async () => { await app.stop(); await msg91.close() })

  test('a new customer starts with no profile, cart or orders', async () => {
    assert.equal((await alice.get('/api/test-account')).json.profile, null)
    assert.deepEqual((await alice.get('/api/test-cart')).json.cart, {})
    assert.deepEqual((await alice.get('/api/test-orders')).json.orders, [])
  })

  test('saving a profile needs a first name', async () => {
    const r = await alice.post('/api/test-account', { lastName: 'Singh' })
    assert.equal(r.status, 400)
  })

  test('a saved profile is stored against the logged-in mobile, not a typed one', async () => {
    const r = await alice.post('/api/test-account', {
      firstName: 'Alice', lastName: 'Singh', email: 'alice@example.com',
      address: '1 Test Road', city: 'Noida', state: 'Uttar Pradesh', postalCode: '201301',
      phone: '1111111111', // must be ignored
    })
    assert.equal(r.status, 200)
    assert.equal(r.json.profile.phone, '9876511111')
    assert.equal(r.json.profile.firstName, 'Alice')
    const again = await alice.get('/api/test-account')
    assert.equal(again.json.profile.email, 'alice@example.com')
  })

  test('saving the profile reports the Zoho sync result without failing the save', async () => {
    const r = await alice.post('/api/test-account', { firstName: 'Alice', lastName: 'Singh' })
    assert.equal(r.status, 200)
    assert.ok(Array.isArray(r.json.zoho), 'response should list a result per Zoho app')
    for (const item of r.json.zoho) assert.ok(['skipped', 'updated', 'not_found', 'error'].includes(item.status))
  })

  test("one customer's cart, profile and orders are invisible to another", async () => {
    await alice.post('/api/test-cart', { cart: { x: { name: 'Alice item', qty: 2 } } })
    assert.deepEqual((await bob.get('/api/test-cart')).json.cart, {})
    assert.equal((await bob.get('/api/test-account')).json.profile, null)
    assert.deepEqual((await bob.get('/api/test-orders')).json.orders, [])

    await bob.post('/api/test-cart', { cart: { y: { name: 'Bob item', qty: 1 } } })
    assert.equal((await alice.get('/api/test-cart')).json.cart.x.qty, 2)
    assert.equal((await alice.get('/api/test-cart')).json.cart.y, undefined)
  })

  test('checkout is refused until the profile is complete', async () => {
    const r = await bob.post('/api/test-checkout', { items: [{ variantId: '1', qty: 1, label: 'x' }] })
    assert.equal(r.status, 400)
    assert.equal(r.json.code, 'PROFILE_INCOMPLETE')
    assert.ok(r.json.missing.includes('firstName') && r.json.missing.includes('address'))
  })

  test('another customer cannot read an order id that is not theirs', async () => {
    const r = await bob.get('/api/test-orders/local_123/invoice')
    assert.equal(r.status, 404)
  })
})

describe('favourites (wish list)', () => {
  let app, msg91, alice, bob
  before(async () => {
    msg91 = await startFakeMsg91()
    app = await startApp({ msg91 })
    alice = await login(app, msg91, '9876533333')
    bob = await login(app, msg91, '9876544444')
  })
  after(async () => { await app.stop(); await msg91.close() })

  test('a visitor who is not logged in cannot read or change a list', async () => {
    const anon = app.newClient()
    assert.equal((await anon.get('/api/wishlist')).status, 401)
    assert.equal((await anon.post('/api/wishlist', { name: 'Nickel Strip', saved: true })).status, 401)
  })

  test('a new customer starts with an empty list', async () => {
    assert.deepEqual((await alice.get('/api/wishlist')).json.items, [])
  })

  test('saving adds the product once, newest first, and removing takes it off', async () => {
    await alice.post('/api/wishlist', { name: 'Strip A', variantId: '111', saved: true })
    await alice.post('/api/wishlist', { name: 'Strip A', variantId: '111', saved: true }) // tapping twice does not duplicate
    const two = await alice.post('/api/wishlist', { name: 'Strip B', variantId: '222', saved: true })
    assert.deepEqual(two.json.items.map((i) => i.name), ['Strip B', 'Strip A'])
    const after = await alice.post('/api/wishlist', { name: 'Strip A', saved: false })
    assert.deepEqual(after.json.items.map((i) => i.name), ['Strip B'])
    assert.deepEqual((await alice.get('/api/wishlist')).json.items.map((i) => i.name), ['Strip B'], 'it is still there on the next visit')
  })

  test('each customer sees only their own list', async () => {
    assert.deepEqual((await bob.get('/api/wishlist')).json.items, [])
    await bob.post('/api/wishlist', { name: 'Bob only', saved: true })
    assert.ok(!(await alice.get('/api/wishlist')).json.items.some((i) => i.name === 'Bob only'))
  })

  test('bad input is refused', async () => {
    assert.equal((await alice.post('/api/wishlist', { saved: true })).status, 400)
    assert.equal((await alice.post('/api/wishlist', { name: 'x'.repeat(300), saved: true })).status, 400)
    assert.equal((await alice.post('/api/wishlist', { name: 'Ok', variantId: 'not-a-number', saved: true })).status, 400)
  })
})
