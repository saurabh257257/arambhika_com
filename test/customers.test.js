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
