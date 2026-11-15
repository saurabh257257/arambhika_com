// Pulls the items from Zoho Commerce into the portal. It reads the store's public storefront API (the same one the website uses),
// which needs no password or token, and shows what is switched on in the online store. The portal only ever reads from Zoho.
'use strict';

const DOMAIN = () => process.env.ZOHO_STOREFRONT_DOMAIN || 'armabhika.zohoecommerce.in';
const DC = () => (process.env.ZOHO_DC === 'com' ? 'com' : 'in');

const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&deg;': '°', '&times;': 'x' };
function plainText(html) {
  return String(html || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<\/(p|div|li|tr|h\d)>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] || ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

async function storefront(path, fetchFn) {
  const res = await fetchFn('https://commerce.zoho.' + DC() + '/storefront/api/v1' + path, { headers: { 'domain-name': DOMAIN() } });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.status_code !== '0') throw new Error('Zoho storefront ' + res.status + ': ' + ((json && json.status_message) || 'request failed'));
  return json.payload;
}
// Zoho's page parameter is page_number; stop when a page adds nothing new, so a repeated page can never multiply the list
async function allPages(path, key, fetchFn) {
  const out = [], seen = new Set();
  for (let page = 1; page <= 30; page++) {
    const p = await storefront(path + (path.includes('?') ? '&' : '?') + 'page_number=' + page, fetchFn);
    let added = 0;
    for (const x of p[key] || []) { const k = x.product_id || x.category_id || x.id || JSON.stringify(x); if (seen.has(k)) continue; seen.add(k); out.push(x); added++; }
    if (!added || !(p.pagination && p.pagination.has_more_page)) break;
  }
  return out;
}

async function fetchItems(fetchFn = fetch) {
  const [categories, products] = await Promise.all([allPages('/categories', 'categories', fetchFn), allPages('/products', 'products', fetchFn)]);
  const names = new Map();
  (function walk(list) { for (const c of list || []) { names.set(String(c.category_id), String(c.name || '').trim()); walk(c.sub_categories); } })(categories);
  // collections (18650, 21700...) are a bonus: if they cannot be read, the items still sync
  const inCollection = new Map();
  try {
    for (const col of await allPages('/collections', 'collections', fetchFn)) {
      for (const p of await allPages('/products?collection_id=' + col.id, 'products', fetchFn)) {
        const k = String(p.product_id); if (!inCollection.has(k)) inCollection.set(k, []); inCollection.get(k).push(String(col.name || '').trim());
      }
    }
  } catch (e) { /* no collections this time */ }
  return products.map((p) => {
    const v = (p.variants && p.variants[0]) || {};
    const pic = (p.images || []).find((i) => i && !i.is_placeholder_image && /^\/product-images\//.test(i.url || ''));
    const price = Number(v.selling_price != null ? v.selling_price : p.selling_price);
    return {
      id: String(p.product_id), sku: v.sku || '', name: String(p.name || '').trim(), category: names.get(String(p.category_id)) || '',
      price: price > 0 ? price : null, stock: v.stock_available != null ? Number(v.stock_available) : null, unit: p.unit || v.unit || '', moq: Number(v.minimum_order_quantity) || null,
      description: plainText(p.description), imageUrl: pic ? 'https://' + DOMAIN() + pic.url : '', collections: inCollection.get(String(p.product_id)) || [], handle: p.handle || '',
    };
  }).filter((i) => i.name);
}

// refreshes the items table now and then, keeping the old list if Zoho cannot be reached
function createSync(repo, { fetchFn = fetch, minutes = 30 } = {}) {
  let running = null, last = { ok: null, at: null, error: '' }, timer = null;
  const sync = () => {
    if (running) return running;
    running = fetchItems(fetchFn).then((list) => {
      if (!list.length) throw new Error('Zoho returned no items, so the old list was kept');
      repo.replaceItems(list); last = { ok: true, at: new Date().toISOString(), error: '', count: list.length }; return last;
    }).catch((e) => { last = { ok: false, at: new Date().toISOString(), error: e.message }; return last; }).finally(() => { running = null; });
    return running;
  };
  return {
    sync, status: () => ({ ...repo.itemsStatus(), last }),
    // a person pressing "refresh" can run it at most once a minute
    syncNow: () => (last.at && Date.now() - Date.parse(last.at) < 60 * 1000 ? Promise.resolve({ ...last, throttled: true }) : sync()),
    start() { if (timer) return; sync(); timer = setInterval(sync, minutes * 60 * 1000); timer.unref(); },
    stop() { clearInterval(timer); timer = null; },
  };
}

module.exports = { createSync, fetchItems, plainText };
