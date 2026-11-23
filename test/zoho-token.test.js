// Which Zoho refresh token the server uses: the connection made by hand (saved in the data folder) beats the repo secret in the environment,
// so a deploy, which rewrites the environment, cannot put an older token (without the newer permissions) back.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

async function tokenUsed({ file, env }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoho-token-'))
  if (file) fs.writeFileSync(path.join(dir, 'zoho_refresh_token'), file + '\n')
  const saved = { DATA_DIR: process.env.DATA_DIR, T: process.env.ZOHO_REFRESH_TOKEN, ID: process.env.ZOHO_CLIENT_ID, SEC: process.env.ZOHO_CLIENT_SECRET, fetch: globalThis.fetch }
  process.env.DATA_DIR = dir
  process.env.ZOHO_CLIENT_ID = 'id'
  process.env.ZOHO_CLIENT_SECRET = 'secret'
  if (env) process.env.ZOHO_REFRESH_TOKEN = env; else delete process.env.ZOHO_REFRESH_TOKEN
  let seen = ''
  globalThis.fetch = async (url) => { seen = String(url); return { ok: true, json: async () => ({ access_token: 'a', expires_in: 3600 }) } }
  try {
    const mod = await import('../lib/zoho-oauth.js?case=' + Math.random())
    await mod.getAccessToken()
    return new URL(seen).searchParams.get('refresh_token')
  } finally {
    globalThis.fetch = saved.fetch
    for (const [k, v] of [['DATA_DIR', saved.DATA_DIR], ['ZOHO_REFRESH_TOKEN', saved.T], ['ZOHO_CLIENT_ID', saved.ID], ['ZOHO_CLIENT_SECRET', saved.SEC]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

describe('which Zoho refresh token is used', () => {
  test('the saved connection wins over the token from the environment', async () => {
    assert.equal(await tokenUsed({ file: 'from-reconnect', env: 'from-repo-secret' }), 'from-reconnect')
  })
  test('with no saved connection the environment token is used', async () => {
    assert.equal(await tokenUsed({ env: 'from-repo-secret' }), 'from-repo-secret')
  })
  test('an empty saved file falls back to the environment token', async () => {
    assert.equal(await tokenUsed({ file: '   ', env: 'from-repo-secret' }), 'from-repo-secret')
  })
  test('neither one: a clear message', async () => {
    await assert.rejects(() => tokenUsed({}), /not connected yet/)
  })
})
