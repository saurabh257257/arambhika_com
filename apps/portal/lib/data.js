// Customers, vendors, vendor rates and items. Every write names the member who made it. A mobile number is the key of a
// customer and of a vendor: it is cleaned to 10 digits first, and a second row with the same number is refused.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TYPES = ['note', 'call', 'whatsapp', 'visit', 'quote', 'order', 'payment', 'dispatch', 'followup'];
const SOURCES = ['email', 'whatsapp', 'call', 'indiamart', 'website', 'instagram', 'linkedin', 'referral', 'exhibition', 'walk_in', 'other'];
const BUYER_TYPES = ['trader', 'non_trader', 'unknown'];
const BUSINESSES = ['battery_pack_maker', 'ev_maker', 'solar_storage', 'ups_inverter', 'repair_service', 'diy_hobby', 'institution_rnd', 'reseller_dealer', 'other'];
const URGENCY = ['immediate', 'within_a_month', 'later', 'exploring'];
const ENUMS = { source: SOURCES, buyer_type: BUYER_TYPES, business: BUSINESSES, urgency: URGENCY };
const TEXT = { name: 100, company: 100, email: 100, city: 60, state: 60, source_detail: 200, looking_for: 500, application: 300, cell_format: 100, monthly_volume: 100 };
const PROFILE = ['name', 'company', 'email', 'city', 'state', 'pincode', 'gstin', 'source', 'source_detail', 'buyer_type', 'business', 'looking_for', 'application', 'cell_format', 'monthly_volume', 'urgency'];
// what a salesperson should try to learn about a battery customer, with the question to ask
const ASK = {
  company: 'Which company or shop are they from?', city: 'Which city are they in?', state: 'Which state?',
  source: 'Where did they come from (email, WhatsApp, call, IndiaMART, website, referral)?', buyer_type: 'Are they a trader (buys to resell) or a non-trader (uses it themselves)?',
  business: 'What do they do (battery pack maker, EV maker, solar storage, UPS/inverter, repair, DIY, institution, reseller)?',
  looking_for: 'What are they looking for (nickel strip, cells, BMS, busbar, holders...)?', application: 'What will they use it for (e-bike, solar, power tool...)?',
  cell_format: 'Which cell type or size (18650, 21700, 32650, LiFePO4...)?', monthly_volume: 'How much do they need, and how often?', urgency: 'How soon do they need it?', email: 'What is their email?', gstin: 'What is their GST number?',
};

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
// "+91 98111 22233", "098111-22233" and "9811122233" are the same number; anything that is not an Indian mobile gives ''
function mobile(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2); else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : '';
}
const tokens = (s) => String(s || '').toLowerCase().match(/[a-z0-9]+(?:\.[0-9]+)?/g) || [];

module.exports = function data({ get, all, run, audit, plain, dataDir, tx }) {
  const like = (s) => '%' + String(s).replace(/[\\%_]/g, (c) => '\\' + c) + '%';

  // validate the profile fields that were given; blanks are ignored so an update can never wipe what is known
  function profile(input) {
    const out = {};
    for (const k of PROFILE) {
      if (input[k] == null) continue;
      let v = clean(input[k], TEXT[k] || 40); if (!v) continue;
      if (ENUMS[k]) { v = v.toLowerCase().replace(/[\s-]+/g, '_'); if (!ENUMS[k].includes(v)) return { error: k + ' must be one of: ' + ENUMS[k].join(', ') }; }
      if (k === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { error: 'That email does not look right' };
      if (k === 'pincode') { v = v.replace(/\s/g, ''); if (!/^\d{6}$/.test(v)) return { error: 'The pincode has 6 digits' }; }
      if (k === 'gstin') { v = v.toUpperCase().replace(/\s/g, ''); if (!/^[0-9A-Z]{15}$/.test(v)) return { error: 'A GST number has 15 letters and digits' }; }
      out[k] = v;
    }
    return { fields: out };
  }
  const missing = (c) => Object.keys(ASK).filter((k) => !c[k] || (k === 'buyer_type' && c[k] === 'unknown')).map((k) => ({ field: k, ask: ASK[k] }));

  const repo = {
    TYPES, SOURCES, BUYER_TYPES, BUSINESSES, URGENCY, mobile,

    // ================= customers =================
    addCustomer(input, by) {
      const m = mobile(input.mobile);
      if (!m) return { error: 'A valid 10-digit mobile number is needed (it is the customer\'s key), for example 98111 22233' };
      const dup = get('SELECT name FROM customers WHERE mobile = ?', m);
      if (dup) return { error: 'A customer with mobile ' + m + ' already exists: ' + dup.name + '. Use update_customer to add more details.', exists: true };
      const p = profile(input); if (p.error) return p;
      if (!p.fields.name) return { error: 'The customer needs a name' };
      const t = now(), f = { ...{ company: '', email: '', city: '', state: '', pincode: '', gstin: '', source: '', source_detail: '', buyer_type: 'unknown', business: '', looking_for: '', application: '', cell_format: '', monthly_volume: '', urgency: '' }, ...p.fields };
      run('INSERT INTO customers (mobile, name, company, email, city, state, pincode, gstin, source, source_detail, buyer_type, business, looking_for, application, cell_format, monthly_volume, urgency, owner_id, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        m, f.name, f.company, f.email, f.city, f.state, f.pincode, f.gstin, f.source, f.source_detail, f.buyer_type, f.business, f.looking_for, f.application, f.cell_format, f.monthly_volume, f.urgency, input.ownerId || by, by, t, t);
      audit(by, 'Added customer ' + f.name + ' (' + m + ')');
      const c = repo.customer(m);
      return { customer: c, missing: missing(c) };
    },
    updateCustomer(m0, input, by) {
      const m = mobile(m0), c = m && get('SELECT * FROM customers WHERE mobile = ?', m);
      if (!c) return { error: 'No customer with that mobile number', status: 404 };
      const p = profile(input); if (p.error) return p;
      const changed = Object.keys(p.fields).filter((k) => p.fields[k] !== c[k]);
      if (!changed.length) return { customer: repo.customer(m), changed: [], missing: missing(c) };
      run('UPDATE customers SET ' + changed.map((k) => k + ' = ?').join(', ') + ', updated_at = ? WHERE mobile = ?', ...changed.map((k) => p.fields[k]), now(), m);
      audit(by, 'Updated ' + c.name + ' (' + changed.join(', ') + ')');
      const fresh = repo.customer(m);
      return { customer: fresh, changed, missing: missing(fresh) };
    },
    addInteraction({ mobile: m0, type, summary, amount, nextDate }, by) {
      const m = mobile(m0), c = m && get('SELECT name FROM customers WHERE mobile = ?', m);
      if (!c) return { error: 'No customer with that mobile number', status: 404 };
      if (!TYPES.includes(type)) return { error: 'Type must be one of: ' + TYPES.join(', ') };
      summary = clean(summary, 2000); if (!summary) return { error: 'Say what happened' };
      if (nextDate && !/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return { error: 'The follow-up date must look like 2026-12-31' };
      const i = { id: id(), customer_mobile: m, type, summary, amount: amount == null || amount === '' ? null : Number(amount), next_date: nextDate || null, by_member: by, at: now() };
      if (i.amount != null && !Number.isFinite(i.amount)) return { error: 'The amount must be a number' };
      run('INSERT INTO interactions (id, customer_mobile, type, summary, amount, next_date, by_member, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', i.id, i.customer_mobile, i.type, i.summary, i.amount, i.next_date, i.by_member, i.at);
      audit(by, 'Logged ' + type + ' for ' + c.name);
      return { interaction: i };
    },
    addFile({ mobile: m0, interactionId, name, mime, buffer }, by) {
      const m = mobile(m0), c = m && get('SELECT name FROM customers WHERE mobile = ?', m);
      if (!c) return { error: 'No customer with that mobile number', status: 404 };
      if (!buffer || !buffer.length) return { error: 'The file is empty' };
      if (buffer.length > 10 * 1024 * 1024) return { error: 'The file is too big (10 MB at most)' };
      const f = { id: id(), customer_mobile: m, interaction_id: interactionId || null, name: clean(name, 150).replace(/[\\/:*?"<>|]/g, '') || 'file', mime: clean(mime, 100) || 'application/octet-stream', size: buffer.length, by_member: by, at: now() };
      fs.writeFileSync(path.join(dataDir, 'files', f.id), buffer);
      run('INSERT INTO files (id, customer_mobile, interaction_id, name, mime, size, by_member, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', f.id, f.customer_mobile, f.interaction_id, f.name, f.mime, f.size, f.by_member, f.at);
      audit(by, 'Uploaded ' + f.name + ' for ' + c.name);
      return { file: f };
    },
    // search looks at names, companies, places, what they want, and the text of everything that happened with them
    customers({ q, owner, buyer, business } = {}) {
      const where = [], args = [];
      const term = clean(q, 60).toLowerCase(), dg = String(q || '').replace(/\D/g, '');
      if (term) {
        const cols = ['name', 'company', 'email', 'city', 'state', 'gstin', 'source_detail', 'looking_for', 'application', 'cell_format', 'business', 'source'];
        const ors = cols.map((c) => "lower(c." + c + ") LIKE ? ESCAPE '\\'");
        args.push(...cols.map(() => like(term)));
        ors.push("EXISTS (SELECT 1 FROM interactions x WHERE x.customer_mobile = c.mobile AND lower(x.summary) LIKE ? ESCAPE '\\')"); args.push(like(term));
        if (dg.length >= 3) { ors.push('c.mobile LIKE ?'); args.push('%' + dg + '%'); }
        where.push('(' + ors.join(' OR ') + ')');
      }
      if (owner) { where.push('c.owner_id = ?'); args.push(owner); }
      if (buyer) { where.push('c.buyer_type = ?'); args.push(buyer); }
      if (business) { where.push('c.business = ?'); args.push(business); }
      return all(`SELECT c.*, m.name AS owner_name,
          (SELECT COUNT(*) FROM interactions i WHERE i.customer_mobile = c.mobile) AS interactions,
          (SELECT MAX(at) FROM interactions i WHERE i.customer_mobile = c.mobile) AS last_at,
          (SELECT MIN(next_date) FROM interactions i WHERE i.customer_mobile = c.mobile AND next_date >= ?) AS next_follow_up
        FROM customers c LEFT JOIN members m ON m.id = c.owner_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY COALESCE(last_at, c.created_at) DESC`, new Date().toISOString().slice(0, 10), ...args).map(plain);
    },
    customer(m0) {
      const m = mobile(m0); if (!m) return null;
      const c = get('SELECT c.*, o.name AS owner_name, cb.name AS created_by_name FROM customers c LEFT JOIN members o ON o.id = c.owner_id LEFT JOIN members cb ON cb.id = c.created_by WHERE c.mobile = ?', m);
      if (!c) return null;
      return {
        ...c,
        interactions: all('SELECT i.*, mm.name AS by_name FROM interactions i LEFT JOIN members mm ON mm.id = i.by_member WHERE i.customer_mobile = ? ORDER BY i.at DESC, i.rowid DESC', m).map(plain),
        files: all('SELECT f.*, mm.name AS by_name FROM files f LEFT JOIN members mm ON mm.id = f.by_member WHERE f.customer_mobile = ? ORDER BY f.at DESC', m).map(plain),
        missing: missing(c),
      };
    },
    // customers this member owns whose latest interaction asked for a follow-up on or before the given day
    followUps(mid, upTo) {
      return all("SELECT c.mobile, c.name, c.company, i.type, i.summary, i.next_date, i.at FROM customers c JOIN interactions i ON i.id = (SELECT id FROM interactions WHERE customer_mobile = c.mobile ORDER BY at DESC, rowid DESC LIMIT 1) WHERE c.owner_id = ? AND i.next_date IS NOT NULL AND i.next_date <= ? ORDER BY i.next_date", mid, upTo).map(plain);
    },
    file: (fid) => plain(get('SELECT * FROM files WHERE id = ?', fid)),
    filePath: (fid) => (/^[0-9a-f-]{36}$/.test(fid) ? path.join(dataDir, 'files', fid) : null),

    // ================= vendors (suppliers) =================
    addVendor(input, by) {
      const m = mobile(input.mobile);
      if (!m) return { error: 'A valid 10-digit mobile number is needed (it is the vendor\'s key)' };
      const dup = get('SELECT name FROM vendors WHERE mobile = ?', m);
      if (dup) return { error: 'A vendor with mobile ' + m + ' already exists: ' + dup.name, exists: true };
      const p = profile(input); if (p.error) return p;
      if (!p.fields.name) return { error: 'The vendor needs a name' };
      const f = p.fields, t = now();
      run('INSERT INTO vendors (mobile, name, company, email, city, state, gstin, notes, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', m, f.name, f.company || '', f.email || '', f.city || '', f.state || '', f.gstin || '', clean(input.notes, 1000), by, t, t);
      audit(by, 'Added vendor ' + f.name + ' (' + m + ')');
      return { vendor: repo.vendor(m) };
    },
    updateVendor(m0, input, by) {
      const m = mobile(m0), v = m && get('SELECT * FROM vendors WHERE mobile = ?', m);
      if (!v) return { error: 'No vendor with that mobile number', status: 404 };
      const p = profile(input); if (p.error) return p;
      const f = { ...p.fields }; for (const k of Object.keys(f)) if (!['name', 'company', 'email', 'city', 'state', 'gstin'].includes(k)) delete f[k];
      if (input.notes != null && clean(input.notes, 1000)) f.notes = clean(input.notes, 1000);
      const changed = Object.keys(f).filter((k) => f[k] !== v[k]);
      if (changed.length) { run('UPDATE vendors SET ' + changed.map((k) => k + ' = ?').join(', ') + ', updated_at = ? WHERE mobile = ?', ...changed.map((k) => f[k]), now(), m); audit(by, 'Updated vendor ' + v.name + ' (' + changed.join(', ') + ')'); }
      return { vendor: repo.vendor(m), changed };
    },
    vendors({ q } = {}) {
      const term = clean(q, 60).toLowerCase(), dg = String(q || '').replace(/\D/g, '');
      const rows = all(`SELECT v.*, (SELECT COUNT(*) FROM vendor_offers o WHERE o.vendor_mobile = v.mobile) AS offers, (SELECT MAX(offer_date) FROM vendor_offers o WHERE o.vendor_mobile = v.mobile) AS last_offer,
          (SELECT COUNT(DISTINCT COALESCE(item_id, lower(item_text))) FROM vendor_offers o WHERE o.vendor_mobile = v.mobile) AS materials FROM vendors v ORDER BY COALESCE(last_offer, v.created_at) DESC`).map(plain);
      if (!term) return rows;
      const withText = new Set(all('SELECT DISTINCT vendor_mobile FROM vendor_offers WHERE lower(item_text) LIKE ? ESCAPE \'\\\'', like(term)).map((r) => r.vendor_mobile));
      const withItem = new Set(all('SELECT DISTINCT o.vendor_mobile FROM vendor_offers o JOIN items i ON i.id = o.item_id WHERE lower(i.name) LIKE ? ESCAPE \'\\\' OR lower(i.sku) LIKE ? ESCAPE \'\\\'', like(term), like(term)).map((r) => r.vendor_mobile));
      return rows.filter((v) => [v.name, v.company, v.city, v.state, v.notes, v.gstin].some((s) => String(s).toLowerCase().includes(term)) || (dg.length >= 3 && v.mobile.includes(dg)) || withText.has(v.mobile) || withItem.has(v.mobile));
    },
    vendor(m0) {
      const m = mobile(m0), v = m && get('SELECT v.*, cb.name AS created_by_name FROM vendors v LEFT JOIN members cb ON cb.id = v.created_by WHERE v.mobile = ?', m);
      if (!v) return null;
      const offers = all('SELECT o.*, i.name AS item_name, i.sku AS item_sku, mm.name AS by_name FROM vendor_offers o LEFT JOIN items i ON i.id = o.item_id LEFT JOIN members mm ON mm.id = o.by_member WHERE o.vendor_mobile = ? ORDER BY o.offer_date DESC, o.at DESC, o.rowid DESC', m).map(plain);
      const seen = new Set(), latest = [];
      for (const o of offers) { const k = o.item_id || 'text:' + o.item_text.toLowerCase(); if (!seen.has(k)) { seen.add(k); latest.push(o); } }
      return { ...v, offers, latest };
    },

    // ================= items (from Zoho Commerce) =================
    replaceItems(list) {
      const t = now();
      tx(() => {
        for (const it of list) {
          run(`INSERT INTO items (id, sku, name, category, price, stock, unit, moq, description, image_url, collections, handle, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET sku = excluded.sku, name = excluded.name, category = excluded.category, price = excluded.price, stock = excluded.stock, unit = excluded.unit, moq = excluded.moq,
              description = excluded.description, image_url = excluded.image_url, collections = excluded.collections, handle = excluded.handle, synced_at = excluded.synced_at`,
          String(it.id), clean(it.sku, 60), clean(it.name, 200), clean(it.category, 100), it.price == null ? null : Number(it.price), it.stock == null ? null : Number(it.stock), clean(it.unit, 20), it.moq == null ? null : Number(it.moq),
          clean(it.description, 4000), clean(it.imageUrl, 400), JSON.stringify(it.collections || []), clean(it.handle, 200), t);
        }
      });
      return { count: list.length, at: t };
    },
    itemsStatus: () => { const r = get('SELECT COUNT(*) AS n, MAX(synced_at) AS at FROM items'); return { count: r.n, at: r.at }; },
    itemCategories: () => all("SELECT category, COUNT(*) AS n FROM items WHERE category != '' GROUP BY category ORDER BY category COLLATE NOCASE").map(plain),
    // the best (lowest) current rate per item, from each vendor's latest offer
    bestRates() {
      const best = new Map(), seen = new Set();
      for (const o of all('SELECT o.item_id, o.vendor_mobile, o.rate, o.unit, o.offer_date, v.name AS vendor_name FROM vendor_offers o JOIN vendors v ON v.mobile = o.vendor_mobile WHERE o.item_id IS NOT NULL ORDER BY o.offer_date DESC, o.at DESC, o.rowid DESC')) {
        const k = o.item_id + '|' + o.vendor_mobile; if (seen.has(k)) continue; seen.add(k);
        const b = best.get(o.item_id); if (!b || o.rate < b.rate) best.set(o.item_id, { rate: o.rate, unit: o.unit, vendor: o.vendor_name, vendor_mobile: o.vendor_mobile, date: o.offer_date, vendors: (b ? b.vendors : 0) + 1 }); else b.vendors++;
      }
      return best;
    },
    items({ q, category, inStock } = {}) {
      const term = clean(q, 60).toLowerCase(), words = tokens(term), rates = repo.bestRates();
      let rows = all('SELECT * FROM items ORDER BY category COLLATE NOCASE, name COLLATE NOCASE').map(plain);
      if (category) rows = rows.filter((r) => r.category === category);
      if (inStock) rows = rows.filter((r) => r.stock > 0);
      if (words.length) rows = rows.filter((r) => { const h = (r.name + ' ' + r.sku + ' ' + r.category + ' ' + r.collections).toLowerCase(); return words.every((w) => h.includes(w)); });
      return rows.map((r) => ({ ...r, collections: JSON.parse(r.collections || '[]'), best: rates.get(r.id) || null }));
    },
    item(iid) {
      const r = get('SELECT * FROM items WHERE id = ?', String(iid || '')); if (!r) return null;
      return { ...plain(r), collections: JSON.parse(r.collections || '[]'), suppliers: repo.findSuppliers({ itemId: r.id }) };
    },
    // best-scoring items for some words ("nickel strip 0.15"): every word has to appear, shorter names first
    searchItems(q, limit = 10) {
      const words = tokens(q); if (!words.length) return [];
      return all('SELECT id, sku, name, category, price, stock, unit FROM items').filter((r) => { const h = (r.name + ' ' + r.sku + ' ' + r.category).toLowerCase(); return words.every((w) => h.includes(w)); })
        .sort((a, b) => a.name.length - b.name.length).slice(0, limit).map(plain);
    },

    // ================= vendor rates =================
    // a vendor says "I have this material at this rate"; it is linked to one of our items when it can be done without guessing
    addOffer({ vendorMobile, itemId, itemText, rate, unit, quantity, validTill, note, offerDate }, by) {
      const vm = mobile(vendorMobile), v = vm && get('SELECT name FROM vendors WHERE mobile = ?', vm);
      if (!v) return { error: 'No vendor with that mobile number. Add the vendor first.', status: 404 };
      const r = Number(rate); if (!(r > 0)) return { error: 'The rate must be a number above zero' };
      for (const [k, d] of [['validTill', validTill], ['offerDate', offerDate]]) if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: k + ' must look like 2026-12-31' };
      let item = itemId ? get('SELECT id, name FROM items WHERE id = ?', String(itemId)) : null;
      if (itemId && !item) return { error: 'That item id does not exist. Use search_items to find it.' };
      const text = clean(itemText || (item && item.name), 200);
      if (!text) return { error: 'Say which material it is (an item id, or the material\'s name)' };
      let candidates = [];
      if (!item) { candidates = repo.searchItems(text, 5); if (candidates.length === 1) item = { id: candidates[0].id, name: candidates[0].name }; }
      const o = { id: id(), vendor_mobile: vm, item_id: item ? item.id : null, item_text: text, rate: r, unit: clean(unit, 20), quantity: clean(quantity, 60), valid_till: validTill || null, note: clean(note, 500), offer_date: offerDate || new Date().toISOString().slice(0, 10), by_member: by, at: now() };
      run('INSERT INTO vendor_offers (id, vendor_mobile, item_id, item_text, rate, unit, quantity, valid_till, note, offer_date, by_member, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', o.id, o.vendor_mobile, o.item_id, o.item_text, o.rate, o.unit, o.quantity, o.valid_till, o.note, o.offer_date, o.by_member, o.at);
      audit(by, 'Rate from ' + v.name + ': ' + text + ' at ' + r);
      return { offer: o, mappedTo: item, candidates: item ? [] : candidates };
    },
    mapOffer(offerId, itemId, by) {
      const o = get('SELECT id FROM vendor_offers WHERE id = ?', String(offerId || '')), it = get('SELECT id, name FROM items WHERE id = ?', String(itemId || ''));
      if (!o) return { error: 'Offer not found', status: 404 };
      if (!it) return { error: 'That item id does not exist' };
      run('UPDATE vendor_offers SET item_id = ? WHERE id = ?', it.id, o.id); audit(by, 'Linked a vendor rate to ' + it.name);
      return { ok: true, item: it };
    },
    // who can supply this, cheapest first: each vendor's latest rate for the item, plus unlinked offers that mention the same words
    findSuppliers({ itemId, query }) {
      const out = [], seen = new Set();
      const ids = itemId ? [String(itemId)] : repo.searchItems(query, 8).map((i) => i.id), words = tokens(query);
      const rows = all(`SELECT o.*, v.name AS vendor_name, v.company AS vendor_company, v.city AS vendor_city, i.name AS item_name FROM vendor_offers o JOIN vendors v ON v.mobile = o.vendor_mobile LEFT JOIN items i ON i.id = o.item_id ORDER BY o.offer_date DESC, o.at DESC, o.rowid DESC`);
      const today = new Date().toISOString().slice(0, 10);
      for (const o of rows) {
        const hit = o.item_id ? ids.includes(o.item_id) : (!itemId && words.length && words.every((w) => o.item_text.toLowerCase().includes(w)));
        if (!hit) continue;
        const k = o.vendor_mobile + '|' + (o.item_id || o.item_text.toLowerCase()); if (seen.has(k)) continue; seen.add(k);
        out.push({ vendor_mobile: o.vendor_mobile, vendor_name: o.vendor_name, vendor_company: o.vendor_company, vendor_city: o.vendor_city, item_id: o.item_id, item: o.item_name || o.item_text, linked: !!o.item_id, rate: o.rate, unit: o.unit, quantity: o.quantity, valid_till: o.valid_till, offered_on: o.offer_date, note: o.note, expired: !!(o.valid_till && o.valid_till < today), offer_id: o.id });
      }
      return out.sort((a, b) => a.expired - b.expired || a.rate - b.rate);
    },
  };
  return repo;
};
module.exports.mobile = mobile;
module.exports.ENUMS = { SOURCES, BUYER_TYPES, BUSINESSES, URGENCY, TYPES };
