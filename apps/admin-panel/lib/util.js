'use strict';
const crypto = require('crypto');

// Dates are India dates. `clock.date` lets the tests pretend it is another day; in real use it stays null.
const clock = { date: null };
const todayIST = () => clock.date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const nowISO = () => (clock.date ? clock.date + 'T06:00:00.000Z' : new Date().toISOString()); // 11:30 am India time on a pretend day
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const diffDays = (a, b) => Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000);
const istDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '');
const dayOfWeek = (d) => new Date(d + 'T00:00:00Z').getUTCDay(); // 0 = Sunday ... 6 = Saturday
const weekStart = (d) => addDays(d, -((dayOfWeek(d) + 6) % 7)); // the Monday of that week
const str = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const text = (v, max) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max);
const uid = () => crypto.randomUUID();
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'field';

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function checkPassword(pw, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex');
  const b = crypto.scryptSync(String(pw), salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const PHONE_RE = /^[0-9+\-() ]{5,20}$/;

module.exports = { clock, todayIST, isDate, addDays, diffDays, istDate, dayOfWeek, weekStart, str, text, uid, nowISO, slug, hashPassword, checkPassword, safeEqual, PHONE_RE };
