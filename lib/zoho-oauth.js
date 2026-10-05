// Zoho Admin API connection: a one-time OAuth authorization by you, then the server
// refreshes its own access token automatically forever after. No further clicking needed.
//
// Setup (once): set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET in .env (from the "Server-based
// Application" you created in api-console.zoho.in), restart the server, then visit
// /admin/zoho-connect once while logged into the Zoho account that owns the store, and
// click Allow. The refresh token that comes back is saved to data/zoho_refresh_token and
// used silently from then on.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA_DIR = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'data')
const dc = () => (process.env.ZOHO_DC === 'com' ? 'com' : 'in')
const ACCOUNTS_BASE = () => `https://accounts.zoho.${dc()}`
const TOKEN_FILE = path.join(DATA_DIR, 'zoho_refresh_token')

// Scopes, all read-only except order creation. Customer records themselves are created
// through Zoho's public Storefront API instead (same unauthenticated API the catalog
// already uses), so this app is never granted any permission to read, modify or delete
// your contacts directly.
const SCOPES = [
  'ZohoCommerce.salesorders.CREATE', // push a confirmed website order into Zoho
  'ZohoCommerce.salesorders.READ',   // show the customer their order status
  'ZohoBooks.invoices.READ',         // show the customer their invoice
  'ZohoInventory.reports.READ',      // show the customer their e-way bill
].join(',')

export function isConfigured() {
  return Boolean(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET)
}

export function isConnected() {
  return fs.existsSync(TOKEN_FILE)
}

function clientId() {
  const id = process.env.ZOHO_CLIENT_ID
  if (!id) throw new Error('Missing ZOHO_CLIENT_ID')
  return id
}

function clientSecret() {
  const secret = process.env.ZOHO_CLIENT_SECRET
  if (!secret) throw new Error('Missing ZOHO_CLIENT_SECRET')
  return secret
}

// Must exactly match the "Authorized Redirect URI" entered when the OAuth client was created.
function redirectUri(req) {
  if (process.env.ZOHO_REDIRECT_URI) return process.env.ZOHO_REDIRECT_URI
  return `${req.protocol}://${req.get('host')}/oauth/zoho/callback`
}

export function buildAuthorizeUrl(req) {
  const params = new URLSearchParams({
    client_id: clientId(),
    scope: SCOPES,
    response_type: 'code',
    access_type: 'offline', // asks Zoho for a refresh token, not just a short-lived access token
    redirect_uri: redirectUri(req),
    prompt: 'consent',
  })
  return `${ACCOUNTS_BASE()}/oauth/v2/auth?${params}`
}

export async function exchangeCodeForTokens(code, req) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: redirectUri(req),
    code,
  })
  const res = await fetch(`${ACCOUNTS_BASE()}/oauth/v2/token?${params}`, { method: 'POST' })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.refresh_token) {
    throw new Error(json?.error || `Zoho token exchange failed (${res.status})`)
  }
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(TOKEN_FILE, json.refresh_token)
  cachedAccessToken = { token: json.access_token, expiresAt: Date.now() + (json.expires_in - 60) * 1000 }
  return json
}

let cachedAccessToken = null // { token, expiresAt } — refreshed automatically when it's about to expire

export async function getAccessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) return cachedAccessToken.token

  let refreshToken
  try {
    refreshToken = fs.readFileSync(TOKEN_FILE, 'utf8').trim()
  } catch {
    throw new Error('Zoho is not connected yet. Visit /admin/zoho-connect and click Allow once.')
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: refreshToken,
  })
  const res = await fetch(`${ACCOUNTS_BASE()}/oauth/v2/token?${params}`, { method: 'POST' })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.access_token) {
    throw new Error(json?.error || `Zoho token refresh failed (${res.status})`)
  }
  cachedAccessToken = { token: json.access_token, expiresAt: Date.now() + (json.expires_in - 60) * 1000 }
  return cachedAccessToken.token
}
