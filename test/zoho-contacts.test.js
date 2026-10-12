// Profile sync with Zoho Books / Inventory, with Zoho itself replaced by a stub.

import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arambhika-zoho-'))
process.env.DATA_DIR = dataDir
process.env.ZOHO_REFRESH_TOKEN = 'refresh-token'
process.env.ZOHO_CLIENT_ID = 'id'
process.env.ZOHO_CLIENT_SECRET = 'secret'
process.env.ZOHO_BOOKS_ORG_ID = '111'
process.env.ZOHO_INVENTORY_ORG_ID = '222'
process.env.ZOHO_DC = 'in'

const { syncProfileToZoho, fetchProfileFromZoho, clearContactCache } = await import('../lib/zoho-contacts.js')

const realFetch = globalThis.fetch
let puts, contacts, detail

// Stub of the handful of Zoho endpoints the module talks to.
function installFetch() {
  puts = []
  globalThis.fetch = async (url, opt = {}) => {
    const u = String(url)
    const json = (o, status = 200) => ({ ok: status < 400, status, json: async () => o })
    if (u.includes('/oauth/v2/token')) return json({ access_token: 'access', expires_in: 3600 })
    if (/\/contacts\?/.test(u)) return json({ code: 0, contacts })
    if (opt.method === 'PUT') { puts.push({ url: u, body: JSON.parse(opt.body) }); return json({ code: 0 }) }
    if (/\/contacts\/[^/?]+/.test(u)) return json({ code: 0, contact: detail })
    return json({ code: 1, message: 'unexpected ' + u }, 404)
  }
}

const profile = {
  firstName: 'Saurabh', lastName: 'Singh', email: 'srbsingh888@gmail.com', phone: '8886772827',
  address: 'H-804', city: 'Noida', state: 'Uttar Pradesh', postalCode: '201301',
}

describe('syncProfileToZoho', () => {
  beforeEach(() => {
    clearContactCache()
    contacts = [{ contact_id: 'c1', phone: '+91-8886772827', email: 'srbsingh888@gmail.com' }]
    detail = {
      contact_name: 'Old Name',
      company_name: '',
      contact_persons: [
        { contact_person_id: 'p1', first_name: 'Old', last_name: 'Name', is_primary_contact: true, mobile: '8886772827' },
        { contact_person_id: 'p2', first_name: 'Someone', last_name: 'Else', email: 'else@example.com' },
      ],
    }
    installFetch()
  })
  afterEach(() => { globalThis.fetch = realFetch })

  test('updates the matching contact in both Books and Inventory', async () => {
    const results = await syncProfileToZoho(profile)
    assert.deepEqual(results.map((r) => r.status), ['updated', 'updated'])
    assert.equal(puts.length, 2)
    assert.match(puts[0].url, /books\/v3\/contacts\/c1\?organization_id=111/)
    assert.match(puts[1].url, /inventory\/v1\/contacts\/c1\?organization_id=222/)
  })

  test('changes the name, email and address of the right contact person only', async () => {
    await syncProfileToZoho(profile)
    const body = puts[0].body
    assert.equal(body.contact_name, 'Saurabh Singh')
    const [p1, p2] = body.contact_persons
    assert.equal(p1.first_name, 'Saurabh')
    assert.equal(p1.last_name, 'Singh')
    assert.equal(p1.email, 'srbsingh888@gmail.com')
    assert.equal(p2.first_name, 'Someone', 'other contact persons must be sent back unchanged')
    assert.equal(body.billing_address.zip, '201301')
  })

  test('never drops existing contact persons (Zoho deletes any that are left out)', async () => {
    await syncProfileToZoho(profile)
    assert.equal(puts[0].body.contact_persons.length, 2)
  })

  test('a business contact keeps its company name as the contact name', async () => {
    detail.company_name = 'ABC Limited'
    detail.contact_name = 'ABC Limited'
    await syncProfileToZoho(profile)
    assert.equal(puts[0].body.contact_name, 'ABC Limited')
  })

  test('an incomplete address is not written over the existing one', async () => {
    await syncProfileToZoho({ ...profile, address: '' })
    assert.equal(puts[0].body.billing_address, undefined)
  })

  test('with several contacts on one number, the one with the same email is chosen', async () => {
    contacts = [
      { contact_id: 'c0', phone: '8886772827', email: 'info@arambhika.com' },
      { contact_id: 'c1', phone: '8886772827', email: 'SRBSINGH888@gmail.com' },
      { contact_id: 'c2', phone: '8886772827', email: 'test@arambhika.com' },
    ]
    const results = await syncProfileToZoho(profile)
    assert.equal(results[0].contactId, 'c1')
    assert.match(puts[0].url, /contacts\/c1\?/)
  })

  test('with several contacts and no email match, nothing is changed', async () => {
    contacts = [
      { contact_id: 'c0', phone: '8886772827', email: 'a@example.com' },
      { contact_id: 'c2', phone: '8886772827', email: 'b@example.com' },
    ]
    const results = await syncProfileToZoho(profile)
    assert.equal(results[0].status, 'skipped')
    assert.equal(puts.length, 0)
  })

  test('a number that only partly matches is never edited', async () => {
    contacts = [{ contact_id: 'c9', phone: '9188867728270', email: 'x@example.com' }]
    const results = await syncProfileToZoho(profile)
    assert.equal(results[0].status, 'not_found')
    assert.equal(puts.length, 0)
  })

  test('no matching contact means no contact is created', async () => {
    contacts = []
    const results = await syncProfileToZoho(profile)
    assert.deepEqual(results.map((r) => r.status), ['not_found', 'not_found'])
    assert.equal(puts.length, 0)
  })

  test('a remembered contact id is used without searching again', async () => {
    contacts = []
    const results = await syncProfileToZoho(profile, { books: 'c1', inventory: 'c1' })
    assert.deepEqual(results.map((r) => r.status), ['updated', 'updated'])
  })

  test('a Zoho failure is reported per app and never thrown', async () => {
    globalThis.fetch = async (url) => {
      if (String(url).includes('/oauth/v2/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'a', expires_in: 3600 }) }
      return { ok: false, status: 500, json: async () => ({ message: 'boom' }) }
    }
    const results = await syncProfileToZoho(profile)
    assert.deepEqual(results.map((r) => r.status), ['error', 'error'])
  })
})

describe('fetchProfileFromZoho (Zoho -> website)', () => {
  beforeEach(() => {
    clearContactCache()
    detail = {
      contact_name: 'New Name',
      contact_persons: [{ first_name: 'New', last_name: 'Name', email: 'new@example.com', is_primary_contact: true }],
      billing_address: { address: '9 New Road', city: 'Delhi', state: 'Delhi', zip: '110001' },
    }
    installFetch()
  })
  afterEach(() => { globalThis.fetch = realFetch })

  test('reads name, email and address from the remembered contact', async () => {
    const f = await fetchProfileFromZoho({ books: 'c1' }, '8886772827')
    assert.deepEqual(f, {
      firstName: 'New', lastName: 'Name', email: 'new@example.com',
      address: '9 New Road', city: 'Delhi', state: 'Delhi', postalCode: '110001',
    })
  })

  test('returns null when no contact has been matched yet', async () => {
    assert.equal(await fetchProfileFromZoho({}, '8886772827'), null)
  })
})
