// OTP login through MSG91's OTP API (https://control.msg91.com). MSG91 generates, sends and
// checks the code itself; this module only calls it and adds abuse limits.
//
// Needs, in .env:
//   MSG91_AUTHKEY       your MSG91 auth key
//   MSG91_TEMPLATE_ID   the approved OTP template (it must contain the ##OTP## variable)
// Optional:
//   MSG91_OTP_LENGTH    digits in the code (default 6, must match the template)
//   MSG91_OTP_EXPIRY    minutes the code stays valid (default 10)
//
// Without those two, isConfigured() is false and server.js falls back to the old
// single-test-number login, so an unconfigured server never opens up to every number.

const BASE = process.env.MSG91_BASE || 'https://control.msg91.com/api/v5'

export const OTP_LENGTH = Number(process.env.MSG91_OTP_LENGTH) || 6
const OTP_EXPIRY = Number(process.env.MSG91_OTP_EXPIRY) || 10

export function isConfigured() {
  return Boolean(process.env.MSG91_AUTHKEY && process.env.MSG91_TEMPLATE_ID)
}

// MSG91 wants the country code in front: 91 + the 10-digit Indian mobile.
const intl = (mobile) => `91${mobile}`

async function msg91(method, pathAndQuery) {
  const res = await fetch(`${BASE}${pathAndQuery}`, {
    method,
    headers: {
      authkey: process.env.MSG91_AUTHKEY,
      'Content-Type': 'application/json',
    },
    body: method === 'POST' ? '{}' : undefined,
  })
  const json = await res.json().catch(() => null)
  const ok = res.ok && json?.type === 'success'
  return { ok, message: json?.message || `MSG91 error (${res.status})` }
}

export async function sendOtp(mobile) {
  const q = new URLSearchParams({
    template_id: process.env.MSG91_TEMPLATE_ID,
    mobile: intl(mobile),
    otp_length: String(OTP_LENGTH),
    otp_expiry: String(OTP_EXPIRY),
  })
  return msg91('POST', `/otp?${q}`)
}

export async function resendOtp(mobile) {
  const q = new URLSearchParams({ mobile: intl(mobile), retrytype: 'text' })
  return msg91('GET', `/otp/retry?${q}`)
}

export async function verifyOtp(mobile, otp) {
  const q = new URLSearchParams({ mobile: intl(mobile), otp: String(otp) })
  return msg91('GET', `/otp/verify?${q}`)
}

// ---- abuse limits (in memory; a restart resets them, which is fine for rate limiting) ----
const sends = new Map()    // key -> [timestamps]
const failures = new Map() // mobile -> { count, firstAt }

const HOUR = 60 * 60 * 1000

function within(list, ms) {
  const cutoff = Date.now() - ms
  return list.filter((t) => t > cutoff)
}

// Returns an error message if this send must be refused, otherwise records it and returns null.
export function checkSendAllowed(mobile, ip) {
  const byMobile = within(sends.get(`m:${mobile}`) || [], HOUR)
  const byIp = within(sends.get(`i:${ip}`) || [], HOUR)
  if (byMobile.length && Date.now() - byMobile[byMobile.length - 1] < 30 * 1000) {
    return 'Please wait 30 seconds before asking for another OTP.'
  }
  if (byMobile.length >= 5) return 'Too many OTP requests for this number. Please try again in an hour.'
  if (byIp.length >= 20) return 'Too many OTP requests. Please try again later.'
  byMobile.push(Date.now())
  byIp.push(Date.now())
  sends.set(`m:${mobile}`, byMobile)
  sends.set(`i:${ip}`, byIp)
  return null
}

// 5 wrong codes lock verification for that number until a fresh OTP is requested or 10 minutes pass.
export function verifyLocked(mobile) {
  const f = failures.get(mobile)
  if (!f) return false
  if (Date.now() - f.firstAt > 10 * 60 * 1000) { failures.delete(mobile); return false }
  return f.count >= 5
}
export function recordVerifyFailure(mobile) {
  const f = failures.get(mobile)
  if (!f || Date.now() - f.firstAt > 10 * 60 * 1000) failures.set(mobile, { count: 1, firstAt: Date.now() })
  else f.count += 1
}
export function clearVerifyFailures(mobile) { failures.delete(mobile) }
