// OTP sign-in through MSG91 (the same account and approved SMS template as arambhika.com, so the message still says Arambhika).
// MSG91 makes, sends and checks the code itself; this file calls it and adds abuse limits.
// Without MSG91 keys, a fixed DEV_OTP_CODE can be set for testing (never set it in production).
'use strict';

const HOUR = 3600000;

module.exports = function makeOtp({ authKey, templateId, length = 4, expiry = 5, devCode = '', fetchFn = fetch, base = process.env.MSG91_BASE || 'https://control.msg91.com/api/v5' }) {
  const sends = new Map(), failures = new Map();
  const live = () => !!(authKey && templateId);
  const within = (list, ms) => list.filter((t) => t > Date.now() - ms);

  async function call(method, pathAndQuery) {
    const res = await fetchFn(base + pathAndQuery, { method, headers: { authkey: authKey, 'Content-Type': 'application/json' }, body: method === 'POST' ? '{}' : undefined });
    const json = await res.json().catch(() => null);
    return { ok: res.ok && json && json.type === 'success', message: (json && json.message) || 'MSG91 error (' + res.status + ')' };
  }
  const intl = (m) => '91' + m;

  return {
    mode: () => (live() ? 'sms' : devCode ? 'dev' : 'off'),
    length: () => (live() ? length : String(devCode).length || 4),
    // null when allowed, otherwise the reason it is refused
    checkSend(mobile, ip) {
      const m = within(sends.get('m:' + mobile) || [], HOUR), i = within(sends.get('i:' + ip) || [], HOUR);
      if (m.length && Date.now() - m[m.length - 1] < 30000) return 'Please wait 30 seconds before asking for another OTP.';
      if (m.length >= 5) return 'Too many OTP requests for this number. Please try again in an hour.';
      if (i.length >= 20) return 'Too many OTP requests. Please try again later.';
      m.push(Date.now()); i.push(Date.now()); sends.set('m:' + mobile, m); sends.set('i:' + ip, i);
      return null;
    },
    async send(mobile, resend) {
      if (!live()) return { ok: this.mode() === 'dev' };
      const q = new URLSearchParams(resend ? { mobile: intl(mobile), retrytype: 'text' } : { template_id: templateId, mobile: intl(mobile), otp_length: String(length), otp_expiry: String(expiry) });
      let r = await call(resend ? 'GET' : 'POST', (resend ? '/otp/retry?' : '/otp?') + q);
      if (!r.ok && resend) r = await call('POST', '/otp?' + new URLSearchParams({ template_id: templateId, mobile: intl(mobile), otp_length: String(length), otp_expiry: String(expiry) }));
      return r;
    },
    locked(mobile) { const f = failures.get(mobile); if (!f) return false; if (Date.now() - f.at > 600000) { failures.delete(mobile); return false; } return f.n >= 5; },
    fail(mobile) { const f = failures.get(mobile); if (!f || Date.now() - f.at > 600000) failures.set(mobile, { n: 1, at: Date.now() }); else f.n += 1; },
    clear(mobile) { failures.delete(mobile); },
    async verify(mobile, code) {
      if (!live()) return { ok: this.mode() === 'dev' && String(code) === String(devCode) };
      return call('GET', '/otp/verify?' + new URLSearchParams({ mobile: intl(mobile), otp: String(code) }));
    },
  };
};
