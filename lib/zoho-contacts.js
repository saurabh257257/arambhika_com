// Pushes a logged-in customer's profile edits into their existing Zoho Books and Zoho Inventory
// contact, matched by mobile number. Never creates a contact and never touches one unless
// exactly one contact has that mobile number.
//
// Zoho Commerce has no Admin API for editing a customer record (its documented Admin APIs are
// products, categories, coupons, taxes, payments, sales orders, shipments and returns), so the
// Commerce customer cannot be updated from here.

import { getAccessToken, isConnected } from './zoho-oauth.js'

const dc = () => (process.env.ZOHO_DC === 'com' ? 'com' : 'in')

const APPS = {
  books: {
    label: 'Zoho Books',
    base: () => `https://www.zohoapis.${dc()}/books/v3`,
    orgId: () => process.env.ZOHO_BOOKS_ORG_ID,
  },
  inventory: {
    label: 'Zoho Inventory',
    base: () => `https://www.zohoapis.${dc()}/inventory/v1`,
    orgId: () => process.env.ZOHO_INVENTORY_ORG_ID,
  },
}

const last10 = (v) => String(v || '').replace(/\D/g, '').slice(-10)

async function call(method, url, body) {
  const token = await getAccessToken()
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || (json && json.code !== undefined && json.code !== 0)) {
    throw new Error(json?.message || `Zoho API error (${res.status})`)
  }
  return json
}

async function syncOne(appKey, profile, knownId) {
  const app = APPS[appKey]
  const orgId = app.orgId()
  if (!orgId) return { app: app.label, status: 'skipped', message: 'organization id not configured' }

  const mobile = last10(profile.phone)
  if (mobile.length !== 10) return { app: app.label, status: 'skipped', message: 'no valid mobile number' }

  const q = (extra = {}) => new URLSearchParams({ organization_id: orgId, ...extra })

  // A contact matched on an earlier save is reused, so the customer can later change their
  // email or mobile without losing the link. Otherwise narrow by phone on Zoho's side, confirm
  // the exact number here, and if several contacts share it, take the one whose email matches.
  let contactId = knownId
  if (contactId) {
    try { await call('GET', `${app.base()}/contacts/${contactId}?${q()}`) } catch { contactId = null }
  }
  if (!contactId) {
    const list = await call('GET', `${app.base()}/contacts?${q({ phone_contains: mobile, filter_by: 'Status.All' })}`)
    let matches = (list.contacts || []).filter(
      (c) => last10(c.phone) === mobile || last10(c.mobile) === mobile
    )
    if (matches.length > 1) {
      const email = String(profile.email || '').trim().toLowerCase()
      const byEmail = email ? matches.filter((c) => String(c.email || '').trim().toLowerCase() === email) : []
      if (byEmail.length === 1) matches = byEmail
    }
    if (matches.length === 0) return { app: app.label, status: 'not_found', message: 'no contact with this mobile number' }
    if (matches.length > 1) return { app: app.label, status: 'skipped', message: `${matches.length} contacts share this mobile number` }
    contactId = matches[0].contact_id
  }
  const { contact } = await call('GET', `${app.base()}/contacts/${contactId}?${q()}`)
  const fullName = `${profile.firstName} ${profile.lastName || ''}`.trim()

  // Zoho drops any contact person left out of the list, so send them all back and change
  // only the one belonging to this mobile number (falling back to the primary person).
  const persons = contact.contact_persons || []
  const target =
    persons.find((p) => last10(p.mobile) === mobile || last10(p.phone) === mobile) ||
    persons.find((p) => p.is_primary_contact) ||
    persons[0]
  const contactPersons = persons.map((p) => {
    if (p !== target) return p
    return {
      ...p,
      first_name: profile.firstName,
      last_name: profile.lastName || '',
      ...(profile.email ? { email: profile.email } : {}),
    }
  })

  const body = {
    // A contact with a company name is a business account: leave its name alone.
    contact_name: contact.company_name ? contact.contact_name : fullName,
    contact_persons: contactPersons,
  }
  const addressComplete = profile.address && profile.city && profile.state && profile.postalCode
  if (addressComplete) {
    const address = {
      attention: fullName,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      zip: profile.postalCode,
      country: 'India',
    }
    body.billing_address = address
    body.shipping_address = address
  }

  await call('PUT', `${app.base()}/contacts/${contactId}?${q()}`, body)
  return { app: app.label, key: appKey, status: 'updated', contactId }
}

// Returns one result per app and never throws: a Zoho failure must not lose the profile
// the customer just saved locally.
export async function syncProfileToZoho(profile, knownIds = {}) {
  if (!isConnected()) {
    return Object.values(APPS).map((a) => ({ app: a.label, status: 'skipped', message: 'Zoho is not connected' }))
  }
  return Promise.all(
    Object.keys(APPS).map((key) =>
      syncOne(key, profile, knownIds[key]).catch((err) => {
        console.warn(`[zoho-contacts] ${APPS[key].label} sync failed: ${err.message}`)
        return { app: APPS[key].label, key, status: 'error', message: err.message }
      })
    )
  )
}
