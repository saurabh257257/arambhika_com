// SEO and page-quality rules for every public page. Pages that must stay out of search results
// (account, admin-ish pages) are expected to say so, and everything else must be fully optimised.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PUBLIC = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'public')

// Pages that are private by design: must be noindex and must not appear in the sitemap.
const PRIVATE_PAGES = new Set(['account.html', 'admin.html', 'pi.html', 'completed.html', 'catalogdownload.html'])

function htmlFiles(dir = PUBLIC, base = '') {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.posix.join(base, entry.name)
    if (entry.isDirectory()) { if (entry.name !== 'assets') out.push(...htmlFiles(path.join(dir, entry.name), rel)) }
    else if (entry.name.endsWith('.html')) out.push(rel)
  }
  return out
}

const read = (rel) => fs.readFileSync(path.join(PUBLIC, rel), 'utf8')
const meta = (html, name) => (html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i')) || [])[1]
const pages = htmlFiles()
const indexable = pages.filter((p) => !PRIVATE_PAGES.has(p))

describe('site-wide files', () => {
  test('there are pages to check', () => {
    assert.ok(pages.length >= 8, `expected the site pages, found ${pages.length}`)
  })

  test('robots.txt allows crawling and points to the sitemap', () => {
    const robots = read('robots.txt')
    assert.match(robots, /User-agent:\s*\*/i)
    assert.match(robots, /Sitemap:\s*https:\/\/\S+\/sitemap\.xml/i)
    assert.doesNotMatch(robots, /^Disallow:\s*\/\s*$/m, 'robots.txt must not block the whole site')
  })

  test('sitemap.xml is well formed and every listed page exists', () => {
    const xml = read('sitemap.xml')
    assert.match(xml, /<urlset/)
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    assert.ok(locs.length > 0, 'sitemap lists no URLs')
    for (const loc of locs) {
      assert.match(loc, /^https:\/\//, `${loc} must be https`)
      const pathname = new URL(loc).pathname.replace(/^\//, '')
      if (!pathname) continue
      const candidates = [pathname, `${pathname}.html`, path.posix.join(pathname, 'index.html')]
      assert.ok(candidates.some((c) => fs.existsSync(path.join(PUBLIC, c))), `${loc} is in the sitemap but no page exists`)
    }
  })

  test('private pages are not in the sitemap', () => {
    const xml = read('sitemap.xml')
    for (const p of PRIVATE_PAGES) assert.ok(!xml.includes(`/${p}`), `${p} must not be listed in sitemap.xml`)
  })
})

describe('private pages stay out of search results', () => {
  for (const page of PRIVATE_PAGES) {
    if (!fs.existsSync(path.join(PUBLIC, page))) continue
    test(`${page} is noindex or disallowed in robots.txt`, () => {
      const noindex = /<meta[^>]+name=["']robots["'][^>]*noindex/i.test(read(page))
      const blocked = new RegExp(`^Disallow:\\s*/${page.replace('.', '\\.')}\\s*$`, 'm').test(read('robots.txt'))
      assert.ok(noindex || blocked, `${page} must be noindex or disallowed`)
    })
  }
})

// Known gaps that existed before this test suite did. Each entry is a real SEO defect to fix; the
// list can only shrink: a new page must pass every rule, and fixing a page makes its entry here
// fail until it is removed, so the debt cannot quietly grow or linger.
const KNOWN_GAPS = {
  'capabilities.html': ['h1'],
  'catalog.html': ['h1', 'og'],
  'contact.html': ['h1'],
  'contactus.html': ['description', 'h1', 'canonical', 'og'],
  'index.html': ['h1'],
  'refund-policy.html': ['og'],
  'terms.html': ['og'],
}

const decode = (t) => t.replace(/&amp;/g, '&').replace(/&#39;|&rsquo;|&#8217;/g, "'").replace(/&quot;/g, '"')

const RULES = {
  title(html) {
    const title = decode((html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '').trim()
    assert.ok(title, 'missing <title>')
    assert.ok(title.length >= 10 && title.length <= 100, `title is ${title.length} characters: "${title}"`)
  },
  description(html) {
    const d = meta(html, 'description')
    assert.ok(d, 'missing meta description')
    assert.ok(d.length >= 50 && d.length <= 320, `description is ${d.length} characters`)
  },
  h1(html) {
    const count = (html.match(/<h1[\s>]/gi) || []).length
    assert.equal(count, 1, `found ${count} <h1> elements`)
  },
  lang(html) {
    assert.match(html, /<html[^>]+lang=["'][a-z-]+["']/i, 'missing lang on <html>')
    assert.match(html, /<meta[^>]+name=["']viewport["']/i, 'missing viewport meta')
  },
  canonical(html) {
    const m = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
    assert.ok(m, 'missing canonical link')
    assert.match(m[1], /^https:\/\//)
    assert.doesNotMatch(html, /<meta[^>]+name=["']robots["'][^>]*noindex/i, 'an indexable page must not be noindex')
  },
  og(html) {
    for (const p of ['og:title', 'og:description', 'og:image']) assert.ok(meta(html, p), `missing ${p}`)
  },
  jsonld(html) {
    const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1])
    for (const b of blocks) {
      const data = JSON.parse(b)
      assert.ok(data['@type'] || data['@graph'], 'structured data has no @type')
    }
  },
  imgalt(html) {
    for (const tag of html.match(/<img[^>]*>/gi) || []) assert.match(tag, /alt=/i, `image without alt: ${tag.slice(0, 80)}`)
  },
  noopener(html) {
    for (const tag of html.match(/<a[^>]*target=["']_blank["'][^>]*>/gi) || []) {
      assert.match(tag, /rel=["'][^"']*noopener/i, `unsafe _blank link: ${tag.slice(0, 100)}`)
    }
  },
}

for (const page of indexable) {
  describe(`SEO: ${page}`, () => {
    const html = read(page)
    const known = new Set(KNOWN_GAPS[page] || [])
    for (const [rule, check] of Object.entries(RULES)) {
      test(`${rule}${known.has(rule) ? ' (known gap)' : ''}`, () => {
        let failure = null
        try { check(html) } catch (err) { failure = err }
        if (known.has(rule)) {
          assert.ok(failure, `${page} now passes "${rule}": remove it from KNOWN_GAPS`)
        } else if (failure) {
          throw failure
        }
      })
    }
  })
}

test('KNOWN_GAPS only names pages and rules that exist', () => {
  for (const [page, rules] of Object.entries(KNOWN_GAPS)) {
    assert.ok(pages.includes(page), `${page} is not a page`)
    for (const r of rules) assert.ok(r in RULES, `unknown rule ${r}`)
  }
})

// The old domain (arambhikaenablers.in) is retired: it only redirects now. Nothing on the site may
// point search engines or visitors back at it, and every canonical must use the one real host.
describe('single canonical host: www.arambhika.com', () => {
  const HOST = 'https://www.arambhika.com'
  const sources = [...pages.map((p) => p), 'sitemap.xml', 'image-sitemap.xml', 'robots.txt']

  test('no file in public/ mentions the retired domain', () => {
    const offenders = sources.filter((f) => /arambhikaenablers/i.test(read(f)))
    assert.deepEqual(offenders, [], 'these files still reference arambhikaenablers.in')
  })

  test('the blog builder uses the canonical host', () => {
    const builder = fs.readFileSync(path.join(PUBLIC, '..', 'scripts', 'build-blog.mjs'), 'utf8')
    assert.match(builder, /const SITE = 'https:\/\/www\.arambhika\.com'/)
    assert.doesNotMatch(builder, /arambhikaenablers/i)
  })

  for (const page of indexable) {
    test(`${page}: canonical and og:url are on ${HOST}`, () => {
      const html = read(page)
      const canonical = (html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || [])[1]
      if (canonical) assert.ok(canonical.startsWith(`${HOST}/`), `canonical is ${canonical}`)
      const ogUrl = meta(html, 'og:url')
      if (ogUrl) assert.ok(ogUrl.startsWith(`${HOST}/`), `og:url is ${ogUrl}`)
    })
  }

  test('sitemap and image sitemap list only canonical-host URLs', () => {
    for (const f of ['sitemap.xml', 'image-sitemap.xml']) {
      const locs = [...read(f).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
      const wrong = locs.filter((l) => /^https?:\/\//.test(l) && !l.startsWith(`${HOST}/`) && !/^https:\/\/(?!.*arambhika)/.test(l))
      assert.deepEqual(wrong, [], `${f} has URLs off the canonical host`)
    }
  })

  test('robots.txt sitemap lines are on the canonical host', () => {
    const lines = read('robots.txt').split('\n').filter((l) => /^Sitemap:/i.test(l))
    assert.ok(lines.length >= 1)
    for (const l of lines) assert.match(l, /^Sitemap:\s*https:\/\/www\.arambhika\.com\//i)
  })
})
