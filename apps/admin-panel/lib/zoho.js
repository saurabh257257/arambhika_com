// Reads customers, invoices and sales orders from Zoho Books at runtime. Nothing here is saved to disk:
// results are kept in memory for a few minutes (so 20 people opening the page do not make 20 Zoho calls),
// and a "Refresh from Zoho" button forces a fresh pull. Read-only: this module never writes to Zoho.
'use strict';

const TTL_MS = 5 * 60 * 1000;
const MAX_PAGES = 5; // 200 per page: up to 1000 records of each kind

class ZohoError extends Error {
  constructor(kind, message) { super(message); this.kind = kind; }
}

function createZoho(env = process.env, fetchImpl = fetch) {
  const dc = env.ZOHO_DC === 'com' ? 'com' : 'in';
  const org = env.ZOHO_BOOKS_ORG_ID || '';
  const configured = Boolean(env.ZOHO_CLIENT_ID && env.ZOHO_CLIENT_SECRET && env.ZOHO_REFRESH_TOKEN && org);
  let token = null; // { value, expires }
  const cache = new Map(); // name -> { at, data, error, pending }

  async function accessToken() {
    if (!configured) throw new ZohoError('not_configured', 'Zoho is not connected to this panel yet');
    if (token && token.expires > Date.now()) return token.value;
    const params = new URLSearchParams({ grant_type: 'refresh_token', client_id: env.ZOHO_CLIENT_ID, client_secret: env.ZOHO_CLIENT_SECRET, refresh_token: env.ZOHO_REFRESH_TOKEN });
    const res = await fetchImpl(`https://accounts.zoho.${dc}/oauth/v2/token?${params}`, { method: 'POST' });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || !json.access_token) throw new ZohoError('not_authorized', 'Zoho refused the saved login: ' + ((json && json.error) || res.status));
    token = { value: json.access_token, expires: Date.now() + ((json.expires_in || 3600) - 120) * 1000 };
    return token.value;
  }

  async function books(path, query = {}) {
    const t = await accessToken();
    const qs = new URLSearchParams({ organization_id: org, ...query });
    const res = await fetchImpl(`https://www.zohoapis.${dc}/books/v3/${path}?${qs}`, { headers: { Authorization: `Zoho-oauthtoken ${t}` } });
    const json = await res.json().catch(() => null);
    if (res.status === 401 || (json && json.code === 57)) throw new ZohoError('not_authorized', 'The saved Zoho login is not allowed to read ' + path.split('/')[0]);
    if (!res.ok || !json || json.code !== 0) throw new ZohoError('failed', (json && json.message) || 'Zoho error ' + res.status);
    return json;
  }

  async function pages(path, key, query = {}) {
    const out = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const j = await books(path, { ...query, per_page: 200, page });
      out.push(...(j[key] || []));
      if (!(j.page_context && j.page_context.has_more_page)) break;
    }
    return out;
  }

  // one cached pull per kind; concurrent callers share the same request
  function cached(name, loader, { refresh = false } = {}) {
    const hit = cache.get(name);
    if (hit && hit.pending) return hit.pending;
    if (hit && !refresh && Date.now() - hit.at < TTL_MS && !hit.error) return Promise.resolve(hit.data);
    const pending = loader().then((data) => { cache.set(name, { at: Date.now(), data, error: '' }); return data; })
      .catch((err) => {
        cache.set(name, { at: hit ? hit.at : 0, data: hit ? hit.data : null, error: err.message, kind: err.kind });
        if (hit && hit.data) return hit.data; // Zoho is down or refused: keep showing the last good copy, and the status screen shows the error
        throw err;
      });
    cache.set(name, { ...(hit || { at: 0, data: null, error: '' }), pending });
    pending.then(() => {}, () => {});
    return pending;
  }

  const num = (v) => Number(v) || 0;
  const normInvoice = (i) => ({
    id: String(i.invoice_id), number: i.invoice_number || '', customerId: String(i.customer_id || ''), customerName: i.customer_name || i.company_name || '',
    date: i.date || '', dueDate: i.due_date || '', total: num(i.total), balance: num(i.balance), status: String(i.status || '').toLowerCase(),
    phone: i.phone || '', email: i.email || '', paymentExpected: i.payment_expected_date || '', lastPayment: i.last_payment_date || '',
  });
  const normOrder = (o) => ({
    id: String(o.salesorder_id), number: o.salesorder_number || '', customerName: o.customer_name || o.company_name || '', date: o.date || '',
    createdTime: o.created_time || '', total: num(o.total), status: String(o.order_status || o.status || '').toLowerCase(),
    invoiced: String(o.invoiced_status || '').toLowerCase(), paid: String(o.paid_status || '').toLowerCase(), shipped: String(o.shipped_status || '').toLowerCase(),
  });
  const normContact = (c) => ({
    id: String(c.contact_id), name: c.contact_name || c.company_name || '', company: c.company_name || '', phone: c.mobile || c.phone || '', email: c.email || '',
    outstanding: num(c.outstanding_receivable_amount), createdTime: c.created_time || '',
  });

  const api = {
    configured,
    // every invoice (paid or not, newest first): used for "who owes us" and to know who has bought before
    invoices: (o) => cached('invoices', async () => (await pages('invoices', 'invoices', { sort_column: 'created_time', sort_order: 'D' })).map(normInvoice), o),
    salesOrders: (o) => cached('salesorders', async () => (await pages('salesorders', 'salesorders', { sort_column: 'created_time', sort_order: 'D' })).map(normOrder), o),
    // customers: the real contact list when the saved login may read it, otherwise rebuilt from the invoices
    async customers(o) {
      return cached('customers', async () => {
        try {
          const list = (await pages('contacts', 'contacts', { contact_type: 'customer', status: 'active' })).map(normContact);
          return { source: 'contacts', list };
        } catch (err) {
          if (err.kind !== 'not_authorized') throw err;
          const inv = await api.invoices(o);
          const by = new Map();
          for (const i of inv) {
            if (!i.customerId || by.has(i.customerId)) continue;
            by.set(i.customerId, { id: i.customerId, name: i.customerName, company: '', phone: i.phone, email: i.email, outstanding: 0, createdTime: '' });
          }
          return { source: 'invoices', list: [...by.values()], note: 'Customers are rebuilt from invoices because the saved Zoho login cannot read the contact list.' };
        }
      }, o);
    },
    // what each kind of data currently looks like, for the status screen
    status() {
      const one = (name) => { const c = cache.get(name); return c ? { at: c.at || 0, error: c.error || '', count: c.data ? (Array.isArray(c.data) ? c.data.length : (c.data.list || []).length) : 0, source: c.data && c.data.source } : { at: 0, error: '', count: 0 }; };
      return { configured, invoices: one('invoices'), customers: one('customers'), salesOrders: one('salesorders') };
    },
    ZohoError,
  };
  return api;
}

module.exports = { createZoho, ZohoError };
