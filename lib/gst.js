// GSTIN checks. Two layers:
//
//  1. validateGstin(): offline and always on. Length, character pattern, a real state code, the
//     embedded PAN shape and the check digit. This catches typos and invented numbers.
//  2. lookupGstin(): asks a GST-lookup provider whether the number is actually registered and
//     returns the registered name. It only runs when a provider is configured:
//         GST_PROVIDER=appyflow
//         GST_API_KEY=<key from that provider>
//     With none configured it reports "unavailable" and the caller keeps the offline result.
//
// Result of the pair, as stored on the profile (gstVerified):
//     'verified'  a provider confirmed the number is registered (and its status is active)
//     'format'    the number is well formed but no provider could confirm it exists

import { stateForGstCode } from './india.js'

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

export const normalizeGstin = (v) => String(v || '').replace(/\s+/g, '').toUpperCase()

function checkDigit(first14) {
  let sum = 0
  for (let i = 0; i < 14; i += 1) {
    const value = CHARS.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2)
    sum += Math.floor(value / 36) + (value % 36)
  }
  return CHARS[(36 - (sum % 36)) % 36]
}

export function validateGstin(input) {
  const gstin = normalizeGstin(input)
  if (!gstin) return { ok: false, gstin, reason: 'Enter your 15-character GST number.' }
  if (gstin.length !== 15) return { ok: false, gstin, reason: 'A GST number has exactly 15 characters.' }
  if (!PATTERN.test(gstin)) return { ok: false, gstin, reason: 'That does not look like a GST number. Check the letters and digits.' }
  const state = stateForGstCode(gstin.slice(0, 2))
  if (!state) return { ok: false, gstin, reason: 'The first two digits are not a valid state code.' }
  if (checkDigit(gstin.slice(0, 14)) !== gstin[14]) {
    return { ok: false, gstin, reason: 'The last character does not match. Please re-check the number.' }
  }
  return { ok: true, gstin, state: state.name, stateCode: state.gst, pan: gstin.slice(2, 12) }
}

// ---- provider lookup -------------------------------------------------------------------------

const PROVIDERS = {
  // https://appyflow.in  GET /api/verifyGST?gstNo=<GSTIN>&key_secret=<KEY>
  async appyflow(gstin, key) {
    const url = `https://appyflow.in/api/verifyGST?${new URLSearchParams({ gstNo: gstin, key_secret: key })}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const json = await res.json().catch(() => null)
    if (!json) return { status: 'unavailable', message: `provider replied ${res.status}` }
    if (json.error === true || !json.taxpayerInfo) {
      const message = String(json.message || '')
      // Providers answer "not found / invalid" as an error object; a quota or key problem is not
      // evidence that the number is fake, so only a clear "no such GSTIN" counts as not found.
      if (/not\s*found|invalid\s*gst|no\s*record|does not exist/i.test(message)) return { status: 'not_found', message }
      return { status: 'unavailable', message }
    }
    const t = json.taxpayerInfo
    return {
      status: 'verified',
      legalName: t.lgnm || '',
      tradeName: t.tradeNam || '',
      active: /active/i.test(String(t.sts || 'active')),
      registrationStatus: t.sts || '',
    }
  },
}

export function providerConfigured() {
  return Boolean(process.env.GST_PROVIDER && process.env.GST_API_KEY && PROVIDERS[process.env.GST_PROVIDER])
}

export async function lookupGstin(gstin) {
  if (!providerConfigured()) return { status: 'unavailable', message: 'no GST provider configured' }
  try {
    return await PROVIDERS[process.env.GST_PROVIDER](gstin, process.env.GST_API_KEY)
  } catch (err) {
    return { status: 'unavailable', message: err.message }
  }
}

/**
 * Full verification used by the API. Never throws.
 *   { ok, gstin, state, verified: 'verified'|'format'|'', legalName, tradeName, message }
 * ok=false means the number must be corrected (bad format, or the provider says it does not exist
 * or is not active). A provider outage keeps ok=true with verified='format'.
 */
export async function verifyGstin(input) {
  const offline = validateGstin(input)
  if (!offline.ok) return { ok: false, gstin: offline.gstin, verified: '', message: offline.reason }

  const found = await lookupGstin(offline.gstin)
  if (found.status === 'not_found') {
    return { ok: false, gstin: offline.gstin, verified: '', message: 'This GST number was not found on the GST portal.' }
  }
  if (found.status === 'verified') {
    if (found.active === false) {
      return { ok: false, gstin: offline.gstin, verified: '', message: `This GST registration is ${found.registrationStatus || 'not active'}.` }
    }
    return {
      ok: true, gstin: offline.gstin, state: offline.state, stateCode: offline.stateCode,
      verified: 'verified', legalName: found.legalName, tradeName: found.tradeName,
      message: 'GST number verified.',
    }
  }
  return {
    ok: true, gstin: offline.gstin, state: offline.state, stateCode: offline.stateCode,
    verified: 'format', legalName: '', tradeName: '',
    message: providerConfigured()
      ? 'The number is valid, but the GST portal could not be reached to confirm it just now.'
      : 'The number is valid. Live confirmation with the GST portal is not switched on yet.',
  }
}
