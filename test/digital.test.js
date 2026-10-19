// The Digital Content tool is dev-only and separate from the website. These checks keep it that way.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

describe('isolation from the website release', () => {
  test('the website deploy never copies apps/ to a server', () => {
    assert.match(read('scripts/deploy.sh'), /--exclude 'apps'/)
  })

  test('the website server does not serve or reference the tool', () => {
    assert.doesNotMatch(read('server.js'), /digital-content/)
    for (const f of fs.readdirSync(path.join(ROOT, 'public')).filter((n) => n.endsWith('.html'))) {
      assert.doesNotMatch(read(`public/${f}`), /digital\.arambhika\.com|apps\/digital-content/, f)
    }
  })
})

describe('the digital workflow can only reach dev', () => {
  const wf = read('.github/workflows/digital-dev.yml')

  test('it triggers on the dev branch only', () => {
    assert.match(wf, /branches:\s*\[dev\]/)
    assert.doesNotMatch(wf, /branches:\s*\[[^\]]*main/)
  })

  test('its only deploy job uses the dev environment, with no production job', () => {
    assert.match(wf, /environment:\s*dev\b/)
    assert.doesNotMatch(wf, /environment:\s*production/)
    assert.doesNotMatch(wf, /refs\/heads\/main/)
    assert.equal((wf.match(/^\s{2}deploy[\w-]*:/gm) || []).length, 1)
  })

  test('there are no Google Drive settings to supply', () => {
    assert.doesNotMatch(wf, /GOOGLE_/)
    assert.doesNotMatch(read('scripts/deploy-digital.sh'), /GOOGLE_/)
  })

  test('credentials come from environment secrets, none is written in the file', () => {
    for (const name of ['DIGITAL_ADMIN_PASSWORD', 'DIGITAL_BYTEPLUS_API_KEY', 'DIGITAL_ANTHROPIC_API_KEY']) {
      assert.match(wf, new RegExp(`secrets\\.${name}`))
    }
    assert.doesNotMatch(wf, /sk-[A-Za-z0-9]{10,}/)
  })
})

describe('scripts/deploy-digital.sh', () => {
  const base = {
    PATH: process.env.PATH,
    SSH_HOST: '203.0.113.10', // reserved documentation address: nothing should connect to it
    SSH_USER: 'root',
    SSH_PRIVATE_KEY: 'not-a-key',
    SSH_KNOWN_HOSTS: '203.0.113.10 ssh-ed25519 AAAA',
  }
  const run = (env) => spawnSync('bash', ['scripts/deploy-digital.sh'], { cwd: ROOT, env, encoding: 'utf8', timeout: 20000 })

  test('refuses any environment other than dev', () => {
    for (const target of ['production', 'prod', 'staging', '']) {
      const r = run({ ...base, DEPLOY_ENV: target, ADMIN_PASSWORD: 'x' })
      assert.notEqual(r.status, 0, `"${target}" must be refused`)
    }
    const r = run({ ...base, DEPLOY_ENV: 'production', ADMIN_PASSWORD: 'x' })
    assert.match(r.stdout + r.stderr, /only deploys to the dev environment/)
  })

  test('refuses to deploy without a login password', () => {
    const r = run({ ...base, DEPLOY_ENV: 'dev' })
    assert.notEqual(r.status, 0)
    assert.match(r.stdout + r.stderr, /ADMIN_PASSWORD is not set/)
  })

  test('the tool itself will not start without a password and has no default one', () => {
    const server = read('apps/digital-content/server.js')
    assert.match(server, /ADMIN_PASSWORD is not set/)
    assert.doesNotMatch(server, /ADMIN_PASSWORD \|\| 'admin'/)
  })
})
