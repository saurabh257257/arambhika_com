// The deploy script must refuse to run with an incomplete configuration, before it connects anywhere.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

const base = {
  PATH: process.env.PATH,
  APP_ENV: 'production',
  SSH_HOST: '203.0.113.10', // reserved documentation address: nothing should connect to it
  SSH_USER: 'root',
  SSH_PRIVATE_KEY: 'not-a-real-key',
  SSH_KNOWN_HOSTS: '203.0.113.10 ssh-ed25519 AAAA',
  DEPLOY_PATH: '/root/app',
}

function run(env) {
  return spawnSync('bash', ['scripts/deploy.sh'], { cwd: ROOT, env, encoding: 'utf8', timeout: 20000 })
}

describe('scripts/deploy.sh guards', () => {
  test('stops before connecting when application settings are missing', () => {
    const r = run(base)
    assert.notEqual(r.status, 0)
    const out = r.stdout + r.stderr
    assert.match(out, /Missing required settings for production/)
    for (const k of ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'SESSION_SECRET', 'MSG91_AUTHKEY', 'ADMIN_TOKEN']) {
      assert.match(out, new RegExp(k))
    }
  })

  test('names only what is actually missing', () => {
    const almost = {
      ...base,
      ZOHO_DC: 'in', ZOHO_STOREFRONT_DOMAIN: 'x', ZOHO_CLIENT_ID: 'a', ZOHO_CLIENT_SECRET: 'b',
      ZOHO_BOOKS_ORG_ID: '1', ZOHO_INVENTORY_ORG_ID: '2', ADMIN_TOKEN: 't', SESSION_SECRET: 's',
      MSG91_AUTHKEY: 'k', MSG91_TEMPLATE_ID: 'id', MSG91_OTP_LENGTH: '4', MSG91_OTP_EXPIRY: '5',
    }
    const r = run(almost)
    assert.notEqual(r.status, 0)
    const out = r.stdout + r.stderr
    assert.match(out, /Missing required settings for production: ZOHO_REDIRECT_URI/)
    assert.doesNotMatch(out, /ZOHO_CLIENT_ID/)
  })

  test('requires the SSH connection details too', () => {
    const r = run({ PATH: process.env.PATH, APP_ENV: 'dev' })
    assert.notEqual(r.status, 0)
    assert.match(r.stdout + r.stderr, /SSH_HOST is not set/)
  })
})
