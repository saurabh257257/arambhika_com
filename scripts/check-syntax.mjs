// Fails if any JavaScript file in the project does not parse. Cheap, and catches the "forgot a
// bracket" class of mistake before a deploy ever starts. `node --check` handles both ES modules
// (server, lib, tests) and classic browser scripts (public/*.js) based on the file's own syntax.

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SKIP = new Set(['node_modules', '.git', 'data'])
const files = []

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full)
    else if (/\.m?js$/.test(e.name)) files.push(full)
  }
}
walk(ROOT)

let failed = 0
for (const file of files) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (r.status !== 0) {
    failed += 1
    console.error(`SYNTAX ERROR in ${path.relative(ROOT, file)}\n${r.stderr}\n`)
  }
}

if (failed) {
  console.error(`${failed} of ${files.length} file(s) failed the syntax check`)
  process.exit(1)
}
console.log(`all ${files.length} JavaScript files parse`)
