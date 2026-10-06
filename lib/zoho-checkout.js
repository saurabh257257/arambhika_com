// Drives Zoho's own public Storefront checkout (cart -> address -> shipping -> place order) —
// the same unauthenticated flow a real shopper's browser uses, confirmed by a live test
// against the real store on 2026-10-05. No OAuth, no Client ID/Secret: just a domain-name
// header and a per-checkout session cookie/CSRF token, carried across the few requests below.

const dc = () => (process.env.ZOHO_DC === 'com' ? 'com' : 'in')
const BASE = () => `https://commerce.zoho.${dc()}`
const domain = () => {
  const d = process.env.ZOHO_STOREFRONT_DOMAIN
  if (!d) throw new Error('Missing ZOHO_STOREFRONT_DOMAIN')
  return d
}

// Zoho's address step wants a 2-letter state code, not the full name (confirmed live: the
// full name "Uttar Pradesh" was rejected as "exceeds the maximum length of 7 characters").
const INDIA_STATE_CODES = {
  'Andhra Pradesh': 'AP', 'Arunachal Pradesh': 'AR', Assam: 'AS', Bihar: 'BR',
  Chhattisgarh: 'CG', Goa: 'GA', Gujarat: 'GJ', Haryana: 'HR', 'Himachal Pradesh': 'HP',
  Jharkhand: 'JH', Karnataka: 'KA', Kerala: 'KL', 'Madhya Pradesh': 'MP', Maharashtra: 'MH',
  Manipur: 'MN', Meghalaya: 'ML', Mizoram: 'MZ', Nagaland: 'NL', Odisha: 'OR', Punjab: 'PB',
  Rajasthan: 'RJ', Sikkim: 'SK', 'Tamil Nadu': 'TN', Telangana: 'TG', Tripura: 'TR',
  'Uttar Pradesh': 'UP', Uttarakhand: 'UK', 'West Bengal': 'WB', Delhi: 'DL',
  'Jammu and Kashmir': 'JK', Ladakh: 'LA', Puducherry: 'PY', Chandigarh: 'CH',
}
// Keyed case-insensitively, since a customer (or this test build) may save the state in any case.
const INDIA_STATE_CODES_LOWER = Object.fromEntries(
  Object.entries(INDIA_STATE_CODES).map(([name, code]) => [name.toLowerCase(), code])
)

class CookieJar {
  constructor() { this.cookies = new Map() }
  update(res) {
    const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
    for (const line of list) {
      const pair = line.split(';')[0]
      const i = pair.indexOf('=')
      if (i > -1) this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim())
    }
  }
  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  }
  get(name) { return this.cookies.get(name) }
}

async function call(jar, path, { method = 'GET', body, query } = {}) {
  const qs = query ? `?${new URLSearchParams(query)}` : ''
  const headers = { 'domain-name': domain() }
  const cookieHeader = jar.header()
  if (cookieHeader) headers.Cookie = cookieHeader
  const csrf = jar.get('csrfc')
  if (csrf) headers['X-ZCSRF-TOKEN'] = `csrfp=${csrf}`
  if (body) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE()}${path}${qs}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  jar.update(res)
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch {}
  return { ok: res.ok, status: res.status, json }
}

export class CheckoutError extends Error {}

// items: [{ variantId, qty }]  customer: { firstName, lastName, email, phone, address, city, state, postalCode }
export async function placeOrder({ items, customer }) {
  if (!items?.length) throw new CheckoutError('No items to order')
  const jar = new CookieJar()
  let checkoutId = null

  for (const item of items) {
    if (!item.variantId) throw new CheckoutError(`${item.label || 'A product'} is missing its Zoho variant id`)
    const res = await call(jar, '/storefront/api/v1/cart', {
      method: 'POST',
      body: { product_variant_id: item.variantId, quantity: String(item.qty) },
    })
    if (!res.ok || res.json?.status_code !== '0') {
      throw new CheckoutError(res.json?.status_message || `Could not add ${item.label || item.variantId} to cart`)
    }
    checkoutId = res.json.payload.cart_id
  }

  const trimmedState = String(customer.state || '').trim()
  const stateCode =
    trimmedState.length <= 2 ? trimmedState.toUpperCase() // already a code (e.g. "UP")
    : INDIA_STATE_CODES_LOWER[trimmedState.toLowerCase()] || trimmedState
  const addrRes = await call(jar, '/storefront/api/v1/checkout/address', {
    method: 'POST',
    query: { checkout_id: checkoutId },
    body: {
      shipping_address: {
        first_name: customer.firstName,
        last_name: customer.lastName,
        email_address: customer.email,
        address: customer.address,
        city: customer.city,
        state: stateCode,
        postal_code: customer.postalCode,
        telephone: customer.phone,
        country: 'IN',
        same_billing_address: true,
      },
    },
  })
  if (!addrRes.ok || addrRes.json?.status_code !== '0') {
    throw new CheckoutError(addrRes.json?.developer_message || addrRes.json?.status_message || 'Could not set the delivery address')
  }

  const shippingMethods = addrRes.json.payload?.checkout_shipping_methods?.shipping_methods || []
  if (shippingMethods.length) {
    const shipRes = await call(jar, '/storefront/api/v1/checkout/shipping-methods', {
      method: 'POST',
      query: { checkout_id: checkoutId },
      body: { shipping: shippingMethods[0].id },
    })
    if (!shipRes.ok || shipRes.json?.status_code !== '0') {
      throw new CheckoutError('Could not set the shipping method')
    }
  }
  // If no shipping methods exist, Zoho Commerce has none configured for this address/zone —
  // placing the order below will silently fail until one is added in Settings > Shipping.

  const payRes = await call(jar, '/storefront/api/v1/checkout/process-offline-payment', {
    method: 'POST',
    query: { checkout_id: checkoutId },
    body: { payment_mode: 'cash_on_delivery' },
  })
  if (!payRes.ok) throw new CheckoutError(`Zoho rejected the order (status ${payRes.status})`)

  return { checkoutId, hadShippingMethod: shippingMethods.length > 0, response: payRes.json }
}
