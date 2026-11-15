// The tables for customers, vendors, offers and items. A mobile number (10 digits) is the primary key of a customer and of a vendor,
// so the database itself refuses a second row with the same number. An older database (customers keyed by a random id) is
// converted once, after a copy of the file is saved next to it.
'use strict';
const fs = require('fs');
const path = require('path');

const NEW_TABLES = `
  CREATE TABLE IF NOT EXISTS customers (
    mobile TEXT PRIMARY KEY CHECK (length(mobile) = 10),
    name TEXT NOT NULL, company TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '', state TEXT NOT NULL DEFAULT '', pincode TEXT NOT NULL DEFAULT '', gstin TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', about TEXT NOT NULL DEFAULT '', zoho_status TEXT NOT NULL DEFAULT '', zoho_contact TEXT NOT NULL DEFAULT '', zoho_checked_at TEXT,
    source TEXT NOT NULL DEFAULT '', source_detail TEXT NOT NULL DEFAULT '',
    buyer_type TEXT NOT NULL DEFAULT 'unknown', business TEXT NOT NULL DEFAULT '',
    looking_for TEXT NOT NULL DEFAULT '', application TEXT NOT NULL DEFAULT '', cell_format TEXT NOT NULL DEFAULT '',
    monthly_volume TEXT NOT NULL DEFAULT '', urgency TEXT NOT NULL DEFAULT '',
    owner_id TEXT REFERENCES members(id), created_by TEXT REFERENCES members(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS customer_contacts (
    customer_mobile TEXT NOT NULL REFERENCES customers(mobile), mobile TEXT NOT NULL CHECK (length(mobile) = 10), name TEXT NOT NULL, role TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '', added_by TEXT NOT NULL, added_at TEXT NOT NULL, PRIMARY KEY (customer_mobile, mobile)
  );
  CREATE TABLE IF NOT EXISTS interactions (
    id TEXT PRIMARY KEY, customer_mobile TEXT NOT NULL REFERENCES customers(mobile), type TEXT NOT NULL, summary TEXT NOT NULL,
    amount REAL, next_date TEXT, by_member TEXT NOT NULL REFERENCES members(id), at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS interactions_customer ON interactions(customer_mobile, at);
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY, customer_mobile TEXT NOT NULL REFERENCES customers(mobile), interaction_id TEXT REFERENCES interactions(id),
    name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, by_member TEXT NOT NULL REFERENCES members(id), at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS vendors (
    mobile TEXT PRIMARY KEY CHECK (length(mobile) = 10),
    name TEXT NOT NULL, company TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', state TEXT NOT NULL DEFAULT '',
    gstin TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_by TEXT REFERENCES members(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS books_docs (
    customer_mobile TEXT NOT NULL REFERENCES customers(mobile), kind TEXT NOT NULL, number TEXT NOT NULL,
    date TEXT, due_date TEXT, expiry TEXT, total REAL NOT NULL DEFAULT 0, balance REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT '',
    shipped TEXT NOT NULL DEFAULT '', invoiced TEXT NOT NULL DEFAULT '', payment_expected TEXT, lines TEXT NOT NULL DEFAULT '[]',
    synced_at TEXT NOT NULL, synced_by TEXT NOT NULL REFERENCES members(id), PRIMARY KEY (customer_mobile, kind, number)
  );
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY, sku TEXT NOT NULL DEFAULT '', name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '', price REAL, stock REAL, unit TEXT NOT NULL DEFAULT '',
    moq REAL, description TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '', collections TEXT NOT NULL DEFAULT '[]', handle TEXT NOT NULL DEFAULT '', synced_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS vendor_items (
    vendor_mobile TEXT NOT NULL REFERENCES vendors(mobile), item_id TEXT NOT NULL REFERENCES items(id), added_by TEXT NOT NULL, added_at TEXT NOT NULL, PRIMARY KEY (vendor_mobile, item_id)
  );
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('vendor', 'item')), key TEXT NOT NULL, text TEXT NOT NULL, by_member TEXT NOT NULL REFERENCES members(id), at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS notes_key ON notes(kind, key, at);
  CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('vendor', 'item')), key TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '',
    by_member TEXT NOT NULL REFERENCES members(id), at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS attachments_key ON attachments(kind, key, at);
  CREATE TABLE IF NOT EXISTS vendor_offers (
    id TEXT PRIMARY KEY, vendor_mobile TEXT NOT NULL REFERENCES vendors(mobile), item_id TEXT REFERENCES items(id), item_text TEXT NOT NULL,
    rate REAL NOT NULL, unit TEXT NOT NULL DEFAULT '', quantity TEXT NOT NULL DEFAULT '', valid_till TEXT, note TEXT NOT NULL DEFAULT '',
    offer_date TEXT NOT NULL, by_member TEXT NOT NULL REFERENCES members(id), at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS offers_vendor ON vendor_offers(vendor_mobile, offer_date);
  CREATE INDEX IF NOT EXISTS offers_item ON vendor_offers(item_id, offer_date);
`;

function ensure(db, dataDir) {
  try { upgrade(db); } catch (e) { /* a brand new database has no customers table yet: nothing to upgrade */ }
  const cols = (t) => db.prepare('PRAGMA table_info(' + t + ')').all().map((c) => c.name);
  const old = cols('customers').includes('id');
  if (old) {
    const file = path.join(dataDir, 'portal.db');
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(file, path.join(dataDir, 'portal.db.before-mobile-keys-' + Date.now()));
    db.exec(`
      PRAGMA foreign_keys = OFF; PRAGMA legacy_alter_table = ON;
      DROP INDEX IF EXISTS interactions_customer;
      ALTER TABLE customers RENAME TO customers_old; ALTER TABLE interactions RENAME TO interactions_old; ALTER TABLE files RENAME TO files_old;
    `);
  }
  db.exec(NEW_TABLES);
  if (old) {
    db.exec(`
      INSERT INTO customers (mobile, name, company, email, city, owner_id, created_by, created_at, updated_at)
        SELECT phone_digits, name, company, email, city, owner_id, created_by, created_at, created_at FROM customers_old
        WHERE length(phone_digits) = 10 AND substr(phone_digits, 1, 1) IN ('6', '7', '8', '9') GROUP BY phone_digits;
      INSERT INTO interactions (id, customer_mobile, type, summary, amount, next_date, by_member, at)
        SELECT i.id, c.phone_digits, i.type, i.summary, i.amount, i.next_date, i.by_member, i.at FROM interactions_old i JOIN customers_old c ON c.id = i.customer_id
        WHERE c.phone_digits IN (SELECT mobile FROM customers);
      INSERT INTO files (id, customer_mobile, interaction_id, name, mime, size, by_member, at)
        SELECT f.id, c.phone_digits, f.interaction_id, f.name, f.mime, f.size, f.by_member, f.at FROM files_old f JOIN customers_old c ON c.id = f.customer_id
        WHERE c.phone_digits IN (SELECT mobile FROM customers);
      DROP TABLE files_old; DROP TABLE interactions_old; DROP TABLE customers_old;
      PRAGMA legacy_alter_table = OFF; PRAGMA foreign_keys = ON;
    `);
  }
  upgrade(db);
  upgradeVendors(db);
}

// columns added after the first release, and the move from "non-trader" to "OEM"
function upgrade(db) {
  const cols = db.prepare('PRAGMA table_info(customers)').all().map((c) => c.name);
  for (const c of ['address', 'about', 'zoho_status', 'zoho_contact']) if (!cols.includes(c)) db.exec('ALTER TABLE customers ADD COLUMN ' + c + " TEXT NOT NULL DEFAULT ''");
  if (!cols.includes('zoho_checked_at')) db.exec('ALTER TABLE customers ADD COLUMN zoho_checked_at TEXT');
  db.exec("UPDATE customers SET buyer_type = 'oem' WHERE buyer_type = 'non_trader'");
}

// vendor details added after the first release (done separately so a brand new database is not affected)
function upgradeVendors(db) {
  const cols = db.prepare('PRAGMA table_info(vendors)').all().map((c) => c.name);
  for (const c of ['address', 'about', 'payment_terms', 'lead_time', 'min_order']) if (!cols.includes(c)) db.exec('ALTER TABLE vendors ADD COLUMN ' + c + " TEXT NOT NULL DEFAULT ''");
}

module.exports = { ensure, upgrade, upgradeVendors };
