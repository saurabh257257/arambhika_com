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

const { ensure } = require('./schema');
const makeData = require('./data');
const TYPES = makeData.ENUMS.TYPES;
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
    CREATE TABLE IF NOT EXISTS oauth_clients (id TEXT PRIMARY KEY, name TEXT NOT NULL, redirect_uris TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS oauth_tokens (
      hash TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), client_id TEXT NOT NULL, kind TEXT NOT NULL, expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (
      id TEXT PRIMARY KEY, by_member TEXT NOT NULL, action TEXT NOT NULL, at TEXT NOT NULL
    );
  `);
  ensure(db, dataDir);
  // keys for the MCP connection: only a hash is stored, so a key can be shown once and never read back
  if (!db.prepare('PRAGMA table_info(members)').all().some((c) => c.name === 'key_hash')) db.exec('ALTER TABLE members ADD COLUMN key_hash TEXT; ALTER TABLE members ADD COLUMN key_created_at TEXT; CREATE INDEX members_key ON members(key_hash);');
  if (!db.prepare('PRAGMA table_info(members)').all().some((c) => c.name === 'deleted')) db.exec('ALTER TABLE members ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0');
  const get = (sql, ...a) => db.prepare(sql).get(...a);
  const all = (sql, ...a) => db.prepare(sql).all(...a);
  const run = (sql, ...a) => db.prepare(sql).run(...a);
  const audit = (by, action) => run('INSERT INTO audit (id, by_member, action, at) VALUES (?, ?, ?, ?)', id(), by, clean(action, 300), now());
  const plain = (r) => (r ? { ...r } : r);

  const tx = (fn) => { db.exec('BEGIN'); try { fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } };
  const repo = {
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
    members: () => all('SELECT id, name, username, role, active, created_at FROM members WHERE deleted = 0 ORDER BY name COLLATE NOCASE'),
    member: (mid) => plain(get('SELECT id, name, username, role, active FROM members WHERE id = ?', mid)),
    setPassword(mid, password, by = 'admin') {
      if (String(password || '').length < 10) return { error: 'The password needs at least 10 characters' };
      if (!get('SELECT id FROM members WHERE id = ?', mid)) return { error: 'Member not found', status: 404 };
      run('UPDATE members SET pass_hash = ? WHERE id = ?', hashPassword(password), mid); run('DELETE FROM oauth_tokens WHERE member_id = ?', mid); audit(by, 'Reset password of ' + get('SELECT username FROM members WHERE id = ?', mid).username);
      return { ok: true };
    },
    // permanent for the person: their login, key and sign-ins end and they disappear from every list. Their past work keeps their name,
    // and the customers in their basket go back to unassigned. The admin must type the member's username to confirm.
    deleteMember(mid, confirm, by = 'admin') {
      const m = get('SELECT id, name, username FROM members WHERE id = ? AND deleted = 0', String(mid || ''));
      if (!m) return { error: 'Member not found', status: 404 };
      if (clean(confirm, 40).toLowerCase() !== m.username) return { error: 'Type the member\'s username to confirm' };
      const n = get('SELECT COUNT(*) AS n FROM customers WHERE owner_id = ?', m.id).n;
      tx(() => {
        run('UPDATE customers SET owner_id = NULL WHERE owner_id = ?', m.id);
        run('DELETE FROM oauth_tokens WHERE member_id = ?', m.id);
        run('UPDATE members SET deleted = 1, active = 0, key_hash = NULL, key_created_at = NULL, username = ? WHERE id = ?', 'deleted-' + m.id.slice(0, 8), m.id);
      });
      audit(by, 'DELETED member ' + m.name + ' (' + m.username + '); ' + n + ' customer' + (n === 1 ? '' : 's') + ' went back to unassigned');
      return { ok: true, name: m.name, unassigned: n };
    },
    setActive(mid, active, by = 'admin') {
      if (!get('SELECT id FROM members WHERE id = ?', mid)) return { error: 'Member not found', status: 404 };
      run('UPDATE members SET active = ? WHERE id = ?', active ? 1 : 0, mid); if (!active) run('DELETE FROM oauth_tokens WHERE member_id = ?', mid); audit(by, (active ? 'Switched on ' : 'Switched off ') + get('SELECT username FROM members WHERE id = ?', mid).username);
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
      run('UPDATE members SET key_hash = NULL, key_created_at = NULL WHERE id = ?', mid); run('DELETE FROM oauth_tokens WHERE member_id = ?', mid); audit(by, 'Revoked the connection key of ' + get('SELECT username FROM members WHERE id = ?', mid).username);
      return { ok: true };
    },
    keyInfo: (mid) => { const r = get('SELECT key_created_at AS at FROM members WHERE id = ? AND key_hash IS NOT NULL', mid); return r ? { at: r.at } : null; },
    memberByKey(key) {
      if (!/^pk_[A-Za-z0-9_-]{20,80}$/.test(String(key || ''))) return null;
      const m = get('SELECT id, name, username, role FROM members WHERE key_hash = ? AND active = 1', crypto.createHash('sha256').update(String(key)).digest('hex'));
      return m ? { ...m } : null;
    },
    // ---- sign-in for the Claude apps (OAuth): clients, and short-lived access tokens with rotating refresh tokens ----
    saveClient(name, redirectUris) { const c = { id: 'c_' + crypto.randomBytes(16).toString('hex'), name: clean(name, 80) || 'Claude', redirect_uris: redirectUris, created_at: now() }; run('INSERT INTO oauth_clients (id, name, redirect_uris, created_at) VALUES (?, ?, ?, ?)', c.id, c.name, JSON.stringify(redirectUris), c.created_at); return c; },
    client(cid) { const r = get('SELECT * FROM oauth_clients WHERE id = ?', String(cid || '')); return r ? { id: r.id, name: r.name, redirect_uris: JSON.parse(r.redirect_uris) } : null; },
    issueTokens(mid, clientId) {
      const sha = (t) => crypto.createHash('sha256').update(t).digest('hex'), access = 'pa_' + crypto.randomBytes(32).toString('base64url'), refresh = 'pr_' + crypto.randomBytes(32).toString('base64url');
      run('DELETE FROM oauth_tokens WHERE expires_at < ?', now());
      run('INSERT INTO oauth_tokens (hash, member_id, client_id, kind, expires_at) VALUES (?, ?, ?, ?, ?)', sha(access), mid, clientId, 'access', new Date(Date.now() + 3600 * 1000).toISOString());
      run('INSERT INTO oauth_tokens (hash, member_id, client_id, kind, expires_at) VALUES (?, ?, ?, ?, ?)', sha(refresh), mid, clientId, 'refresh', new Date(Date.now() + 60 * 86400 * 1000).toISOString());
      return { access, refresh, expiresIn: 3600 };
    },
    memberByAccessToken(token) {
      if (!/^pa_[A-Za-z0-9_-]{20,80}$/.test(String(token || ''))) return null;
      const m = get("SELECT m.id, m.name, m.username, m.role FROM oauth_tokens t JOIN members m ON m.id = t.member_id WHERE t.hash = ? AND t.kind = 'access' AND t.expires_at > ? AND m.active = 1", crypto.createHash('sha256').update(String(token)).digest('hex'), now());
      return m ? { ...m } : null;
    },
    // a refresh token works once: using it hands back a new pair
    useRefresh(token, clientId) {
      if (!/^pr_[A-Za-z0-9_-]{20,80}$/.test(String(token || ''))) return null;
      const h = crypto.createHash('sha256').update(String(token)).digest('hex');
      const t = get("SELECT member_id FROM oauth_tokens WHERE hash = ? AND kind = 'refresh' AND client_id = ? AND expires_at > ?", h, clientId, now());
      if (!t) return null;
      run('DELETE FROM oauth_tokens WHERE hash = ?', h);
      const m = get('SELECT id FROM members WHERE id = ? AND active = 1', t.member_id);
      return m ? this.issueTokens(m.id, clientId) : null;
    },
    revokeTokens: (mid) => run('DELETE FROM oauth_tokens WHERE member_id = ?', mid),
    memberByUsername: (u) => plain(get('SELECT id, name, username FROM members WHERE username = ? AND active = 1', clean(u, 40).toLowerCase())),
    login(username, password) {
      const m = get('SELECT * FROM members WHERE username = ? AND active = 1', clean(username, 40).toLowerCase());
      return m && checkPassword(password, m.pass_hash) ? { id: m.id, name: m.name, role: m.role } : null;
    },

    activity: (limit = 100) => all('SELECT a.at, a.action, COALESCE(m.name, a.by_member) AS who FROM audit a LEFT JOIN members m ON m.id = a.by_member ORDER BY a.at DESC LIMIT ?', limit).map(plain),
    close: () => db.close(),
  };
  Object.assign(repo, makeData({ get, all, run, audit, plain, dataDir, tx }));
  return repo;
}

module.exports = { open, TYPES, checkPassword, ENUMS: makeData.ENUMS };
