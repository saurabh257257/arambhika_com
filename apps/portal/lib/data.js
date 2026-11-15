// Customers, vendors, vendor rates and items. Every write names the member who made it. A mobile number is the key of a
// customer and of a vendor: it is cleaned to 10 digits first, and a second row with the same number is refused.
'use strict';
const fs = require('fs');
const filecheck = require('./filecheck');
const path = require('path');
const crypto = require('crypto');

const TYPES = ['note', 'call', 'whatsapp', 'visit', 'quote', 'order', 'payment', 'dispatch', 'followup'];
const SOURCES = ['email', 'whatsapp', 'call', 'indiamart', 'website', 'instagram', 'linkedin', 'referral', 'exhibition', 'walk_in', 'other'];
const BUYER_TYPES = ['trader', 'oem', 'unknown']; // OEM: makes its own products with what it buys
const BUSINESSES = ['battery_pack_maker', 'ev_maker', 'solar_storage', 'ups_inverter', 'repair_service', 'diy_hobby', 'institution_rnd', 'reseller_dealer', 'other'];
const URGENCY = ['immediate', 'within_a_month', 'later', 'exploring'];
const ENUMS = { source: SOURCES, buyer_type: BUYER_TYPES, business: BUSINESSES, urgency: URGENCY };
const TEXT = { address: 300, about: 500, name: 100, company: 100, email: 100, city: 60, state: 60, source_detail: 200, looking_for: 500, application: 300, cell_format: 100, monthly_volume: 100 };
const PROFILE = ['name', 'company', 'email', 'address', 'city', 'state', 'pincode', 'gstin', 'about', 'source', 'source_detail', 'buyer_type', 'business', 'looking_for', 'application', 'cell_format', 'monthly_volume', 'urgency'];
// what a salesperson should try to learn about a battery customer, with the question to ask
const ASK = {
  zoho_status: 'Is this customer created in the Zoho Books customer directory? Look them up there by mobile number.',
  company: 'Which company or shop are they from?', about: 'What does the company do?', address: 'What is their full address?', city: 'Which city are they in?', state: 'Which state?',
  source: 'Where did they come from (email, WhatsApp, call, IndiaMART, website, referral)?', buyer_type: 'Are they a trader (buys to resell) or an OEM (makes products with it)?',
  business: 'What do they do (battery pack maker, EV maker, solar storage, UPS/inverter, repair, DIY, institution, reseller)?',
  looking_for: 'What are they looking for (nickel strip, cells, BMS, busbar, holders...)?', application: 'What will they use it for (e-bike, solar, power tool...)?',
  cell_format: 'Which cell type or size (18650, 21700, 32650, LiFePO4...)?', monthly_volume: 'How much do they need, and how often?', urgency: 'How soon do they need it?', email: 'What is their email?', gstin: 'What is their GST number?',
};

const NOTE_ERR = 'Add a short description of one or two lines saying what this file is (at least a few words), so the team knows what they are looking at. Nothing was saved.';
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
      if (ENUMS[k]) { v = v.toLowerCase().replace(/[\s-]+/g, '_'); if (k === 'buyer_type' && v === 'non_trader') v = 'oem'; if (!ENUMS[k].includes(v)) return { error: k + ' must be one of: ' + ENUMS[k].join(', ') }; }
      if (k === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { error: 'That email does not look right' };
      if (k === 'pincode') { v = v.replace(/\s/g, ''); if (!/^\d{6}$/.test(v)) return { error: 'The pincode has 6 digits' }; }
      if (k === 'gstin') { v = v.toUpperCase().replace(/\s/g, ''); if (!/^[0-9A-Z]{15}$/.test(v)) return { error: 'A GST number has 15 letters and digits' }; }
      out[k] = v;
    }
    return { fields: out };
  }
  // where Claude can look before it bothers the user
  const LOOK = { zoho_status: 'the Zoho Books connector: search contacts by mobile number', company: 'the Zoho Books connector (the contact), the email signature, the sender\'s website', email: 'the email they wrote from, Zoho Books', gstin: 'Zoho Books contact, their invoice or website footer', city: 'Zoho Books, the email signature', state: 'Zoho Books, the email signature', pincode: 'Zoho Books, the email signature',
    source: 'the conversation or email they first came in through', buyer_type: 'their website or IndiaMART listing; otherwise ask', business: 'their website or IndiaMART listing; otherwise ask', looking_for: 'their email or chat', application: 'their email or chat', cell_format: 'their email or chat', monthly_volume: 'their email or chat', urgency: 'their email or chat' };
  const missing = (c) => Object.keys(ASK).filter((k) => !c[k] || (k === 'buyer_type' && c[k] === 'unknown')).map((k) => ({ field: k, ask: ASK[k], ...(ENUMS[k] ? { options: ENUMS[k].filter((o) => o !== 'unknown') } : {}), look_in: LOOK[k] }));

  const repo = {
    TYPES, SOURCES, BUYER_TYPES, BUSINESSES, URGENCY, mobile,

    // ================= customers =================
    addCustomer(input, by) {
      const m = mobile(input.mobile);
      if (!m) return { error: 'A valid 10-digit Indian mobile number is needed in the "mobile" field (it is the customer\'s key), for example 98111 22233. Received: ' + (input.mobile == null ? 'nothing' : '"' + clean(input.mobile, 30) + '"') };
      const dup = get('SELECT name FROM customers WHERE mobile = ?', m);
      if (dup) return { error: 'A customer with mobile ' + m + ' already exists: ' + dup.name + '. Use update_customer to add more details.', exists: true };
      const p = profile(input); if (p.error) return p;
      if (!p.fields.name) return { error: 'The customer needs a name' };
      const t = now(), f = { ...{ company: '', email: '', address: '', about: '', city: '', state: '', pincode: '', gstin: '', source: '', source_detail: '', buyer_type: 'unknown', business: '', looking_for: '', application: '', cell_format: '', monthly_volume: '', urgency: '' }, ...p.fields };
      run('INSERT INTO customers (mobile, name, company, email, address, about, city, state, pincode, gstin, source, source_detail, buyer_type, business, looking_for, application, cell_format, monthly_volume, urgency, owner_id, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        m, f.name, f.company, f.email, f.address, f.about, f.city, f.state, f.pincode, f.gstin, f.source, f.source_detail, f.buyer_type, f.business, f.looking_for, f.application, f.cell_format, f.monthly_volume, f.urgency, input.ownerId === undefined ? by : input.ownerId, by, t, t);
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
    addFile({ mobile: m0, interactionId, name, note, buffer }, by) {
      const m = mobile(m0), c = m && get('SELECT name FROM customers WHERE mobile = ?', m);
      if (!c) return { error: 'No customer with that mobile number', status: 404 };
      if (buffer && buffer.length > 10 * 1024 * 1024) return { error: 'The file is too big (10 MB at most)' };
      const ck = filecheck.check(name, buffer); if (!ck.ok) return { error: ck.error };
      const nt = clean(note, 240); if (nt.length < 8) return { error: NOTE_ERR };
      const f = { id: id(), customer_mobile: m, interaction_id: interactionId || null, name: clean(name, 150).replace(/[\\/:*?"<>|]/g, '') || 'file', mime: ck.mime, size: buffer.length, note: nt, by_member: by, at: now() };
      fs.writeFileSync(path.join(dataDir, 'files', f.id), buffer);
      run('INSERT INTO files (id, customer_mobile, interaction_id, name, mime, size, note, by_member, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', f.id, f.customer_mobile, f.interaction_id, f.name, f.mime, f.size, f.note, f.by_member, f.at);
      audit(by, 'Uploaded ' + f.name + ' for ' + c.name);
      return { file: f };
    },
    // search looks at names, companies, places, what they want, and the text of everything that happened with them
    customers({ q, owner, buyer, business, state } = {}) {
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
      if (owner === 'none') where.push('c.owner_id IS NULL'); else if (owner) { where.push('c.owner_id = ?'); args.push(owner); }
      if (state) { where.push('lower(c.state) = ?'); args.push(String(state).toLowerCase()); }
      if (buyer) { where.push('c.buyer_type = ?'); args.push(buyer); }
      if (business) { where.push('c.business = ?'); args.push(business); }
      return all(`SELECT c.*, m.name AS owner_name, cb.name AS created_by_name,
          (SELECT COUNT(*) FROM interactions i WHERE i.customer_mobile = c.mobile) AS interactions,
          (SELECT MAX(at) FROM interactions i WHERE i.customer_mobile = c.mobile) AS last_at,
          (SELECT MIN(next_date) FROM interactions i WHERE i.customer_mobile = c.mobile AND next_date >= ?) AS next_follow_up,
          (SELECT next_date FROM interactions i WHERE i.customer_mobile = c.mobile ORDER BY at DESC, rowid DESC LIMIT 1) AS latest_next
        FROM customers c LEFT JOIN members m ON m.id = c.owner_id LEFT JOIN members cb ON cb.id = c.created_by ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY COALESCE(last_at, c.created_at) DESC`, new Date().toISOString().slice(0, 10), ...args).map(plain);
    },
    customer(m0) {
      const m = mobile(m0); if (!m) return null;
      const c = get('SELECT c.*, o.name AS owner_name, cb.name AS created_by_name FROM customers c LEFT JOIN members o ON o.id = c.owner_id LEFT JOIN members cb ON cb.id = c.created_by WHERE c.mobile = ?', m);
      if (!c) return null;
      return {
        ...c,
        interactions: all('SELECT i.*, mm.name AS by_name FROM interactions i LEFT JOIN members mm ON mm.id = i.by_member WHERE i.customer_mobile = ? ORDER BY i.at DESC, i.rowid DESC', m).map(plain),
        files: all('SELECT f.*, mm.name AS by_name FROM files f LEFT JOIN members mm ON mm.id = f.by_member WHERE f.customer_mobile = ? ORDER BY f.at DESC', m).map(plain),
        contacts: all('SELECT * FROM customer_contacts WHERE customer_mobile = ? ORDER BY name COLLATE NOCASE', m).map(plain),
        missing: missing(c),
      };
    },
    states: () => all("SELECT state, COUNT(*) AS n FROM customers WHERE state != '' GROUP BY lower(state) ORDER BY state COLLATE NOCASE").map(plain),
    // is this customer in the Zoho Books customer directory? Claude looks them up with its own Zoho connector and reports here
    setZohoStatus(m0, created, contactName, by) {
      const m = mobile(m0), c = m && get('SELECT name FROM customers WHERE mobile = ?', m);
      if (!c) return { error: 'No customer with that mobile number', status: 404 };
      const st = created ? 'created' : 'not_created';
      run('UPDATE customers SET zoho_status = ?, zoho_contact = ?, zoho_checked_at = ?, updated_at = ? WHERE mobile = ?', st, created ? clean(contactName, 100) : '', now(), now(), m);
      audit(by, c.name + (created ? ' is in the Zoho Books directory' : ' is NOT in the Zoho Books directory'));
      return { ok: true, status: st };
    },
    // what Claude read from Zoho Books for this customer: invoices, sales orders and quotes, saved by number (the same number again updates it)
    saveBooksDocs(m0, input, by) {
      const m = mobile(m0), c = m && get('SELECT name FROM customers WHERE mobile = ?', m);
      if (!c) return { error: 'No customer with that mobile number', status: 404 };
      const date = (v) => { const d = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null; };
      const amt = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
      const st = (v) => clean(v, 30).toLowerCase().replace(/[\s-]+/g, '_');
      const lines = (list) => (Array.isArray(list) ? list : []).slice(0, 30).map((l) => ({ name: clean(l && l.name, 200), quantity: amt(l && l.quantity), rate: amt(l && l.rate), total: amt(l && (l.total != null ? l.total : l.amount)) })).filter((l) => l.name);
      const rows = [];
      for (const [kind, list] of [['invoice', input.invoices], ['order', input.orders], ['quote', input.quotes]]) {
        if (list != null && !Array.isArray(list)) return { error: kind + 's must be a list' };
        for (const d of (list || []).slice(0, 200)) {
          const number = clean(d && d.number, 40); if (!number) return { error: 'Every ' + kind + ' needs its number, for example INV-000123' };
          rows.push({ kind, number, date: date(d.date), due_date: date(d.due_date), expiry: date(d.expiry), total: amt(d.total), balance: amt(d.balance), status: st(d.status), shipped: st(d.shipped_status), invoiced: st(d.invoiced_status), payment_expected: date(d.payment_expected), lines: JSON.stringify(lines(d.lines)) });
        }
      }
      if (!rows.length) return { error: 'Send at least one invoice, order or quote' };
      const t = now();
      tx(() => { for (const r of rows) run(`INSERT INTO books_docs (customer_mobile, kind, number, date, due_date, expiry, total, balance, status, shipped, invoiced, payment_expected, lines, synced_at, synced_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(customer_mobile, kind, number) DO UPDATE SET date = excluded.date, due_date = excluded.due_date, expiry = excluded.expiry, total = excluded.total, balance = excluded.balance, status = excluded.status, shipped = excluded.shipped,
          invoiced = excluded.invoiced, payment_expected = excluded.payment_expected, lines = excluded.lines, synced_at = excluded.synced_at, synced_by = excluded.synced_by`,
        m, r.kind, r.number, r.date, r.due_date, r.expiry, r.total, r.balance, r.status, r.shipped, r.invoiced, r.payment_expected, r.lines, t, by); });
      run("UPDATE customers SET zoho_status = 'created', zoho_checked_at = ? WHERE mobile = ?", t, m);
      audit(by, 'Saved ' + rows.length + ' Zoho Books document' + (rows.length === 1 ? '' : 's') + ' for ' + c.name);
      return { saved: rows.length, invoices: rows.filter((r) => r.kind === 'invoice').length, orders: rows.filter((r) => r.kind === 'order').length, quotes: rows.filter((r) => r.kind === 'quote').length };
    },
    booksDocs(m0) {
      const m = mobile(m0), rows = m ? all('SELECT d.*, mm.name AS by_name FROM books_docs d LEFT JOIN members mm ON mm.id = d.synced_by WHERE d.customer_mobile = ? ORDER BY d.date DESC, d.number DESC', m) : [];
      const out = rows.map((r) => ({ kind: r.kind, number: r.number, date: r.date || '', dueDate: r.due_date || '', expiry: r.expiry || '', total: r.total, balance: r.balance, status: r.status, shipped: r.shipped, invoiced: r.invoiced, paymentExpected: r.payment_expected || '', lines: JSON.parse(r.lines || '[]') }));
      const at = rows.map((r) => r.synced_at).sort().slice(-1)[0] || '';
      return { count: rows.length, invoices: out.filter((x) => x.kind === 'invoice'), orders: out.filter((x) => x.kind === 'order'), quotes: out.filter((x) => x.kind === 'quote'), syncedAt: at, syncedBy: (rows.find((r) => r.synced_at === at) || {}).by_name || '' };
    },
    // other people at the customer's company (a buyer, an engineer, accounts...), each with their own mobile number
    saveContact(m0, input, by) {
      const m = mobile(m0), c = m && get('SELECT name FROM customers WHERE mobile = ?', m);
      if (!c) return { error: 'No customer with that mobile number', status: 404 };
      const cm = mobile(input.mobile); if (!cm) return { error: 'The contact needs a valid 10-digit mobile number (in "contact_mobile")' };
      const name = clean(input.name, 100); const old = get('SELECT * FROM customer_contacts WHERE customer_mobile = ? AND mobile = ?', m, cm);
      if (!name && !old) return { error: 'The contact needs a name' };
      const f = { name: name || old.name, role: input.role != null && clean(input.role, 60) ? clean(input.role, 60) : (old ? old.role : ''), email: input.email != null && clean(input.email, 100) ? clean(input.email, 100) : (old ? old.email : ''), notes: input.notes != null && clean(input.notes, 300) ? clean(input.notes, 300) : (old ? old.notes : '') };
      if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return { error: 'That email does not look right' };
      if (old) run('UPDATE customer_contacts SET name = ?, role = ?, email = ?, notes = ? WHERE customer_mobile = ? AND mobile = ?', f.name, f.role, f.email, f.notes, m, cm);
      else run('INSERT INTO customer_contacts (customer_mobile, mobile, name, role, email, notes, added_by, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', m, cm, f.name, f.role, f.email, f.notes, by, now());
      audit(by, (old ? 'Updated' : 'Added') + ' contact ' + f.name + ' at ' + c.name);
      return { contact: { mobile: cm, ...f }, created: !old };
    },
    removeContact(m0, cm0, by) {
      const m = mobile(m0), cm = mobile(cm0), old = m && cm && get('SELECT name FROM customer_contacts WHERE customer_mobile = ? AND mobile = ?', m, cm);
      if (!old) return { error: 'Contact not found', status: 404 };
      run('DELETE FROM customer_contacts WHERE customer_mobile = ? AND mobile = ?', m, cm); audit(by, 'DELETED contact ' + old.name);
      return { ok: true };
    },
    // who is looking after this customer; null means unassigned
    assignCustomer(m0, username, by) {
      const m = mobile(m0), c = m && get('SELECT name FROM customers WHERE mobile = ?', m);
      if (!c) return { error: 'No customer with that mobile number', status: 404 };
      let owner = null;
      if (username != null && String(username).trim() && String(username).trim().toLowerCase() !== 'unassigned') {
        const o = get('SELECT id, name FROM members WHERE (username = ? OR id = ?) AND active = 1', clean(username, 40).toLowerCase(), String(username).trim());
        if (!o) return { error: 'No active team member with that username' };
        owner = o;
      }
      run('UPDATE customers SET owner_id = ?, updated_at = ? WHERE mobile = ?', owner ? owner.id : null, now(), m);
      audit(by, owner ? 'Assigned ' + c.name + ' to ' + owner.name : 'Unassigned ' + c.name);
      return { ok: true, owner: owner ? owner.name : null };
    },
    // permanent: the customer, their history and their files. Only the admin route calls this, after a typed confirmation.
    deleteCustomer(m0, by) {
      const m = mobile(m0), c = m && get('SELECT name FROM customers WHERE mobile = ?', m);
      if (!c) return { error: 'Customer not found', status: 404 };
      const files = all('SELECT id FROM files WHERE customer_mobile = ?', m), n = get('SELECT COUNT(*) AS n FROM interactions WHERE customer_mobile = ?', m).n;
      tx(() => { run('DELETE FROM customer_contacts WHERE customer_mobile = ?', m); run('DELETE FROM books_docs WHERE customer_mobile = ?', m); run('DELETE FROM files WHERE customer_mobile = ?', m); run('DELETE FROM interactions WHERE customer_mobile = ?', m); run('DELETE FROM customers WHERE mobile = ?', m); });
      for (const f of files) { try { fs.unlinkSync(path.join(dataDir, 'files', f.id)); } catch (e) { /* already gone */ } }
      audit(by, 'DELETED customer ' + c.name + ' (' + m + ') with ' + n + ' interaction' + (n === 1 ? '' : 's') + ' and ' + files.length + ' file' + (files.length === 1 ? '' : 's'));
      return { ok: true, name: c.name, interactions: n, files: files.length };
    },
    // customers this member owns whose latest interaction asked for a follow-up on or before the given day
    followUps(mid, upTo) {
      return all("SELECT c.mobile, c.name, c.company, i.type, i.summary, i.next_date, i.at FROM customers c JOIN interactions i ON i.id = (SELECT id FROM interactions WHERE customer_mobile = c.mobile ORDER BY at DESC, rowid DESC LIMIT 1) WHERE c.owner_id = ? AND i.next_date IS NOT NULL AND i.next_date <= ? ORDER BY i.next_date", mid, upTo).map(plain);
    },
    file: (fid) => plain(get('SELECT * FROM files WHERE id = ?', fid)),
    filePath: (fid) => (/^[0-9a-f-]{36}$/.test(fid) ? path.join(dataDir, 'files', fid) : null),

    // ================= vendors (suppliers) =================
    // THE RULE: a vendor exists only with at least one of our items linked to them (their rates are then for those items)
    addVendor(input, by) {
      const m = mobile(input.mobile);
      if (!m) return { error: 'A valid 10-digit Indian mobile number is needed in the "mobile" field (it is the vendor\'s key). Received: ' + (input.mobile == null ? 'nothing' : '"' + clean(input.mobile, 30) + '"') };
      const dup = get('SELECT name FROM vendors WHERE mobile = ?', m);
      if (dup) return { error: 'A vendor with mobile ' + m + ' already exists: ' + dup.name + '. Use link_vendor_items to add the items they supply.', exists: true };
      const ids = [...new Set((Array.isArray(input.itemIds) ? input.itemIds : []).map((x) => String(x).trim()).filter(Boolean))];
      if (!ids.length) return { error: 'A vendor must supply at least one of our items, so it was not added. Find the item with search_items and send its id in item_ids. If none of our items matches what they supply, the vendor cannot be added.' };
      const bad = ids.filter((x) => !get('SELECT id FROM items WHERE id = ?', x));
      if (bad.length) return { error: 'These item ids do not exist: ' + bad.join(', ') + '. Use search_items to find the right ones.' };
      const p = profile(input); if (p.error) return p;
      if (!p.fields.name) return { error: 'The vendor needs a name' };
      const f = p.fields, t = now();
      tx(() => {
        run('INSERT INTO vendors (mobile, name, company, email, city, state, gstin, notes, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', m, f.name, f.company || '', f.email || '', f.city || '', f.state || '', f.gstin || '', clean(input.notes, 1000), by, t, t);
        for (const x of ids) run('INSERT INTO vendor_items (vendor_mobile, item_id, added_by, added_at) VALUES (?, ?, ?, ?)', m, x, by, t);
      });
      audit(by, 'Added vendor ' + f.name + ' (' + m + ') supplying ' + ids.length + ' item' + (ids.length === 1 ? '' : 's'));
      return { vendor: repo.vendor(m) };
    },
    linkVendorItems(m0, itemIds, by) {
      const m = mobile(m0), v = m && get('SELECT name FROM vendors WHERE mobile = ?', m);
      if (!v) return { error: 'No vendor with that mobile number', status: 404 };
      const ids = [...new Set((Array.isArray(itemIds) ? itemIds : []).map((x) => String(x).trim()).filter(Boolean))];
      if (!ids.length) return { error: 'Send at least one item id (from search_items)' };
      const bad = ids.filter((x) => !get('SELECT id FROM items WHERE id = ?', x));
      if (bad.length) return { error: 'These item ids do not exist: ' + bad.join(', ') + '. Use search_items to find the right ones.' };
      let added = 0; for (const x of ids) { if (!get('SELECT 1 AS x FROM vendor_items WHERE vendor_mobile = ? AND item_id = ?', m, x)) { run('INSERT INTO vendor_items (vendor_mobile, item_id, added_by, added_at) VALUES (?, ?, ?, ?)', m, x, by, now()); added++; } }
      if (added) audit(by, 'Linked ' + added + ' item' + (added === 1 ? '' : 's') + ' to vendor ' + v.name);
      return { linked: added, vendor: repo.vendor(m) };
    },
    updateVendor(m0, input, by) {
      const m = mobile(m0), v = m && get('SELECT * FROM vendors WHERE mobile = ?', m);
      if (!v) return { error: 'No vendor with that mobile number', status: 404 };
      const p = profile(input); if (p.error) return p;
      const f = { ...p.fields }; for (const k of Object.keys(f)) if (!['name', 'company', 'email', 'city', 'state', 'gstin'].includes(k)) delete f[k];
      if (input.notes != null && clean(input.notes, 1000)) f.notes = clean(input.notes, 1000);
      for (const [k, max] of Object.entries({ address: 300, about: 500, payment_terms: 100, lead_time: 100, min_order: 100 })) if (input[k] != null && clean(input[k], max)) f[k] = clean(input[k], max);
      const changed = Object.keys(f).filter((k) => f[k] !== v[k]);
      if (changed.length) { run('UPDATE vendors SET ' + changed.map((k) => k + ' = ?').join(', ') + ', updated_at = ? WHERE mobile = ?', ...changed.map((k) => f[k]), now(), m); audit(by, 'Updated vendor ' + v.name + ' (' + changed.join(', ') + ')'); }
      return { vendor: repo.vendor(m), changed };
    },
    // permanent: the vendor and every rate they gave. Only the admin route calls this, after a typed confirmation.
    deleteVendor(m0, by) {
      const m = mobile(m0), v = m && get('SELECT name FROM vendors WHERE mobile = ?', m);
      if (!v) return { error: 'Vendor not found', status: 404 };
      const n = get('SELECT COUNT(*) AS n FROM vendor_offers WHERE vendor_mobile = ?', m).n;
      const atts = all("SELECT id FROM attachments WHERE kind = 'vendor' AND key = ?", m);
      tx(() => { run("DELETE FROM notes WHERE kind = 'vendor' AND key = ?", m); run("DELETE FROM attachments WHERE kind = 'vendor' AND key = ?", m); run('DELETE FROM vendor_offers WHERE vendor_mobile = ?', m); run('DELETE FROM vendor_items WHERE vendor_mobile = ?', m); run('DELETE FROM vendors WHERE mobile = ?', m); });
      for (const a of atts) { try { fs.unlinkSync(path.join(dataDir, 'files', a.id)); } catch (e) { /* already gone */ } }
      audit(by, 'DELETED vendor ' + v.name + ' (' + m + ') with ' + n + ' rate' + (n === 1 ? '' : 's'));
      return { ok: true, name: v.name, rates: n };
    },
    vendors({ q } = {}) {
      const term = clean(q, 60).toLowerCase(), dg = String(q || '').replace(/\D/g, '');
      const rows = all(`SELECT v.*, (SELECT COUNT(*) FROM vendor_offers o WHERE o.vendor_mobile = v.mobile) AS offers, (SELECT MAX(offer_date) FROM vendor_offers o WHERE o.vendor_mobile = v.mobile) AS last_offer,
          (SELECT COUNT(*) FROM vendor_items vi WHERE vi.vendor_mobile = v.mobile) AS materials FROM vendors v ORDER BY COALESCE(last_offer, v.created_at) DESC`).map(plain);
      if (!term) return rows;
      const withItem = new Set(all('SELECT DISTINCT vi.vendor_mobile FROM vendor_items vi JOIN items i ON i.id = vi.item_id WHERE lower(i.name) LIKE ? ESCAPE \'\\\' OR lower(i.sku) LIKE ? ESCAPE \'\\\' OR lower(i.category) LIKE ? ESCAPE \'\\\'', like(term), like(term), like(term)).map((r) => r.vendor_mobile));
      const withText = new Set(all('SELECT DISTINCT vendor_mobile FROM vendor_offers WHERE lower(item_text) LIKE ? ESCAPE \'\\\'', like(term)).map((r) => r.vendor_mobile));
      return rows.filter((v) => [v.name, v.company, v.city, v.state, v.notes, v.gstin].some((x) => String(x).toLowerCase().includes(term)) || (dg.length >= 3 && v.mobile.includes(dg)) || withText.has(v.mobile) || withItem.has(v.mobile));
    },
    vendor(m0) {
      const m = mobile(m0), v = m && get('SELECT v.*, cb.name AS created_by_name FROM vendors v LEFT JOIN members cb ON cb.id = v.created_by WHERE v.mobile = ?', m);
      if (!v) return null;
      const offers = all('SELECT o.*, i.name AS item_name, i.sku AS item_sku, mm.name AS by_name FROM vendor_offers o LEFT JOIN items i ON i.id = o.item_id LEFT JOIN members mm ON mm.id = o.by_member WHERE o.vendor_mobile = ? ORDER BY o.offer_date DESC, o.at DESC, o.rowid DESC', m).map(plain);
      const seen = new Set(), latest = [];
      for (const o of offers) { const k = o.item_id || 'text:' + o.item_text.toLowerCase(); if (!seen.has(k)) { seen.add(k); latest.push(o); } }
      const rate = new Map(latest.filter((o) => o.item_id).map((o) => [o.item_id, o]));
      const items = all('SELECT i.id, i.name, i.sku, i.category FROM vendor_items vi JOIN items i ON i.id = vi.item_id WHERE vi.vendor_mobile = ? ORDER BY i.name COLLATE NOCASE', m).map((i) => ({ ...plain(i), rate: rate.has(i.id) ? rate.get(i.id).rate : null, unit: rate.has(i.id) ? rate.get(i.id).unit : '', offer_date: rate.has(i.id) ? rate.get(i.id).offer_date : '' }));
      return { ...v, offers, latest, items, notes_list: repo.notes('vendor', m), attachments: repo.attachments('vendor', m), log: repo.events({ vendorMobile: m, limit: 80 }) };
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
      return { ...plain(r), collections: JSON.parse(r.collections || '[]'), suppliers: repo.findSuppliers({ itemId: r.id }), notes: repo.notes('item', r.id), attachments: repo.attachments('item', r.id), log: repo.events({ itemId: r.id, limit: 80 }) };
    },
    // the items grouped by the collections set up in Zoho Commerce (18650, 21700...), with how many vendors can supply each
    collections() {
      const list = repo.items(), by = new Map();
      for (const it of list) for (const c of (it.collections.length ? it.collections : ['Not in a collection'])) { if (!by.has(c)) by.set(c, []); by.get(c).push(it); }
      const vend = all('SELECT item_id, COUNT(*) AS n FROM vendor_items GROUP BY item_id'), vendorsOf = new Map(vend.map((r) => [r.item_id, r.n]));
      return [...by.entries()].map(([name, items]) => ({ name, items: items.map((i) => ({ id: i.id, name: i.name, sku: i.sku, category: i.category, price: i.price, stock: i.stock, unit: i.unit, image_url: i.image_url, best: i.best, vendors: vendorsOf.get(i.id) || 0 })), vendors: items.reduce((n, i) => n + (vendorsOf.get(i.id) || 0), 0) }))
        .sort((a, b) => (a.name === 'Not in a collection') - (b.name === 'Not in a collection') || a.name.localeCompare(b.name, 'en', { numeric: true }));
    },
    // ---- notes and attachments on a vendor (key = mobile) or an item (key = id) ----
    subject(kind, key) {
      if (kind === 'vendor') { const m = mobile(key); return m ? (get('SELECT mobile AS key, name FROM vendors WHERE mobile = ?', m) || null) : null; }
      if (kind === 'item') return get('SELECT id AS key, name FROM items WHERE id = ?', String(key || '')) || null;
      return null;
    },
    addNote(kind, key, text, by) {
      const sub = repo.subject(kind, key); if (!sub) return { error: kind === 'vendor' || kind === 'item' ? 'No such ' + kind + '. For a vendor use their mobile number, for an item its id from search_items.' : 'kind must be vendor or item', status: 404 };
      const t = clean(text, 2000); if (!t) return { error: 'Write the note' };
      const n = { id: id(), kind, key: sub.key, text: t, by_member: by, at: now() };
      run('INSERT INTO notes (id, kind, key, text, by_member, at) VALUES (?, ?, ?, ?, ?, ?)', n.id, n.kind, n.key, n.text, n.by_member, n.at);
      audit(by, 'Added a note on ' + kind + ' ' + sub.name);
      return { note: n, subject: sub.name };
    },
    notes: (kind, key) => all('SELECT n.id, n.text, n.at, mm.name AS by_name FROM notes n LEFT JOIN members mm ON mm.id = n.by_member WHERE n.kind = ? AND n.key = ? ORDER BY n.at DESC, n.rowid DESC', kind, String(key)).map(plain),
    deleteNote(nid, by) { const n = get('SELECT id FROM notes WHERE id = ?', String(nid || '')); if (!n) return { error: 'Note not found', status: 404 }; run('DELETE FROM notes WHERE id = ?', n.id); audit(by, 'DELETED a note'); return { ok: true }; },
    addAttachment({ kind, key, name, note, buffer }, by) {
      const sub = repo.subject(kind, key); if (!sub) return { error: kind === 'vendor' || kind === 'item' ? 'No such ' + kind + '. For a vendor use their mobile number, for an item its id from search_items.' : 'kind must be vendor or item', status: 404 };
      if (buffer && buffer.length > 10 * 1024 * 1024) return { error: 'The file is too big (10 MB at most)' };
      const ck = filecheck.check(name, buffer); if (!ck.ok) return { error: ck.error };
      const nt = clean(note, 240); if (nt.length < 8) return { error: NOTE_ERR };
      const a = { id: id(), kind, key: sub.key, name: clean(name, 150).replace(/[\\/:*?"<>|]/g, '') || 'file', mime: ck.mime, size: buffer.length, note: nt, by_member: by, at: now() };
      fs.writeFileSync(path.join(dataDir, 'files', a.id), buffer);
      run('INSERT INTO attachments (id, kind, key, name, mime, size, note, by_member, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', a.id, a.kind, a.key, a.name, a.mime, a.size, a.note, a.by_member, a.at);
      audit(by, 'Attached ' + a.name + ' to ' + kind + ' ' + sub.name);
      return { attachment: a, subject: sub.name };
    },
    attachments: (kind, key) => all('SELECT a.id, a.name, a.mime, a.size, a.note, a.at, mm.name AS by_name FROM attachments a LEFT JOIN members mm ON mm.id = a.by_member WHERE a.kind = ? AND a.key = ? ORDER BY a.at DESC', kind, String(key)).map(plain),
    attachment: (aid) => plain(get('SELECT * FROM attachments WHERE id = ?', String(aid || ''))),
    deleteAttachment(aid, by) {
      const a = get('SELECT id, name FROM attachments WHERE id = ?', String(aid || '')); if (!a) return { error: 'Attachment not found', status: 404 };
      run('DELETE FROM attachments WHERE id = ?', a.id); try { fs.unlinkSync(path.join(dataDir, 'files', a.id)); } catch (e) { /* already gone */ }
      audit(by, 'DELETED attachment ' + a.name); return { ok: true };
    },
    // every update on vendors and items, newest first: rates, notes, attachments, and who was linked to what. Narrow it to one item or one vendor.
    events({ itemId, vendorMobile, limit = 60 } = {}) {
      const out = [], inr = (n) => '\u20B9' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }), dmy = (d) => String(d || '').slice(0, 10).split('-').reverse().join('-');
      const vm = vendorMobile ? mobile(vendorMobile) : null;
      const vname = new Map(all('SELECT mobile, name FROM vendors').map((r) => [r.mobile, r.name])), iname = new Map(all('SELECT id, name FROM items').map((r) => [r.id, r.name]));
      const who = (k, key) => (k === 'vendor' ? { vendor: { mobile: key, name: vname.get(key) || key } } : { item: { id: key, name: iname.get(key) || key } });
      for (const o of all('SELECT o.*, mm.name AS by_name FROM vendor_offers o LEFT JOIN members mm ON mm.id = o.by_member ORDER BY o.at DESC LIMIT 400')) {
        if ((itemId && o.item_id !== itemId) || (vm && o.vendor_mobile !== vm)) continue;
        out.push({ at: o.at, type: 'rate', by: o.by_name || '', vendor: { mobile: o.vendor_mobile, name: vname.get(o.vendor_mobile) || '' }, item: o.item_id ? { id: o.item_id, name: iname.get(o.item_id) || o.item_text } : null,
          title: (vname.get(o.vendor_mobile) || 'A vendor') + ' gave a rate' + (o.item_id ? ' for ' + (iname.get(o.item_id) || o.item_text) : ''), text: inr(o.rate) + (o.unit ? ' / ' + o.unit : '') + (o.quantity ? ' \u00B7 ' + o.quantity + ' available' : '') + (o.valid_till ? ' \u00B7 valid till ' + dmy(o.valid_till) : '') + (o.note ? ' \u00B7 ' + o.note : '') });
      }
      for (const n of all('SELECT n.*, mm.name AS by_name FROM notes n LEFT JOIN members mm ON mm.id = n.by_member ORDER BY n.at DESC LIMIT 300')) {
        if ((itemId && !(n.kind === 'item' && n.key === itemId)) || (vm && !(n.kind === 'vendor' && n.key === vm))) continue;
        out.push({ at: n.at, type: 'note', by: n.by_name || '', ...who(n.kind, n.key), title: 'Note on ' + (n.kind === 'vendor' ? vname.get(n.key) : iname.get(n.key)), text: n.text });
      }
      for (const a of all('SELECT a.*, mm.name AS by_name FROM attachments a LEFT JOIN members mm ON mm.id = a.by_member ORDER BY a.at DESC LIMIT 300')) {
        if ((itemId && !(a.kind === 'item' && a.key === itemId)) || (vm && !(a.kind === 'vendor' && a.key === vm))) continue;
        out.push({ at: a.at, type: 'file', by: a.by_name || '', ...who(a.kind, a.key), attachment: a.id, mime: a.mime, title: 'File added to ' + (a.kind === 'vendor' ? vname.get(a.key) : iname.get(a.key)), text: a.name + (a.note ? ' \u00B7 ' + a.note : '') });
      }
      for (const l of all('SELECT vi.*, mm.name AS by_name FROM vendor_items vi LEFT JOIN members mm ON mm.id = vi.added_by ORDER BY vi.added_at DESC LIMIT 300')) {
        if ((itemId && l.item_id !== itemId) || (vm && l.vendor_mobile !== vm)) continue;
        out.push({ at: l.added_at, type: 'link', by: l.by_name || '', vendor: { mobile: l.vendor_mobile, name: vname.get(l.vendor_mobile) || '' }, item: { id: l.item_id, name: iname.get(l.item_id) || '' }, title: (vname.get(l.vendor_mobile) || 'A vendor') + ' now supplies', text: iname.get(l.item_id) || '' });
      }
      if (!itemId) for (const v of all('SELECT v.mobile, v.name, v.created_at, mm.name AS by_name FROM vendors v LEFT JOIN members mm ON mm.id = v.created_by')) {
        if (vm && v.mobile !== vm) continue;
        out.push({ at: v.created_at, type: 'vendor', by: v.by_name || '', vendor: { mobile: v.mobile, name: v.name }, item: null, title: 'Vendor added', text: v.name });
      }
      return out.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, limit);
    },
    // best-scoring items for some words ("nickel strip 0.15"): every word has to appear, shorter names first
    categoryOfName(name) {
      const key = String(name || '').trim().toLowerCase(); if (!key) return 'Other';
      const exact = get('SELECT category FROM items WHERE lower(name) = ? OR lower(sku) = ?', key, key);
      if (exact && exact.category) return exact.category;
      const hits = repo.searchItems(name, 3);
      return hits.length === 1 && hits[0].category ? hits[0].category : 'Other';
    },
    searchItems(q, limit = 10) {
      const words = tokens(q); if (!words.length) return [];
      return all('SELECT id, sku, name, category, price, stock, unit FROM items').filter((r) => { const h = (r.name + ' ' + r.sku + ' ' + r.category).toLowerCase(); return words.every((w) => h.includes(w)); })
        .sort((a, b) => a.name.length - b.name.length).slice(0, limit).map(plain);
    },

    // ================= vendor rates =================
    // a vendor says "I have this material at this rate". It must be for one of our items: given by id, or named so that exactly one matches.
    // Anything else is refused (not saved), and the answer lists the candidates.
    addOffer({ vendorMobile, itemId, itemText, rate, unit, quantity, validTill, note, offerDate }, by) {
      const vm = mobile(vendorMobile), v = vm && get('SELECT name FROM vendors WHERE mobile = ?', vm);
      if (!v) return { error: 'No vendor with that mobile number. Add the vendor first (with the items they supply).', status: 404 };
      const r = Number(rate); if (!(r > 0)) return { error: 'The rate must be a number above zero' };
      for (const [k, d] of [['validTill', validTill], ['offerDate', offerDate]]) if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: k + ' must look like 2026-12-31' };
      let item = itemId ? get('SELECT id, name FROM items WHERE id = ?', String(itemId)) : null;
      if (itemId && !item) return { error: 'That item id does not exist. Use search_items to find it.' };
      const text = clean(itemText || (item && item.name), 200);
      if (!item) {
        if (!text) return { error: 'Say which of our items it is: its item_id from search_items, or its name.' };
        const candidates = repo.searchItems(text, 5);
        if (candidates.length !== 1) return { error: candidates.length ? 'More than one of our items matches "' + text + '": ' + candidates.map((c) => c.name + ' (item_id ' + c.id + ')').join('; ') + '. Send the right item_id. Nothing was saved.' : 'None of our items matches "' + text + '". A rate has to be for one of our items, so nothing was saved. Use search_items with different words.', candidates };
        item = { id: candidates[0].id, name: candidates[0].name };
      }
      const o = { id: id(), vendor_mobile: vm, item_id: item.id, item_text: text, rate: r, unit: clean(unit, 20), quantity: clean(quantity, 60), valid_till: validTill || null, note: clean(note, 500), offer_date: offerDate || new Date().toISOString().slice(0, 10), by_member: by, at: now() };
      tx(() => {
        run('INSERT INTO vendor_offers (id, vendor_mobile, item_id, item_text, rate, unit, quantity, valid_till, note, offer_date, by_member, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', o.id, o.vendor_mobile, o.item_id, o.item_text, o.rate, o.unit, o.quantity, o.valid_till, o.note, o.offer_date, o.by_member, o.at);
        if (!get('SELECT 1 AS x FROM vendor_items WHERE vendor_mobile = ? AND item_id = ?', vm, item.id)) run('INSERT INTO vendor_items (vendor_mobile, item_id, added_by, added_at) VALUES (?, ?, ?, ?)', vm, item.id, by, now());
      });
      audit(by, 'Rate from ' + v.name + ': ' + item.name + ' at ' + r);
      return { offer: o, mappedTo: item, candidates: [] };
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
      // vendors who supply the item but have not given a rate yet
      for (const l of all('SELECT vi.vendor_mobile, vi.item_id, v.name AS vendor_name, v.company AS vendor_company, v.city AS vendor_city, i.name AS item_name FROM vendor_items vi JOIN vendors v ON v.mobile = vi.vendor_mobile JOIN items i ON i.id = vi.item_id')) {
        if (!ids.includes(l.item_id) || seen.has(l.vendor_mobile + '|' + l.item_id)) continue;
        out.push({ vendor_mobile: l.vendor_mobile, vendor_name: l.vendor_name, vendor_company: l.vendor_company, vendor_city: l.vendor_city, item_id: l.item_id, item: l.item_name, linked: true, rate: null, unit: '', quantity: '', valid_till: null, offered_on: '', note: 'No rate given yet', expired: false, offer_id: null });
      }
      return out.sort((a, b) => (a.rate == null) - (b.rate == null) || a.expired - b.expired || a.rate - b.rate);
    },
  };
  return repo;
};
module.exports.mobile = mobile;
module.exports.ENUMS = { SOURCES, BUYER_TYPES, BUSINESSES, URGENCY, TYPES };
