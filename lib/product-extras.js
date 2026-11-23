// Under every product: five guides (picked from the blog posts we already have) and five frequently asked questions
// (written from the product's own price, minimum order, size and category). Both are shown collapsed.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BLOG_DIR = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'public', 'blog')

const decode = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')

let blogCache = null
// every blog post: its address, title, description and keywords (read once, then kept)
export function blogIndex(dir = BLOG_DIR) {
  if (blogCache && dir === BLOG_DIR) return blogCache
  let list = []
  try {
    list = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.html') && f !== 'index.html')
      .map((file) => {
        const head = fs.readFileSync(path.join(dir, file), 'utf8').slice(0, 6000)
        const meta = (re) => decode((head.match(re) || [])[1] || '')
        return {
          url: '/blog/' + file,
          slug: file.replace(/\.html$/, ''),
          title: meta(/<title>([^<]*)<\/title>/).replace(/\s*\|\s*Arambhika.*$/i, '').trim(),
          description: meta(/<meta name="description" content="([^"]*)"/),
          keywords: meta(/<meta name="keywords" content="([^"]*)"/),
        }
      })
      .filter((b) => b.title)
  } catch { /* no blog folder: no guides */ }
  if (dir === BLOG_DIR) blogCache = list
  return list
}

const STOP = new Set(['the', 'and', 'for', 'with', 'without', 'mm', 'kg', 'pcs', 'new', 'model', 'type', 'size', 'set', 'per', 'cell', 'cells', 'strip', 'roll'])
const spaced = (text) => ` ${String(text || '').toLowerCase().replace(/[^a-z0-9.]+/g, ' ')} `
const hasWord = (text, word) => spaced(text).includes(` ${word.toLowerCase()} `)
const tokens = (text) => [...new Set(String(text || '').toLowerCase().split(/[^a-z0-9.]+/).map((t) => t.replace(/^\.+|\.+$/g, '')).filter((t) => t.length >= 3 && !STOP.has(t)))]

// words that say what kind of product it is, so a guide on the same subject ranks above one that only shares a number
const CATEGORY_WORDS = [
  [/nickel/i, ['nickel', 'strip', 'weld', 'spot', 'laser']],
  [/bus ?bar|busbar/i, ['busbar', 'bus bar', 'copper', 'aluminium']],
  [/bms/i, ['bms']],
  [/lfp|prismatic/i, ['lfp', 'prismatic', 'lifepo4']],
  [/nmc|cylindrical|18650|21700|32650/i, ['nmc', '18650', '21700', '32650']],
  [/holder/i, ['holder']],
  [/epoxy/i, ['epoxy']],
  [/potting/i, ['potting']],
  [/silicone|wire/i, ['silicone', 'wire']],
  [/hst|heat shrink/i, ['heat shrink', 'sleeve']],
  [/insulation/i, ['insulation']],
  [/tape/i, ['tape', 'kapton']],
  [/pvc/i, ['pvc', 'sleeve']],
  [/connector/i, ['connector']],
]

// five blog posts for a product, best match first (always five, as long as the blog has five)
export function guidesFor(product, posts = blogIndex(), count = 5) {
  const name = `${product.name || ''} ${product.category || ''}`
  const own = tokens(name)
  const kind = CATEGORY_WORDS.filter(([re]) => re.test(name)).flatMap(([, words]) => words)
  const scored = posts.map((post) => {
    const inTitle = `${post.slug} ${post.title}`
    let score = 0
    for (const t of own) {
      if (hasWord(inTitle, t)) score += 3
      else if (hasWord(post.keywords, t)) score += 2
      else if (hasWord(post.description, t)) score += 1
    }
    for (const w of kind) {
      if (hasWord(inTitle, w)) score += 2
      else if (hasWord(post.keywords, w)) score += 1
    }
    return { post, score }
  })
  scored.sort((a, b) => b.score - a.score || a.post.title.localeCompare(b.post.title))
  return scored.slice(0, count).map(({ post }) => ({ title: post.title, url: post.url }))
}

const KINDS = [
  ['nickel', /\bnickel/i],
  ['busbar', /bus ?bar/i],
  ['bms', /\bbms\b/i],
  ['holder', /holder/i],
  ['epoxy', /epoxy/i],
  ['potting', /potting/i],
  ['wire', /\bwire\b/i],
  ['hst', /\bhst\b|heat shrink/i],
  ['insulation', /insulation/i],
  ['tape', /\btapes?\b/i],
  ['pvc', /\bpvc\b/i],
  ['connector', /connector|\bgland\b/i],
  ['cell', /\bcells?\b|\blfp\b|\bnmc\b|prismatic|lithium/i],
]
const kindOf = (p) => {
  for (const text of [p.category || '', p.name || '']) {
    const hit = KINDS.find(([, re]) => re.test(text))
    if (hit) return hit[0]
  }
  return ''
}

const USE = {
  nickel: (p) => (/pure/i.test(`${p.category} ${p.name}`) ? 'Pure nickel (99.9%) strip for joining cells in a battery pack by spot or laser welding.' : 'Nickel-plated strip for joining cells in a battery pack by spot or laser welding.'),
  busbar: () => 'A busbar connects cells in a battery pack so current flows between them.',
  bms: () => 'A battery management system (BMS) protects a lithium battery pack against over-charge, over-discharge and over-current.',
  holder: () => 'Plastic cell holders (spacers) keep cylindrical cells aligned and spaced when assembling a battery pack.',
  epoxy: () => 'FR-4 glass epoxy sheet for insulation in battery packs, circuit boards and industrial use.',
  potting: () => 'Silicone potting compound for insulating and protecting battery packs, BMS boards and electronic modules.',
  wire: () => 'Flexible silicone-insulated copper wire for battery packs, EV wiring and BMS connections.',
  hst: () => 'Heat shrink tubing insulates and protects wire joints, terminals and battery-pack harnesses.',
  insulation: () => 'Insulation paper and rings keep the conductive parts of cylindrical cells apart in a battery pack.',
  tape: () => 'Tape for insulating and securing parts when assembling a battery pack.',
  pvc: () => 'PVC sleeve or spiral for covering and organising cells and wires in a battery pack.',
  connector: () => 'A connector for battery packs and their wiring.',
  cell: () => 'A lithium cell for building battery packs.',
}

// five questions with answers taken from the product's own details; nothing here is made up about a particular item
export function faqsFor(p) {
  const name = p.name
  const kind = kindOf(p)
  const unit = p.unit || 'KG'
  const use = kind ? USE[kind](p) : 'A component for assembling lithium battery packs.'
  const faqs = [{ q: `What is ${name} used for?`, a: `${use} It is sold per ${unit}.` }]

  if (kind === 'nickel') {
    const t = (name.match(/0\.(15|20|30)\s*mm/i) || [])[0]
    const thin = /0\.15/.test(t || '')
    faqs.push({ q: `Which welding method suits ${name}?`, a: t ? (thin ? 'A 0.15 mm strip is suited to spot welding.' : 'A 0.20 mm or 0.30 mm strip is suited to laser welding.') : 'Strips of 0.15 mm are suited to spot welding; 0.20 mm and 0.30 mm strips are suited to laser welding.' })
  } else if (kind === 'bms') {
    faqs.push({ q: 'How do I choose the right BMS?', a: 'Match three things: the cell chemistry (LFP or NMC), the number of cells in series (the S number) and the continuous current in amps (A). The model name of this product shows its series count and current.' })
  } else if (kind === 'cell') {
    faqs.push({ q: `Do I need a BMS with ${name}?`, a: 'Yes. Lithium cells should always be used in a pack with a battery management system (BMS) matched to the chemistry and the number of cells in series. We also supply JBD and Daly BMS.' })
  } else if (kind === 'busbar') {
    faqs.push({ q: 'How do I pick the right busbar?', a: 'Choose by the cell format and layout (series, parallel or L-shape) and by the current the busbar has to carry. Our busbar sizing guide below helps with the choice.' })
  } else {
    const spec = p.dimensions || p.summary || ''
    faqs.push({ q: `What are the specifications of ${name}?`, a: spec ? `${String(spec).replace(/\s+/g, ' ').trim().replace(/[.]*$/, '')}.` : 'The full specifications are in the description on this page.' })
  }

  faqs.push({
    q: `What is the minimum order and price of ${name}?`,
    a: `The minimum order is ${p.min || 1} ${unit}. ${p.price ? `The listed price is ₹${p.price} per ${unit}.` : 'The price is available on request.'} Larger B2B quantities are welcome, so ask us for bulk pricing.`,
  })
  faqs.push({ q: 'Do you deliver across India and give a GST invoice?', a: 'Yes. We ship across India from Greater Noida, Uttar Pradesh, and give a GST invoice with every order.' })
  faqs.push({ q: `How do I order ${name}?`, a: 'Add it to your cart on this page and check out, or message us on WhatsApp for a quote. If it shows Notify or On request, ask us for the lead time.' })
  return faqs
}
