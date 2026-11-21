// The database: SQLite in one file (DATA_DIR/directory.db) plus listing photos on disk (DATA_DIR/photos).
// Every change to data is one small function here; app.js only routes and checks who is signed in.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
// Node 22.13+ has SQLite built in; the droplets run Node 20, where the better-sqlite3 package does the same job (same calls)
let Database;
try { Database = require('node:sqlite').DatabaseSync; } catch (e) { Database = require('better-sqlite3'); }
const filecheck = require('./filecheck');
const { STATES } = require('./india');

const CHEMISTRIES = ['LiFePO4', 'NMC', 'LTO', 'Li-ion (other)', 'Li-polymer'];
const PHOTO_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const MAX_PHOTOS = 6, MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const DEFAULT_CATEGORIES = ['Battery packs', 'E-scooter batteries', 'E-bike batteries', 'Solar and storage batteries', 'Cells', 'BMS and chargers', 'Electric scooters'];

const now = () => new Date().toISOString();
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const num = (v) => { if (v === '' || v == null) return null; const n = Number(String(v).replace(/,/g, '')); return Number.isFinite(n) && n >= 0 ? n : NaN; };
const mobile10 = (v) => { const d = String(v || '').replace(/\D/g, '').slice(-10); return /^[6-9]\d{9}$/.test(d) ? d : ''; };
const slugify = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

function open(dataDir) {
  fs.mkdirSync(path.join(dataDir, 'photos'), { recursive: true });
  const db = new Database(path.join(dataDir, 'directory.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS sellers (
      mobile TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', business TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', state TEXT NOT NULL DEFAULT '',
      about TEXT NOT NULL DEFAULT '', trusted INTEGER NOT NULL DEFAULT 0, suspended INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, last_login TEXT
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, created_by TEXT NOT NULL DEFAULT '', at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT, seller_mobile TEXT NOT NULL REFERENCES sellers(mobile), category_id INTEGER NOT NULL REFERENCES categories(id),
      title TEXT NOT NULL, brand TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', price INTEGER, price_unit TEXT NOT NULL DEFAULT 'per piece',
      min_order TEXT NOT NULL DEFAULT '', warranty TEXT NOT NULL DEFAULT '', chemistry TEXT NOT NULL DEFAULT '', voltage REAL, capacity_ah REAL, energy_wh REAL,
      state TEXT NOT NULL, city TEXT NOT NULL, whatsapp TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'hidden')),
      views INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS listings_status ON listings(status, created_at);
    CREATE INDEX IF NOT EXISTS listings_seller ON listings(seller_mobile);
    CREATE INDEX IF NOT EXISTS listings_cat ON listings(category_id, status);
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE, file TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, pos INTEGER NOT NULL DEFAULT 0, at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS photos_listing ON photos(listing_id, pos);
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT, listing_id INTEGER, seller_mobile TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS leads_seller ON leads(seller_mobile, at);
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, by_mobile TEXT NOT NULL, action TEXT NOT NULL);
  `);
  const get = (sql, ...a) => db.prepare(sql).get(...a);
  const all = (sql, ...a) => db.prepare(sql).all(...a);
  const run = (sql, ...a) => db.prepare(sql).run(...a);
  const plain = (r) => (r ? { ...r } : r);
  const audit = (by, action) => run('INSERT INTO audit (at, by_mobile, action) VALUES (?, ?, ?)', now(), String(by || ''), action);

  if (!get('SELECT id FROM categories LIMIT 1')) for (const n of DEFAULT_CATEGORIES) run('INSERT INTO categories (name, slug, created_by, at) VALUES (?, ?, ?, ?)', n, slugify(n), 'system', now());

  const LISTING_SELECT = `SELECT l.*, c.name AS category_name, c.slug AS category_slug, s.business AS seller_business, s.name AS seller_name, s.city AS seller_city, s.state AS seller_state, s.about AS seller_about, s.created_at AS seller_since,
      (SELECT id FROM photos p WHERE p.listing_id = l.id ORDER BY p.pos, p.id LIMIT 1) AS cover_id,
      (SELECT COUNT(*) FROM photos p WHERE p.listing_id = l.id) AS photo_count,
      (SELECT COUNT(*) FROM leads x WHERE x.listing_id = l.id) AS leads
    FROM listings l JOIN categories c ON c.id = l.category_id JOIN sellers s ON s.mobile = l.seller_mobile`;

  function checkListing(input, seller) {
    const t = {};
    t.title = clean(input.title, 120); if (t.title.length < 5) return { error: 'Give the product a name (at least 5 characters)' };
    t.category_id = Number(input.category_id); if (!get('SELECT id FROM categories WHERE id = ?', t.category_id)) return { error: 'Choose a category' };
    t.brand = clean(input.brand, 60);
    t.description = clean(input.description, 2000); if (t.description.length < 20) return { error: 'Describe the product in a few lines (at least 20 characters)' };
    const price = num(input.price); if (Number.isNaN(price) || (price != null && price > 99999999)) return { error: 'Enter the price as a number, or leave it empty for "price on request"' };
    t.price = price == null ? null : Math.round(price);
    t.price_unit = clean(input.price_unit, 20) || 'per piece';
    t.min_order = clean(input.min_order, 60); t.warranty = clean(input.warranty, 60);
    t.chemistry = clean(input.chemistry, 20); if (t.chemistry && !CHEMISTRIES.includes(t.chemistry)) return { error: 'Choose the chemistry from the list' };
    const v = num(input.voltage), ah = num(input.capacity_ah);
    if (Number.isNaN(v) || (v != null && v > 1000)) return { error: 'Voltage must be a number (up to 1000 V)' };
    if (Number.isNaN(ah) || (ah != null && ah > 10000)) return { error: 'Capacity must be a number in Ah' };
    t.voltage = v; t.capacity_ah = ah;
    let wh = num(input.energy_wh); if (Number.isNaN(wh)) return { error: 'Energy must be a number in Wh' };
    if (wh == null && v != null && ah != null) wh = Math.round(v * ah * 10) / 10;
    t.energy_wh = wh;
    t.state = clean(input.state, 40); if (!STATES.includes(t.state)) return { error: 'Choose the state' };
    t.city = clean(input.city, 60); if (t.city.length < 2) return { error: 'Enter the city' };
    t.whatsapp = mobile10(input.whatsapp || seller); if (!t.whatsapp) return { error: 'Enter a valid 10-digit WhatsApp number' };
    return { ok: t };
  }

  const repo = {
    db, CHEMISTRIES, STATES, MAX_PHOTOS, MAX_PHOTO_BYTES, mobile10, slugify, clean, close: () => db.close(),
    audit, auditLog: (n = 50) => all('SELECT at, by_mobile, action FROM audit ORDER BY id DESC LIMIT ?', n).map(plain),

    // ---- sellers ----
    seller: (m) => plain(get('SELECT * FROM sellers WHERE mobile = ?', String(m || ''))),
    touchSeller(m) {
      if (!get('SELECT mobile FROM sellers WHERE mobile = ?', m)) run('INSERT INTO sellers (mobile, created_at, last_login) VALUES (?, ?, ?)', m, now(), now());
      else run('UPDATE sellers SET last_login = ? WHERE mobile = ?', now(), m);
      return repo.seller(m);
    },
    updateSeller(m, input) {
      const name = clean(input.name, 60), business = clean(input.business, 80), city = clean(input.city, 60), state = clean(input.state, 40), about = clean(input.about, 600);
      if (name.length < 2) return { error: 'Enter your name' };
      if (business.length < 2) return { error: 'Enter your business or brand name' };
      if (state && !STATES.includes(state)) return { error: 'Choose the state' };
      run('UPDATE sellers SET name = ?, business = ?, city = ?, state = ?, about = ? WHERE mobile = ?', name, business, city, state, about, m);
      return { seller: repo.seller(m) };
    },
    sellers: () => all(`SELECT s.*, (SELECT COUNT(*) FROM listings l WHERE l.seller_mobile = s.mobile) AS listings, (SELECT COUNT(*) FROM listings l WHERE l.seller_mobile = s.mobile AND l.status = 'live') AS live,
        (SELECT COUNT(*) FROM leads x WHERE x.seller_mobile = s.mobile) AS leads FROM sellers s ORDER BY s.created_at DESC`).map(plain),
    setSeller(m, f, by) {
      const s = repo.seller(m); if (!s) return { error: 'Seller not found', status: 404 };
      if (f.suspended !== undefined) { run('UPDATE sellers SET suspended = ? WHERE mobile = ?', f.suspended ? 1 : 0, m); audit(by, (f.suspended ? 'Suspended ' : 'Restored ') + m); }
      if (f.trusted !== undefined) { run('UPDATE sellers SET trusted = ? WHERE mobile = ?', f.trusted ? 1 : 0, m); audit(by, (f.trusted ? 'Trusted ' : 'Un-trusted ') + m); }
      if (f.name !== undefined || f.business !== undefined || f.city !== undefined || f.state !== undefined || f.about !== undefined) {
        const r = repo.updateSeller(m, { name: f.name ?? s.name, business: f.business ?? s.business, city: f.city ?? s.city, state: f.state ?? s.state, about: f.about ?? s.about });
        if (r.error) return r; audit(by, 'Edited the details of ' + m);
      }
      return { seller: repo.seller(m) };
    },

    // ---- categories ----
    categories: () => all(`SELECT c.id, c.name, c.slug, c.created_by, (SELECT COUNT(*) FROM listings l JOIN sellers s ON s.mobile = l.seller_mobile WHERE l.category_id = c.id AND l.status = 'live' AND s.suspended = 0) AS live,
        (SELECT COUNT(*) FROM listings l WHERE l.category_id = c.id) AS total FROM categories c ORDER BY c.name COLLATE NOCASE`).map(plain),
    categoryBySlug: (slug) => plain(get('SELECT * FROM categories WHERE slug = ?', String(slug || ''))),
    addCategory(name, by) {
      name = clean(name, 40).replace(/\s+/g, ' '); if (name.length < 3) return { error: 'Give the category a name (at least 3 characters)' };
      const slug = slugify(name); if (!slug) return { error: 'Give the category a name' };
      const dup = get('SELECT * FROM categories WHERE slug = ? OR lower(name) = lower(?)', slug, name); if (dup) return { category: plain(dup), existing: true };
      const recent = get("SELECT COUNT(*) AS n FROM categories WHERE created_by = ? AND at > ?", by, new Date(Date.now() - 86400000).toISOString());
      if (by !== 'admin' && recent.n >= 3) return { error: 'You can add up to 3 new categories a day. Choose an existing one.' };
      const r = run('INSERT INTO categories (name, slug, created_by, at) VALUES (?, ?, ?, ?)', name, slug, by, now());
      return { category: plain(get('SELECT * FROM categories WHERE id = ?', Number(r.lastInsertRowid))) };
    },
    renameCategory(id, name, by) {
      name = clean(name, 40).replace(/\s+/g, ' '); const slug = slugify(name); if (name.length < 3 || !slug) return { error: 'Give the category a name (at least 3 characters)' };
      const c = get('SELECT * FROM categories WHERE id = ?', Number(id)); if (!c) return { error: 'Category not found', status: 404 };
      if (get('SELECT id FROM categories WHERE slug = ? AND id <> ?', slug, c.id)) return { error: 'A category with that name already exists' };
      run('UPDATE categories SET name = ?, slug = ? WHERE id = ?', name, slug, c.id); audit(by, 'Renamed category ' + c.name + ' to ' + name); return { ok: true };
    },
    deleteCategory(id, by) {
      const c = get('SELECT * FROM categories WHERE id = ?', Number(id)); if (!c) return { error: 'Category not found', status: 404 };
      if (get('SELECT id FROM listings WHERE category_id = ? LIMIT 1', c.id)) return { error: 'Move or remove the listings in this category first' };
      run('DELETE FROM categories WHERE id = ?', c.id); audit(by, 'Removed category ' + c.name); return { ok: true };
    },

    // ---- listings ----
    // adminBy: the admin adding a product for a seller (no profile or daily limit needed, and it goes live at once)
    createListing(mobile, input, adminBy) {
      const s = repo.seller(mobile); if (!s || (s.suspended && !adminBy)) return { error: 'This account cannot add products', status: 403 };
      if (!adminBy && (!s.name || !s.business)) return { error: 'Add your name and business name first (Profile)' };
      const recent = get('SELECT COUNT(*) AS n FROM listings WHERE seller_mobile = ? AND created_at > ?', mobile, new Date(Date.now() - 86400000).toISOString());
      if (!adminBy && recent.n >= 30) return { error: 'You can add up to 30 products a day. Try again tomorrow.' };
      const c = checkListing(input, mobile); if (c.error) return c;
      const t = c.ok, status = adminBy || s.trusted ? 'live' : 'pending', ts = now();
      const r = run(`INSERT INTO listings (seller_mobile, category_id, title, brand, description, price, price_unit, min_order, warranty, chemistry, voltage, capacity_ah, energy_wh, state, city, whatsapp, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, mobile, t.category_id, t.title, t.brand, t.description, t.price, t.price_unit, t.min_order, t.warranty, t.chemistry, t.voltage, t.capacity_ah, t.energy_wh, t.state, t.city, t.whatsapp, status, ts, ts);
      if (adminBy) audit(adminBy, 'Added product ' + t.title + ' for ' + mobile);
      return { id: Number(r.lastInsertRowid), status };
    },
    // the admin onboards a seller by hand (the seller can then log in with this mobile number)
    addSellerByAdmin(input, by) {
      const m = mobile10(input.mobile); if (!m) return { error: 'Enter a valid 10-digit mobile number' };
      if (repo.seller(m)) return { error: 'This mobile number is already a seller', status: 400 };
      run('INSERT INTO sellers (mobile, created_at) VALUES (?, ?)', m, now());
      const r = repo.updateSeller(m, input); if (r.error) { run('DELETE FROM sellers WHERE mobile = ?', m); return r; }
      audit(by, 'Added seller ' + m); return { seller: r.seller };
    },
    // by is the seller's own mobile, or 'admin' (the admin may change anything)
    updateListing(id, input, by, isAdmin) {
      const l = get('SELECT * FROM listings WHERE id = ?', Number(id)); if (!l) return { error: 'Product not found', status: 404 };
      if (!isAdmin && l.seller_mobile !== by) return { error: 'Not your product', status: 403 };
      const c = checkListing({ ...l, ...input }, l.seller_mobile); if (c.error) return c; const t = c.ok;
      run(`UPDATE listings SET category_id = ?, title = ?, brand = ?, description = ?, price = ?, price_unit = ?, min_order = ?, warranty = ?, chemistry = ?, voltage = ?, capacity_ah = ?, energy_wh = ?, state = ?, city = ?, whatsapp = ?, updated_at = ? WHERE id = ?`,
        t.category_id, t.title, t.brand, t.description, t.price, t.price_unit, t.min_order, t.warranty, t.chemistry, t.voltage, t.capacity_ah, t.energy_wh, t.state, t.city, t.whatsapp, now(), l.id);
      if (isAdmin) audit(by, 'Edited product ' + l.id + ' ' + t.title);
      return { ok: true };
    },
    // the seller can hide or show their own product; only the admin can approve (which also makes the seller trusted)
    setListingStatus(id, status, by, isAdmin) {
      const l = get('SELECT * FROM listings WHERE id = ?', Number(id)); if (!l) return { error: 'Product not found', status: 404 };
      if (!['live', 'hidden', 'pending'].includes(status)) return { error: 'Unknown status' };
      if (!isAdmin) {
        if (l.seller_mobile !== by) return { error: 'Not your product', status: 403 };
        if (status === 'live' && l.status === 'pending') return { error: 'This product is waiting for review' };
        if (status === 'live' && !repo.seller(by).trusted && l.status !== 'hidden') return { error: 'Not allowed' };
        if (status === 'pending') return { error: 'Not allowed' };
      }
      run('UPDATE listings SET status = ?, updated_at = ? WHERE id = ?', status, now(), l.id);
      if (isAdmin) { if (status === 'live') run('UPDATE sellers SET trusted = 1 WHERE mobile = ? AND suspended = 0', l.seller_mobile); audit(by, 'Set product ' + l.id + ' ' + l.title + ' to ' + status); }
      return { ok: true };
    },
    deleteListing(id, by, isAdmin) {
      const l = get('SELECT * FROM listings WHERE id = ?', Number(id)); if (!l) return { error: 'Product not found', status: 404 };
      if (!isAdmin && l.seller_mobile !== by) return { error: 'Not your product', status: 403 };
      for (const p of all('SELECT file FROM photos WHERE listing_id = ?', l.id)) { try { fs.unlinkSync(path.join(dataDir, 'photos', p.file)); } catch (e) { /* already gone */ } }
      run('DELETE FROM photos WHERE listing_id = ?', l.id); run('DELETE FROM listings WHERE id = ?', l.id);
      audit(by, 'Deleted product ' + l.id + ' ' + l.title); return { ok: true };
    },
    listing(id) {
      const l = plain(get(LISTING_SELECT + ' WHERE l.id = ?', Number(id))); if (!l) return null;
      l.photos = all('SELECT id, pos FROM photos WHERE listing_id = ? ORDER BY pos, id', l.id).map(plain); return l;
    },
    liveListing(id) { const l = repo.listing(id); return l && l.status === 'live' && !repo.seller(l.seller_mobile).suspended ? l : null; },
    viewed: (id) => run('UPDATE listings SET views = views + 1 WHERE id = ?', Number(id)),
    // public search: only live products of sellers who are not suspended
    search({ q, category, state, chemistry, minPrice, maxPrice, minVoltage, maxVoltage, sort, page = 1, perPage = 24 } = {}) {
      const where = ["l.status = 'live'", 's.suspended = 0'], a = [];
      const words = clean(q, 80).toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
      for (const w of words) { where.push("(lower(l.title) LIKE ? OR lower(l.brand) LIKE ? OR lower(l.description) LIKE ? OR lower(l.city) LIKE ? OR lower(l.chemistry) LIKE ? OR lower(c.name) LIKE ? OR lower(s.business) LIKE ?)"); const p = '%' + w.replace(/[%_]/g, '') + '%'; a.push(p, p, p, p, p, p, p); }
      if (category) { where.push('c.slug = ?'); a.push(String(category)); }
      if (state) { where.push('l.state = ?'); a.push(String(state)); }
      if (chemistry) { where.push('l.chemistry = ?'); a.push(String(chemistry)); }
      const pmin = num(minPrice), pmax = num(maxPrice), vmin = num(minVoltage), vmax = num(maxVoltage);
      if (pmin) { where.push('l.price >= ?'); a.push(pmin); } if (pmax) { where.push('l.price <= ?'); a.push(pmax); }
      if (vmin) { where.push('l.voltage >= ?'); a.push(vmin); } if (vmax) { where.push('l.voltage <= ?'); a.push(vmax); }
      const order = sort === 'price_asc' ? 'l.price IS NULL, l.price ASC' : sort === 'price_desc' ? 'l.price DESC' : 'l.created_at DESC';
      const from = ' FROM listings l JOIN categories c ON c.id = l.category_id JOIN sellers s ON s.mobile = l.seller_mobile WHERE ' + where.join(' AND ');
      const total = get('SELECT COUNT(*) AS n' + from, ...a).n, pg = Math.max(1, Number(page) || 1);
      const rows = all(LISTING_SELECT + ' WHERE ' + where.join(' AND ') + ' ORDER BY ' + order + ' LIMIT ? OFFSET ?', ...a, perPage, (pg - 1) * perPage).map(plain);
      return { rows, total, page: pg, pages: Math.max(1, Math.ceil(total / perPage)) };
    },
    related: (l) => all(LISTING_SELECT + " WHERE l.status = 'live' AND s.suspended = 0 AND l.category_id = ? AND l.id <> ? ORDER BY l.created_at DESC LIMIT 4", l.category_id, l.id).map(plain),
    states: () => all("SELECT l.state, COUNT(*) AS n FROM listings l JOIN sellers s ON s.mobile = l.seller_mobile WHERE l.status = 'live' AND s.suspended = 0 GROUP BY l.state ORDER BY n DESC").map(plain),
    sellerListings: (m) => all(LISTING_SELECT + ' WHERE l.seller_mobile = ? ORDER BY l.created_at DESC', m).map(plain),
    adminListings({ status, q } = {}) {
      const where = ['1 = 1'], a = [];
      if (['pending', 'live', 'hidden'].includes(status)) { where.push('l.status = ?'); a.push(status); }
      if (q) { where.push("(lower(l.title) LIKE ? OR l.seller_mobile LIKE ? OR lower(s.business) LIKE ?)"); const p = '%' + clean(q, 60).toLowerCase().replace(/[%_]/g, '') + '%'; a.push(p, p, p); }
      return all(LISTING_SELECT + ' WHERE ' + where.join(' AND ') + ' ORDER BY l.created_at DESC LIMIT 300', ...a).map(plain);
    },
    sitemap: () => all("SELECT l.id, l.title, l.updated_at FROM listings l JOIN sellers s ON s.mobile = l.seller_mobile WHERE l.status = 'live' AND s.suspended = 0 ORDER BY l.id DESC LIMIT 5000").map(plain),

    // ---- photos ----
    addPhoto(listingId, by, isAdmin, name, buffer) {
      const l = get('SELECT * FROM listings WHERE id = ?', Number(listingId)); if (!l) return { error: 'Product not found', status: 404 };
      if (!isAdmin && l.seller_mobile !== by) return { error: 'Not your product', status: 403 };
      const ext = String(name || '').toLowerCase().split('.').pop(), mime = PHOTO_TYPES[ext];
      if (!mime) return { error: 'Photos must be JPG, PNG or WebP' };
      if (!buffer || !buffer.length) return { error: 'The photo is empty' };
      if (buffer.length > MAX_PHOTO_BYTES) return { error: 'The photo is too big (5 MB at most)' };
      if (get('SELECT COUNT(*) AS n FROM photos WHERE listing_id = ?', l.id).n >= MAX_PHOTOS) return { error: 'A product can have up to ' + MAX_PHOTOS + ' photos' };
      const ck = filecheck.check(name, buffer); if (!ck.ok) return { error: 'That photo is damaged or cut off. Choose it again.' };
      const file = crypto.randomBytes(16).toString('hex'), pos = get('SELECT COALESCE(MAX(pos), -1) + 1 AS p FROM photos WHERE listing_id = ?', l.id).p;
      fs.writeFileSync(path.join(dataDir, 'photos', file), buffer);
      const r = run('INSERT INTO photos (listing_id, file, mime, size, pos, at) VALUES (?, ?, ?, ?, ?, ?)', l.id, file, mime, buffer.length, pos, now());
      return { id: Number(r.lastInsertRowid) };
    },
    photo: (id) => { const p = plain(get('SELECT * FROM photos WHERE id = ?', Number(id))); return p ? { ...p, path: path.join(dataDir, 'photos', p.file) } : null; },
    deletePhoto(id, by, isAdmin) {
      const p = get('SELECT p.*, l.seller_mobile FROM photos p JOIN listings l ON l.id = p.listing_id WHERE p.id = ?', Number(id)); if (!p) return { error: 'Photo not found', status: 404 };
      if (!isAdmin && p.seller_mobile !== by) return { error: 'Not your product', status: 403 };
      run('DELETE FROM photos WHERE id = ?', p.id); try { fs.unlinkSync(path.join(dataDir, 'photos', p.file)); } catch (e) { /* already gone */ }
      return { ok: true };
    },
    makeCover(id, by, isAdmin) {
      const p = get('SELECT p.*, l.seller_mobile FROM photos p JOIN listings l ON l.id = p.listing_id WHERE p.id = ?', Number(id)); if (!p) return { error: 'Photo not found', status: 404 };
      if (!isAdmin && p.seller_mobile !== by) return { error: 'Not your product', status: 403 };
      const min = get('SELECT MIN(pos) AS m FROM photos WHERE listing_id = ?', p.listing_id).m; run('UPDATE photos SET pos = ? WHERE id = ?', min - 1, p.id); return { ok: true };
    },

    // ---- leads: every tap on a WhatsApp button ----
    addLead(listing) { run('INSERT INTO leads (listing_id, seller_mobile, title, at) VALUES (?, ?, ?, ?)', listing.id, listing.seller_mobile, listing.title, now()); },
    leads: (limit = 100) => all(`SELECT x.at, x.title, x.listing_id, x.seller_mobile, s.business FROM leads x LEFT JOIN sellers s ON s.mobile = x.seller_mobile ORDER BY x.id DESC LIMIT ?`, limit).map(plain),
    sellerLeads: (m, limit = 50) => all('SELECT at, title, listing_id FROM leads WHERE seller_mobile = ? ORDER BY id DESC LIMIT ?', m, limit).map(plain),
    stats() {
      const week = new Date(Date.now() - 7 * 86400000).toISOString();
      return {
        sellers: get('SELECT COUNT(*) AS n FROM sellers').n, live: get("SELECT COUNT(*) AS n FROM listings WHERE status = 'live'").n, pending: get("SELECT COUNT(*) AS n FROM listings WHERE status = 'pending'").n,
        hidden: get("SELECT COUNT(*) AS n FROM listings WHERE status = 'hidden'").n, leads_week: get('SELECT COUNT(*) AS n FROM leads WHERE at > ?', week).n, leads_total: get('SELECT COUNT(*) AS n FROM leads').n,
      };
    },
  };
  return repo;
}

module.exports = { open, CHEMISTRIES, STATES, slugify };
