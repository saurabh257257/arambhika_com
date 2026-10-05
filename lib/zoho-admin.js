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

// Finds the most recent sales orders whose contact phone/email matches, within the last
// `withinMinutes` — used right after placing a test order, to confirm it really landed in Zoho.
export async function findRecentSalesOrderByPhone(phone, withinMinutes = 10) {
  const json = await authedGet(`https://commerce.zoho.${dc()}/store/api/v1/salesorders?per_page=20&sort_column=created_time&sort_order=D`)
  const cutoff = Date.now() - withinMinutes * 60 * 1000
  return (json.salesorders || []).find((so) => {
    const created = new Date(so.created_time).getTime()
    return created >= cutoff && (so.phone === phone || so.contact_persons?.some((c) => c.phone === phone))
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
