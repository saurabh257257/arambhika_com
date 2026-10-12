// Sign up / log in with OTP, session security and the guards in front of customer data.

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startApp, startFakeMsg91, login } from '../test-helpers/server.js'

describe('OTP login (MSG91 configured)', () => {
  let app, msg91
  before(async () => {
    msg91 = await startFakeMsg91()
    app = await startApp({ msg91 })
  })
  after(async () => { await app.stop(); await msg91.close() })

  test('config reports OTP on and the 4-digit length', async () => {
    const r = await app.newClient().get('/api/test-auth/config')
    assert.deepEqual(r.json, { otp: true, otpLength: 4, testMode: false })
  })

  test('rejects numbers that are not valid Indian mobiles', async () => {
    const c = app.newClient()
    for (const mobile of ['', '12345', '5876543210', 'abcdefghij']) {
      const r = await c.post('/api/test-auth/send-otp', { mobile })
      assert.equal(r.status, 400, `mobile "${mobile}" should be refused`)
    }
  })

  test('sends an OTP through MSG91 with the 91 country code', async () => {
    const c = app.newClient()
    const r = await c.post('/api/test-auth/send-otp', { mobile: '9876500001' })
    assert.equal(r.status, 200)
    assert.ok(msg91.calls.some((x) => x.mobile === '919876500001'))
  })

  test('a second OTP request within 30 seconds is refused', async () => {
    const c = app.newClient()
    await c.post('/api/test-auth/send-otp', { mobile: '9876500002' })
    const again = await c.post('/api/test-auth/send-otp', { mobile: '9876500002' })
    assert.equal(again.status, 429)
  })

  test('a wrong OTP does not log in', async () => {
    const c = app.newClient()
    await c.post('/api/test-auth/send-otp', { mobile: '9876500003' })
    const r = await c.post('/api/test-auth/verify-otp', { mobile: '9876500003', otp: '9999' })
    assert.equal(r.status, 401)
    assert.equal((await c.get('/api/test-auth/me')).json.loggedIn, false)
  })

  test('five wrong codes lock the number even when the right code follows', async () => {
    const c = app.newClient()
    await c.post('/api/test-auth/send-otp', { mobile: '9876500004' })
    for (let i = 0; i < 5; i++) await c.post('/api/test-auth/verify-otp', { mobile: '9876500004', otp: '0000' })
    const r = await c.post('/api/test-auth/verify-otp', { mobile: '9876500004', otp: msg91.code })
    assert.equal(r.status, 429)
  })

  test('the right OTP logs a new customer in and flags them as new', async () => {
    const c = app.newClient()
    await c.post('/api/test-auth/send-otp', { mobile: '9876500005' })
    const r = await c.post('/api/test-auth/verify-otp', { mobile: '9876500005', otp: msg91.code })
    assert.equal(r.status, 200)
    assert.equal(r.json.isNew, true)
    assert.equal(r.json.mobile, '9876500005')
    const me = await c.get('/api/test-auth/me')
    assert.deepEqual(me.json, { loggedIn: true, mobile: '9876500005' })
  })

  test('the session cookie is HttpOnly and SameSite=Lax', async () => {
    const c = app.newClient()
    await c.post('/api/test-auth/send-otp', { mobile: '9876500006' })
    const r = await c.post('/api/test-auth/verify-otp', { mobile: '9876500006', otp: msg91.code })
    const setCookie = r.headers.get('set-cookie')
    assert.match(setCookie, /HttpOnly/i)
    assert.match(setCookie, /SameSite=Lax/i)
  })

  test('logging out ends the session', async () => {
    const c = await login(app, msg91, '9876500007')
    assert.equal((await c.get('/api/test-auth/me')).json.loggedIn, true)
    await c.post('/api/test-auth/logout')
    assert.equal((await c.get('/api/test-auth/me')).json.loggedIn, false)
  })

  test('a hand-made or tampered cookie is not accepted', async () => {
    const c = app.newClient()
    const forged = [
      'arambhika_session=9876500008.99999999999999.forgedsignature',
      'arambhika_session=9876500008',
      'arambhika_test_session=8886772827', // the old unsigned cookie
    ]
    for (const cookie of forged) {
      const r = await c.get('/api/test-account', { Cookie: cookie })
      assert.equal(r.status, 401, `${cookie} must not be accepted`)
    }
  })

  test('changing the mobile inside a real cookie breaks its signature', async () => {
    const c = await login(app, msg91, '9876500009')
    const tampered = c.cookie.replace('9876500009', '9876500010')
    const r = await c.get('/api/test-account', { Cookie: tampered })
    assert.equal(r.status, 401)
  })

  test('customer endpoints all require a login', async () => {
    const c = app.newClient()
    for (const [method, url] of [
      ['GET', '/api/test-account'], ['POST', '/api/test-account'],
      ['GET', '/api/test-cart'], ['POST', '/api/test-cart'],
      ['GET', '/api/test-orders'], ['POST', '/api/test-checkout'],
    ]) {
      const r = await c.request(method, url, method === 'POST' ? {} : undefined)
      assert.equal(r.status, 401, `${method} ${url} must need a session`)
    }
  })
})

describe('Test-mode login (MSG91 not configured)', () => {
  let app
  before(async () => { app = await startApp() })
  after(async () => { await app.stop() })

  test('config reports test mode', async () => {
    const r = await app.newClient().get('/api/test-auth/config')
    assert.equal(r.json.otp, false)
    assert.equal(r.json.testMode, true)
  })

  test('only the single allowed test number can log in', async () => {
    const c = app.newClient()
    const other = await c.post('/api/test-auth/send-otp', { mobile: '9876500011' })
    assert.equal(other.status, 401)
    const bad = await c.post('/api/test-auth/verify-otp', { mobile: '9876500011', otp: '1234' })
    assert.equal(bad.status, 401)

    const ok = await c.post('/api/test-auth/send-otp', { mobile: '8886772827' })
    assert.equal(ok.json.testMode, true)
    const v = await c.post('/api/test-auth/verify-otp', { mobile: '8886772827', otp: '' })
    assert.equal(v.status, 200)
  })
})
