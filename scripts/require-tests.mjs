// Pull-request rule: a change to application code must come with a change to the tests.
//
//   node scripts/require-tests.mjs <base-ref>
//
// Source changes are anything under lib/, public/, server.js or the pipeline scripts. They need at
// least one changed file under test/. The only way past it is an explicit, reviewable line in the
// PR description:   No-test-reason: <why a test genuinely does not apply>

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const base = process.argv[2] || 'origin/main'
const changed = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' })
  .split('\n').map((s) => s.trim()).filter(Boolean)

const isSource = (f) =>
  f === 'server.js' ||
  f.startsWith('lib/') ||
  (f.startsWith('public/') && /\.(html|js|css|json|xml|txt)$/.test(f))
const isTest = (f) => f.startsWith('test/') || f.startsWith('test-helpers/')

const sources = changed.filter(isSource)
const tests = changed.filter(isTest)

console.log(`changed: ${changed.length} files, ${sources.length} application, ${tests.length} test`)

if (!sources.length || tests.length) {
  console.log('OK: tests accompany the change')
  process.exit(0)
}

let body = ''
try {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH || '', 'utf8'))
  body = event.pull_request?.body || ''
} catch {}
const reason = (body.match(/^No-test-reason:\s*(.{10,})$/im) || [])[1]
if (reason) {
  console.log(`OK: no tests added, reason given: ${reason}`)
  process.exit(0)
}

console.error('FAIL: application code changed but no test was added or changed.\n')
console.error('Changed application files:\n  ' + sources.join('\n  '))
console.error('\nAdd or update a test under test/, or add this line to the PR description:\n  No-test-reason: <why a test does not apply>')
process.exit(1)
