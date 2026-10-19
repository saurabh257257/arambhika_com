// Sign-up wizard rules: what is required, how progress is counted, GST handling, and the gate in
// front of checkout.

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startApp, startFakeMsg91, login } from '../test-helpers/server.js'
import { validateGstin, verifyGstin } from '../lib/gst.js'
import { profileStatus } from '../lib/profile-status.js'
import { findState, selectableStates, isValidPostalCode, isValidEmail } from '../lib/india.js'

const VALID_GSTIN = '27AAPFU0939F1ZV'

describe('profileStatus (progress and what blocks an order)', () => {
  test('a brand-new customer is at 25% and cannot order', () => {
    const s = profileStatus(null)
    assert.equal(s.percent, 25)
    assert.equal(s.complete, false)
    assert.equal(s.nextStep, 'details')
    assert.deepEqual(s.missing, ['firstName', 'lastName', 'email', 'address', 'state', 'city', 'postalCode'])
  })

  test('first name, last name and email are all required for the details step', () => {
    const noLast = profileStatus({ firstName: 'Asha', email: 'asha@example.com' })
    assert.equal(noLast.steps.find((x) => x.id === 'details').done, false)
    assert.ok(noLast.missing.includes('lastName'))
    const all = profileStatus({ firstName: 'Asha', lastName: 'Rao', email: 'asha@example.com' })
    assert.equal(all.steps.find((x) => x.id === 'details').done, true)
    assert.equal(all.percent, 50)
  })

  test('details and address together allow ordering, at 75% until GST is answered', () => {
    const s = profileStatus({
      firstName: 'Asha', lastName: 'Rao', email: 'asha@example.com',
      address: '1 Test Road', city: 'Noida', state: 'Uttar Pradesh', postalCode: '201301',
    })
    assert.equal(s.complete, true)
    assert.equal(s.percent, 75)
    assert.equal(s.nextStep, 'gst')
  })

  test('answering "no GST" completes the profile at 100%', () => {
    const s = profileStatus({
      firstName: 'Asha', lastName: 'Rao', email: 'asha@example.com', hasGst: false,
      address: '1 Test Road', city: 'Noida', state: 'Uttar Pradesh', postalCode: '201301',
    })
    assert.equal(s.percent, 100)
    assert.equal(s.nextStep, null)
  })

  test('ticking "I have GST" without a verified number blocks ordering', () => {
    const s = profileStatus({
      firstName: 'Asha', lastName: 'Rao', email: 'asha@example.com', hasGst: true,
      address: '1 Test Road', city: 'Noida', state: 'Uttar Pradesh', postalCode: '201301',
    })
    assert.equal(s.complete, false)
    assert.deepEqual(s.missing, ['gstin'])
  })

  test('a state that is not on the list does not count as an address', () => {
    const s = profileStatus({ firstName: 'A', lastName: 'B', email: 'a@b.co', address: 'x', city: 'y', state: 'Narnia', postalCode: '201301' })
    assert.equal(s.complete, false)
    assert.ok(s.missing.includes('state'))
  })
})

describe('India helpers', () => {
  test('state lookup ignores case and offers the union territories except the merged one', () => {
    assert.equal(findState('uttar pradesh').name, 'Uttar Pradesh')
    assert.equal(findState('Atlantis'), null)
    const names = selectableStates().map((s) => s.name)
    assert.ok(names.includes('Delhi') && names.includes('Ladakh'))
    assert.ok(!names.includes('Dadra and Nagar Haveli and Daman and Diu'))
    assert.equal(names.length, 35)
  })

  test('PIN codes are six digits and cannot start with 0', () => {
    assert.equal(isValidPostalCode('201301'), true)
    for (const bad of ['20130', '2013011', '012345', 'abc123', '']) assert.equal(isValidPostalCode(bad), false, bad)
  })

  test('email check', () => {
    assert.equal(isValidEmail('a@b.co'), true)
    for (const bad of ['', 'a', 'a@b', 'a b@c.com']) assert.equal(isValidEmail(bad), false, bad)
  })
})

describe('GSTIN validation', () => {
  test('accepts a well-formed number, in any case and with spaces', () => {
    const r = validateGstin(' 27aapfu0939f1zv ')
    assert.equal(r.ok, true)
    assert.equal(r.gstin, VALID_GSTIN)
    assert.equal(r.state, 'Maharashtra')
  })

  test('rejects wrong length, bad pattern, unknown state and a wrong check digit', () => {
    assert.equal(validateGstin('').ok, false)
    assert.equal(validateGstin('27AAPFU0939F1Z').ok, false)
    assert.equal(validateGstin('27AAPFU0939F1AV').ok, false)
    assert.equal(validateGstin('99AAPFU0939F1ZV').ok, false)
    assert.equal(validateGstin('27AAPFU0939F1ZX').ok, false)
  })

  test('without a provider a valid number is accepted as format-checked only', async () => {
    delete process.env.GST_PROVIDER
    delete process.env.GST_API_KEY
    const r = await verifyGstin(VALID_GSTIN)
    assert.equal(r.ok, true)
    assert.equal(r.verified, 'format')
  })

  describe('with a provider configured', () => {
    const real = globalThis.fetch
    before(() => { process.env.GST_PROVIDER = 'appyflow'; process.env.GST_API_KEY = 'k' })
    after(() => { globalThis.fetch = real; delete process.env.GST_PROVIDER; delete process.env.GST_API_KEY })
    const reply = (obj) => { globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => obj }) }

    test('a registered, active number is verified and brings back the legal name', async () => {
      reply({ error: false, taxpayerInfo: { lgnm: 'ABC PRIVATE LIMITED', tradeNam: 'ABC', sts: 'Active' } })
      const r = await verifyGstin(VALID_GSTIN)
      assert.deepEqual([r.ok, r.verified, r.legalName], [true, 'verified', 'ABC PRIVATE LIMITED'])
    })

    test('a number the portal does not know is rejected', async () => {
      reply({ error: true, message: 'GSTIN not found' })
      const r = await verifyGstin(VALID_GSTIN)
      assert.equal(r.ok, false)
      assert.match(r.message, /not found/i)
    })

    test('a cancelled registration is rejected', async () => {
      reply({ error: false, taxpayerInfo: { lgnm: 'X', sts: 'Cancelled' } })
      const r = await verifyGstin(VALID_GSTIN)
      assert.equal(r.ok, false)
    })

    test('a provider outage or quota error does not wrongly reject a valid number', async () => {
      reply({ error: true, message: 'Daily limit exceeded' })
      const r = await verifyGstin(VALID_GSTIN)
      assert.equal(r.ok, true)
      assert.equal(r.verified, 'format')
      globalThis.fetch = async () => { throw new Error('network down') }
      assert.equal((await verifyGstin(VALID_GSTIN)).ok, true)
    })
  })
})

describe('sign-up API', () => {
  let app, msg91, c
  before(async () => {
    msg91 = await startFakeMsg91()
    app = await startApp({ msg91 })
    c = await login(app, msg91, '9876533333')
  })
  after(async () => { await app.stop(); await msg91.close() })

  const full = {
    firstName: 'Asha', lastName: 'Rao', email: 'asha@example.com',
    address: '12 Park Street', city: 'Noida', state: 'Uttar Pradesh', postalCode: '201301',
  }

  test('the state list is public and excludes the unconfirmed union territory', async () => {
    const r = await app.newClient().get('/api/meta/states')
    assert.equal(r.status, 200)
    assert.equal(r.json.states.length, 35)
    assert.equal(r.json.gstLookup, false)
  })

  test('a new customer starts at 25% with a details next step', async () => {
    const r = await c.get('/api/test-account')
    assert.equal(r.json.status.percent, 25)
    assert.equal(r.json.status.nextStep, 'details')
  })

  test('step 2 saves on its own and moves progress to 50%', async () => {
    const r = await c.post('/api/test-account', { firstName: 'Asha', lastName: 'Rao', email: 'asha@example.com' })
    assert.equal(r.status, 200)
    assert.equal(r.json.status.percent, 50)
    assert.equal(r.json.status.nextStep, 'address')
  })

  test('a later save does not wipe fields it did not send', async () => {
    await c.post('/api/test-account', { address: '12 Park Street', city: 'Noida', state: 'Uttar Pradesh', postalCode: '201301' })
    const r = await c.get('/api/test-account')
    assert.equal(r.json.profile.firstName, 'Asha')
    assert.equal(r.json.profile.email, 'asha@example.com')
    assert.equal(r.json.profile.state, 'Uttar Pradesh')
    assert.equal(r.json.status.complete, true)
    assert.equal(r.json.status.percent, 75)
  })

  test('invalid email, state and PIN code are refused with the offending field named', async () => {
    const cases = [
      [{ email: 'nope' }, 'email'],
      [{ state: 'Narnia' }, 'state'],
      [{ postalCode: '12' }, 'postalCode'],
    ]
    for (const [patch, field] of cases) {
      const r = await c.post('/api/test-account', { ...full, ...patch })
      assert.equal(r.status, 400, field)
      assert.equal(r.json.field, field)
    }
  })

  test('the state is stored in its official spelling', async () => {
    const r = await c.post('/api/test-account', { ...full, state: 'uttar pradesh' })
    assert.equal(r.json.profile.state, 'Uttar Pradesh')
  })

  test('GST: a bad number is refused and does not change the profile', async () => {
    const r = await c.post('/api/test-account', { hasGst: true, gstin: '27AAPFU0939F1ZX' })
    assert.equal(r.status, 400)
    assert.equal(r.json.code, 'GSTIN_INVALID')
    assert.notEqual((await c.get('/api/test-account')).json.profile.hasGst, true)
  })

  test('GST: a valid number is saved and shows 100%', async () => {
    const r = await c.post('/api/test-account', { hasGst: true, gstin: VALID_GSTIN })
    assert.equal(r.status, 200)
    assert.equal(r.json.profile.gstin, VALID_GSTIN)
    assert.equal(r.json.profile.gstVerified, 'format')
    assert.equal(r.json.status.percent, 100)
  })

  test('GST: choosing no clears the number', async () => {
    const r = await c.post('/api/test-account', { hasGst: false })
    assert.equal(r.json.profile.gstin, '')
    assert.equal(r.json.profile.hasGst, false)
  })

  test('the GST check endpoint needs a login and reports the registered state', async () => {
    assert.equal((await app.newClient().post('/api/test-gst/verify', { gstin: VALID_GSTIN })).status, 401)
    const r = await c.post('/api/test-gst/verify', { gstin: VALID_GSTIN })
    assert.equal(r.json.ok, true)
    assert.equal(r.json.state, 'Maharashtra')
    assert.equal(r.json.stateMismatch, true, 'profile is in Uttar Pradesh')
    const bad = await c.post('/api/test-gst/verify', { gstin: 'XYZ' })
    assert.equal(bad.json.ok, false)
  })

  test('checkout is blocked until the profile is complete, and names what is missing', async () => {
    const fresh = await login(app, msg91, '9876544444')
    const r = await fresh.post('/api/test-checkout', { items: [{ variantId: '1', qty: 1, label: 'x' }] })
    assert.equal(r.status, 400)
    assert.equal(r.json.code, 'PROFILE_INCOMPLETE')
    assert.deepEqual(r.json.missing, ['firstName', 'lastName', 'email', 'address', 'state', 'city', 'postalCode'])
  })

  test('an empty last name is refused when it is sent', async () => {
    const r = await c.post('/api/test-account', { firstName: 'Asha', lastName: '   ', email: 'asha@example.com' })
    assert.equal(r.status, 400)
    assert.equal(r.json.field, 'lastName')
  })
})
