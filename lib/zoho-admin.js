// Read-only lookups against Zoho Commerce / Books / Inventory, using the OAuth connection
// from lib/zoho-oauth.js. Used to show a customer their order status, invoice and e-way bill.

import { getAccessToken } from './zoho-oauth.js'

const dc = () => (process.env.ZOHO_DC === 'com' ? 'com' : 'in')
const domain = () => process.env.ZOHO_STOREFRONT_DOMAIN

async function authedGet(url) {
  const token = await getAccessToken()
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'domain-name': domain() },
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.message || `Zoho API error (${res.status})`)
  return json
}

// Finds the most recent sales order with a matching email, within the last `withinMinutes` —
// used right after placing a test order, to confirm it really landed in Zoho. Matched by email,
// not phone: the list endpoint this calls (confirmed live) returns `email` on every row but no
// `phone` and no usable contact details — `contact_persons` here is just an array of ID strings,
// not objects, so an earlier phone-based version of this always missed real matches.
export async function findRecentSalesOrderByEmail(email, withinMinutes = 10) {
  const json = await authedGet(`https://commerce.zoho.${dc()}/store/api/v1/salesorders?per_page=20&sort_column=created_time&sort_order=D`)
  const cutoff = Date.now() - withinMinutes * 60 * 1000
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) return null
  return (json.salesorders || []).find((so) => {
    const created = new Date(so.created_time).getTime()
    return created >= cutoff && String(so.email || '').trim().toLowerCase() === normalizedEmail
  }) || null
}

export async function getSalesOrderStatus(salesorderId) {
  const json = await authedGet(`https://commerce.zoho.${dc()}/store/api/v1/salesorders/${salesorderId}`)
  const so = json.salesorder || {}
  return {
    status: so.order_status || so.status,
    invoicedStatus: so.invoiced_status,
    shippedStatus: so.shipped_status,
    total: so.total,
  }
}

// Zoho Books: list invoices referencing this sales order number, if any has been raised yet.
export async function findInvoiceForSalesOrder(salesorderNumber, organizationId) {
  if (!organizationId) throw new Error('Missing ZOHO_BOOKS_ORG_ID')
  const json = await authedGet(
    `https://www.zohoapis.${dc()}/books/v3/invoices?organization_id=${organizationId}&reference_number=${encodeURIComponent(salesorderNumber)}`
  )
  return (json.invoices || [])[0] || null
}

// Zoho Inventory: e-way bill linked to an invoice, if one was generated.
export async function findEwayBillForInvoice(invoiceId, organizationId) {
  if (!organizationId) throw new Error('Missing ZOHO_INVENTORY_ORG_ID')
  const json = await authedGet(
    `https://www.zohoapis.${dc()}/inventory/v1/ewaybills?organization_id=${organizationId}&entity_type=invoice&entity_id=${invoiceId}`
  )
  return (json.ewaybills || [])[0] || null
}

// Recent sales orders for one customer email, oldest first. Used to link paid orders back to
// the customer's account no matter how many there are or when payment finished.
export async function listSalesOrdersByEmail(email, perPage = 50) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) return []
  const json = await authedGet(`https://commerce.zoho.${dc()}/store/api/v1/salesorders?per_page=${perPage}&sort_column=created_time&sort_order=D`)
  return (json.salesorders || [])
    .filter((so) => String(so.email || '').trim().toLowerCase() === normalizedEmail)
    .sort((a, b) => new Date(a.created_time) - new Date(b.created_time))
}

export async function getSalesOrderItems(salesorderId) {
  const json = await authedGet(`https://commerce.zoho.${dc()}/store/api/v1/salesorders/${salesorderId}`)
  const lines = json.salesorder?.line_items || []
  return lines.map((l) => ({ label: l.name || l.item_name || l.sku || 'Item', qty: Number(l.quantity) || 1 }))
}
