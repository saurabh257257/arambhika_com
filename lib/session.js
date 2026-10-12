// Signed login cookie: "<mobile>.<expiry>.<hmac>". The server never trusts a bare mobile number
// from the browser, so a customer can't become someone else by editing their cookie.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SESSION_COOKIE = 'arambhika_session'
export const SESSION_DAYS = 30

const DATA_DIR = process.env.DATA_DIR || path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'data')
const SECRET_FILE = path.join(DATA_DIR, 'session_secret')

// SESSION_SECRET in .env wins; otherwise a random secret is generated once and kept on disk so
// logins survive a restart.
function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET
  try {
    return fs.readFileSync(SECRET_FILE, 'utf8').trim()
  } catch {
    const created = crypto.randomBytes(32).toString('hex')
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(SECRET_FILE, created, { mode: 0o600 })
    return created
  }
}

const mac = (payload) => crypto.createHmac('sha256', secret()).update(payload).digest('base64url')

export function signSession(mobile) {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  const payload = `${mobile}.${expires}`
  return `${payload}.${mac(payload)}`
}

export function readSession(cookieHeader) {
  const raw = (cookieHeader || '')
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${SESSION_COOKIE}=`))
  if (!raw) return null
  const value = decodeURIComponent(raw.slice(SESSION_COOKIE.length + 1))
  const parts = value.split('.')
  if (parts.length !== 3) return null
  const [mobile, expires, given] = parts
  const expected = mac(`${mobile}.${expires}`)
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  if (!/^\d{10}$/.test(mobile) || Number(expires) < Date.now()) return null
  return mobile
}
