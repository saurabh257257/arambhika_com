// Signed login cookie "<mobile>.<expiry>.<hmac>". The server never trusts a bare mobile number from the browser.
'use strict';
const crypto = require('crypto');

const COOKIE = 'ld_session';
const DAYS = 30;

module.exports = function makeSession(secret) {
  const mac = (p) => crypto.createHmac('sha256', secret).update(p).digest('base64url');
  const sign = (mobile) => { const p = mobile + '.' + (Date.now() + DAYS * 86400000); return p + '.' + mac(p); };
  function read(cookieHeader) {
    const raw = String(cookieHeader || '').split(';').map((x) => x.trim()).find((x) => x.startsWith(COOKIE + '='));
    if (!raw) return null;
    const parts = decodeURIComponent(raw.slice(COOKIE.length + 1)).split('.');
    if (parts.length !== 3) return null;
    const [mobile, exp, given] = parts, expected = mac(mobile + '.' + exp), a = Buffer.from(given), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return /^\d{10}$/.test(mobile) && Number(exp) > Date.now() ? mobile : null;
  }
  const start = (req, res, mobile) => res.cookie(COOKIE, sign(mobile), { httpOnly: true, sameSite: 'lax', secure: req.secure || req.headers['x-forwarded-proto'] === 'https', maxAge: DAYS * 86400000, path: '/' });
  const end = (res) => res.clearCookie(COOKIE, { path: '/' });
  return { read, start, end, COOKIE };
};
