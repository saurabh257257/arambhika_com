// The database: SQLite in one file (DATA_DIR/portal.db) plus uploaded files on disk (DATA_DIR/files).
// Everything that changes data lives here as small functions, so the MCP server can use exactly the same ones later.
// The portal itself only reads, except for creating team members.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
// Node 22.13+ has SQLite built in; the dev droplet runs Node 20, where the better-sqlite3 package does the same job (same calls)
let Database;
try { Database = require('node:sqlite').DatabaseSync; } catch (e) { Database = require('better-sqlite3'); }

const TYPES = ['note', 'call', 'whatsapp', 'visit', 'quote', 'order', 'payment', 'dispatch', 'followup'];
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const digits = (v) => String(v || '').replace(/\D/g, '');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function checkPassword(pw, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex'), b = crypto.scryptSync(String(pw), salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function open(dataDir) {
  fs.mkdirSync(path.join(dataDir, 'files'), { recursive: true });
  const db = new Database(path.join(dataDir, 'portal.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE, pass_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, company TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', phone_digits TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', owner_id TEXT REFERENCES members(id), created_by TEXT REFERENCES members(id), created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS interactions (
      id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), type TEXT NOT NULL, summary TEXT NOT NULL,
      amount REAL, next_date TEXT, by_member TEXT NOT NULL REFERENCES members(id), at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS interactions_customer ON interactions(customer_id, at);
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), interaction_id TEXT REFERENCES interactions(id),
      name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, by_member TEXT NOT NULL REFERENCES members(id), at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (
      id TEXT PRIMARY KEY, by_member TEXT NOT NULL, action TEXT NOT NULL, at TEXT NOT NULL
    );
  `);
  // keys for the MCP connection: only a hash is stored, so a key can be shown once and never read back
  if (!db.prepare('PRAGMA table_info(members)').all().some((c) => c.name === 'key_hash')) db.exec('ALTER TABLE members ADD COLUMN key_hash TEXT; ALTER TABLE members ADD COLUMN key_created_at TEXT; CREATE INDEX members_key ON members(key_hash);');
  const get = (sql, ...a) => db.prepare(sql).get(...a);
  const all = (sql, ...a) => db.prepare(sql).all(...a);
  const run = (sql, ...a) => db.prepare(sql).run(...a);
  const audit = (by, action) => run('INSERT INTO audit (id, by_member, action, at) VALUES (?, ?, ?, ?)', id(), by, clean(action, 300), now());
  const plain = (r) => (r ? { ...r } : r);

  return {
    db, dataDir,

    // ---- team members (the only thing the portal itself writes) ----
    createMember({ name, username, password, role = 'employee' }, by = 'admin') {
      name = clean(name, 60); username = clean(username, 40).toLowerCase();
      if (!name) return { error: 'Give the member a name' };
      if (!/^[a-z0-9._-]{3,40}$/.test(username) || username === 'admin') return { error: 'Username: 3 to 40 letters, numbers, dots or dashes (not "admin")' };
      if (String(password || '').length < 10) return { error: 'The password needs at least 10 characters' };
      if (get('SELECT id FROM members WHERE username = ?', username)) return { error: 'That username is taken' };
      const m = { id: id(), name, username, role: role === 'admin' ? 'admin' : 'employee', created_at: now() };
      run('INSERT INTO members (id, name, username, pass_hash, role, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)', m.id, m.name, m.username, hashPassword(password), m.role, m.created_at);
      audit(by, 'Created member ' + username);
      return { member: { ...m, active: 1 } };
    },
    members: () => all('SELECT id, name, username, role, active, created_at FROM members ORDER BY name COLLATE NOCASE'),
    member: (mid) => plain(get('SELECT id, name, username, role, active FROM members WHERE id = ?', mid)),
    setPassword(mid, password, by = 'admin') {
      if (String(password || '').length < 10) return { error: 'The password needs at least 10 characters' };
      if (!get('SELECT id FROM members WHERE id = ?', mid)) return { error: 'Member not found', status: 404 };
      run('UPDATE members SET pass_hash = ? WHERE id = ?', hashPassword(password), mid); audit(by, 'Reset password of ' + get('SELECT username FROM members WHERE id = ?', mid).username);
      return { ok: true };
    },
    setActive(mid, active, by = 'admin') {
      if (!get('SELECT id FROM members WHERE id = ?', mid)) return { error: 'Member not found', status: 404 };
      run('UPDATE members SET active = ? WHERE id = ?', active ? 1 : 0, mid); audit(by, (active ? 'Switched on ' : 'Switched off ') + get('SELECT username FROM members WHERE id = ?', mid).username);
      return { ok: true };
    },
    createKey(mid) {
      if (!get('SELECT id FROM members WHERE id = ?', mid)) return { error: 'Member not found', status: 404 };
      const key = 'pk_' + crypto.randomBytes(32).toString('base64url');
      run('UPDATE members SET key_hash = ?, key_created_at = ? WHERE id = ?', crypto.createHash('sha256').update(key).digest('hex'), now(), mid);
      audit(mid, 'Made a new connection key');
      return { key };
    },
    revokeKey(mid, by = 'admin') {
      if (!get('SELECT id FROM members WHERE id = ?', mid)) return { error: 'Member not found', status: 404 };
      run('UPDATE members SET key_hash = NULL, key_created_at = NULL WHERE id = ?', mid); audit(by, 'Revoked the connection key of ' + get('SELECT username FROM members WHERE id = ?', mid).username);
      return { ok: true };
    },
    keyInfo: (mid) => { const r = get('SELECT key_created_at AS at FROM members WHERE id = ? AND key_hash IS NOT NULL', mid); return r ? { at: r.at } : null; },
    memberByKey(key) {
      if (!/^pk_[A-Za-z0-9_-]{20,80}$/.test(String(key || ''))) return null;
      const m = get('SELECT id, name, username, role FROM members WHERE key_hash = ? AND active = 1', crypto.createHash('sha256').update(String(key)).digest('hex'));
      return m ? { ...m } : null;
    },
    memberByUsername: (u) => plain(get('SELECT id, name, username FROM members WHERE username = ? AND active = 1', clean(u, 40).toLowerCase())),
    // customers this member owns whose latest interaction asked for a follow-up on or before the given day
    followUps(mid, upTo) {
      return all("SELECT c.id, c.name, c.company, c.phone, i.type, i.summary, i.next_date, i.at FROM customers c JOIN interactions i ON i.id = (SELECT id FROM interactions WHERE customer_id = c.id ORDER BY at DESC, rowid DESC LIMIT 1) WHERE c.owner_id = ? AND i.next_date IS NOT NULL AND i.next_date <= ? ORDER BY i.next_date", mid, upTo).map(plain);
    },
    login(username, password) {
      const m = get('SELECT * FROM members WHERE username = ? AND active = 1', clean(username, 40).toLowerCase());
      return m && checkPassword(password, m.pass_hash) ? { id: m.id, name: m.name, role: m.role } : null;
    },

    // ---- writes the MCP server will call (every one is stamped with who did it) ----
    addCustomer({ name, company, phone, email, city, ownerId }, by) {
      name = clean(name, 100); if (!name) return { error: 'The customer needs a name' };
      const dg = digits(phone).slice(-10);
      if (dg.length >= 10) { const dup = get('SELECT id, name FROM customers WHERE phone_digits = ?', dg); if (dup) return { error: 'A customer with this phone number already exists: ' + dup.name + ' (id ' + dup.id + ')' }; }
      const c = { id: id(), name, company: clean(company, 100), phone: clean(phone, 20), email: clean(email, 100), city: clean(city, 60), owner_id: ownerId || by, created_by: by, created_at: now() };
      run('INSERT INTO customers (id, name, company, phone, phone_digits, email, city, owner_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', c.id, c.name, c.company, c.phone, digits(c.phone).slice(-10), c.email, c.city, c.owner_id, c.created_by, c.created_at);
      audit(by, 'Added customer ' + name);
      return { customer: c };
    },
    addInteraction({ customerId, type, summary, amount, nextDate }, by) {
      if (!get('SELECT id FROM customers WHERE id = ?', customerId)) return { error: 'Customer not found', status: 404 };
      if (!TYPES.includes(type)) return { error: 'Type must be one of: ' + TYPES.join(', ') };
      summary = clean(summary, 2000); if (!summary) return { error: 'Say what happened' };
      if (nextDate && !/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return { error: 'The follow-up date must look like 2026-12-31' };
      const i = { id: id(), customer_id: customerId, type, summary, amount: amount == null || amount === '' ? null : Number(amount), next_date: nextDate || null, by_member: by, at: now() };
      if (i.amount != null && !Number.isFinite(i.amount)) return { error: 'The amount must be a number' };
      run('INSERT INTO interactions (id, customer_id, type, summary, amount, next_date, by_member, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', i.id, i.customer_id, i.type, i.summary, i.amount, i.next_date, i.by_member, i.at);
      audit(by, 'Logged ' + type + ' for ' + get('SELECT name FROM customers WHERE id = ?', customerId).name);
      return { interaction: i };
    },
    addFile({ customerId, interactionId, name, mime, buffer }, by) {
      if (!get('SELECT id FROM customers WHERE id = ?', customerId)) return { error: 'Customer not found', status: 404 };
      if (!buffer || !buffer.length) return { error: 'The file is empty' };
      if (buffer.length > 10 * 1024 * 1024) return { error: 'The file is too big (10 MB at most)' };
      const f = { id: id(), customer_id: customerId, interaction_id: interactionId || null, name: clean(name, 150).replace(/[\\/:*?"<>|]/g, '') || 'file', mime: clean(mime, 100) || 'application/octet-stream', size: buffer.length, by_member: by, at: now() };
      fs.writeFileSync(path.join(dataDir, 'files', f.id), buffer);
      run('INSERT INTO files (id, customer_id, interaction_id, name, mime, size, by_member, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', f.id, f.customer_id, f.interaction_id, f.name, f.mime, f.size, f.by_member, f.at);
      audit(by, 'Uploaded ' + f.name + ' for ' + get('SELECT name FROM customers WHERE id = ?', customerId).name);
      return { file: f };
    },

    // ---- reads for the portal pages ----
    customers({ q, owner } = {}) {
      const rows = all(`SELECT c.*, m.name AS owner_name,
          (SELECT COUNT(*) FROM interactions i WHERE i.customer_id = c.id) AS interactions,
          (SELECT MAX(at) FROM interactions i WHERE i.customer_id = c.id) AS last_at,
          (SELECT MIN(next_date) FROM interactions i WHERE i.customer_id = c.id AND next_date >= ?) AS next_follow_up
        FROM customers c LEFT JOIN members m ON m.id = c.owner_id ORDER BY COALESCE(last_at, c.created_at) DESC`, new Date().toISOString().slice(0, 10));
      const term = clean(q, 60).toLowerCase(), dg = digits(q);
      return rows.filter((c) => (!owner || c.owner_id === owner) &&
        (!term || [c.name, c.company, c.city, c.email].some((s) => String(s).toLowerCase().includes(term)) || (dg.length >= 3 && c.phone_digits.includes(dg)))).map(plain);
    },
    customer(cid) {
      const c = get('SELECT c.*, m.name AS owner_name, cb.name AS created_by_name FROM customers c LEFT JOIN members m ON m.id = c.owner_id LEFT JOIN members cb ON cb.id = c.created_by WHERE c.id = ?', cid);
      if (!c) return null;
      return {
        ...c,
        interactions: all('SELECT i.*, m.name AS by_name FROM interactions i LEFT JOIN members m ON m.id = i.by_member WHERE i.customer_id = ? ORDER BY i.at DESC', cid).map(plain),
        files: all('SELECT f.*, m.name AS by_name FROM files f LEFT JOIN members m ON m.id = f.by_member WHERE f.customer_id = ? ORDER BY f.at DESC', cid).map(plain),
      };
    },
    file: (fid) => plain(get('SELECT * FROM files WHERE id = ?', fid)),
    filePath: (fid) => (/^[0-9a-f-]{36}$/.test(fid) ? path.join(dataDir, 'files', fid) : null),
    activity: (limit = 100) => all('SELECT a.at, a.action, COALESCE(m.name, a.by_member) AS who FROM audit a LEFT JOIN members m ON m.id = a.by_member ORDER BY a.at DESC LIMIT ?', limit).map(plain),
    close: () => db.close(),
  };
}

module.exports = { open, TYPES, checkPassword };
