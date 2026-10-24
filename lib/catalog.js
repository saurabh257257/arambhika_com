// Maps the Zoho storefront catalog into the products.json shape the static site's script.js expects.

const key = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim()

const CATEGORY_ORDER = [
  'Nickel Strip Plated', 'Nickel Strip Pure', 'Copper Busbar', 'Aluminium Busbar',
  'Cell Prismatic', 'Cell Li-ion', 'Cell LFP',
].map(key)

function normalizeUnit(raw) {
  const unit = clean(raw)
  if (!unit || /^kg$/i.test(unit)) return 'KG'
  return unit[0].toUpperCase() + unit.slice(1)
}

function toPlainText(text) {
  return String(text || '')
    .replace(/<br\s*\/?>|<\/p>|<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
}

const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', middot: '·', deg: '°', times: '×', Omega: 'Ω', micro: 'µ', plusmn: '±', le: '≤', ge: '≥', ndash: '–', mdash: '—', sup2: '²', sup3: '³' }
const decode = (s) => String(s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z0-9]+);/g, (m, n) => {
  if (n[0] === '#') { const code = n[1] === 'x' || n[1] === 'X' ? parseInt(n.slice(2), 16) : parseInt(n.slice(1), 10); return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m }
  return ENTITIES[n] ?? m
})

// Zoho descriptions are rich text (headings, bullet lists, tables). Only a small set of plain tags is kept, with
// every attribute removed, so the product page can show them properly without trusting whatever Zoho sends.
const KEEP_TAGS = { p: 'p', br: 'br', ul: 'ul', ol: 'ol', li: 'li', strong: 'strong', b: 'strong', em: 'em', i: 'em', sup: 'sup', sub: 'sub', h1: 'h3', h2: 'h3', h3: 'h3', h4: 'h4', h5: 'h4', h6: 'h4', table: 'table', thead: 'thead', tbody: 'tbody', tr: 'tr', th: 'th', td: 'td' }
export function sanitizeHtml(html) {
  const out = String(html || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(?![a-zA-Z\/])/g, '&lt;')
    .replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (m, close, name) => {
      const tag = KEEP_TAGS[name.toLowerCase()]
      if (!tag) return ''
      if (tag === 'br') return close ? '' : '<br>'
      return '<' + close + tag + '>'
    })
    .replace(/<p>\s*(<br>)?\s*<\/p>/g, '')
    .replace(/\s+\n/g, '\n')
    .trim()
  return out
}

function htmlToText(html) {
  return decode(String(html || '')
    .replace(/<br\s*\/?>|<\/(p|li|h[1-6]|tr|div|table|ul|ol)>/gi, '\n')
    .replace(/<\/(td|th)>/gi, ' | ')
    .replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ').replace(/ ?\| ?\n/g, '\n').replace(/\n\s*\n+/g, '\n').trim()
}

// A long or structured description is kept as proper HTML (shown under "Description"); a short plain one is
// the size line of older products and keeps its old treatment.
function describe(raw) {
  const text = htmlToText(raw)
  const rich = /<(h[1-6]|ul|ol|table)\b/i.test(String(raw || '')) || text.length > 160
  if (!rich) return { ...parseDescription(raw), descriptionHtml: '', descriptionText: '', summary: '' }
  const firstPara = (String(raw).match(/<p\b[^>]*>([\s\S]*?)<\/p>/i) || [])[1]
  let summary = htmlToText(firstPara || text).replace(/\s+/g, ' ')
  if (summary.length > 300) summary = summary.slice(0, 300).replace(/\s+\S*$/, '') + '...'
  return { dimensions: '', details: [], descriptionHtml: sanitizeHtml(raw), descriptionText: text.slice(0, 2500), summary }
}

// Descriptions are free text: "Sub-category: X", a size paragraph, then extra notes.
function parseDescription(text) {
  const paragraphs = toPlainText(text).replace(/\r/g, '').split(/\n\s*\n/)
    .map((p) => p.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((p) => p.length)
  const details = []
  let dimensions = ''
  for (const lines of paragraphs) {
    if (/^sub-?category:/i.test(lines.join(' '))) details.push(lines.join(' '))
    else if (!dimensions) dimensions = lines.join('\n')
    else details.push(...lines)
  }
  return { dimensions, details }
}

function categoryRank(name) {
  const i = CATEGORY_ORDER.indexOf(key(name))
  return i === -1 ? CATEGORY_ORDER.length : i
}

export function buildCatalog({ categories: zohoCategories, products: zohoProducts, collections: zohoCollections }) {
  // Only categories that are switched on in the online store are returned by Zoho.
  const categoryNames = new Map()
  const categoryImages = new Map() // category name -> the photo set on the category in Zoho
  const categoryHandles = new Map() // category name -> Zoho's own handle, stable across renames
  const addCategory = (c) => {
    if (c.visibility === false) return
    categoryNames.set(String(c.category_id), clean(c.name))
    if (c.handle) categoryHandles.set(clean(c.name), String(c.handle))
    const pic = (c.images || []).find((i) => i && !i.is_placeholder_image && /^\/category-images\//.test(i.url || ''))
    if (pic) categoryImages.set(clean(c.name), `/zcat/${pic.id}/${pic.url.split('/')[2]}`)
    ;(c.sub_categories || []).forEach(addCategory)
  }
  zohoCategories.forEach(addCategory)

  const byCategory = new Map()
  for (const p of zohoProducts) {
    const categoryId = String(p.category_id ?? '')
    const uncategorised = !categoryId || categoryId === '0' || categoryId === '-1'
    const category = uncategorised ? 'Other' : categoryNames.get(categoryId)
    if (!category) continue // its category is switched off in Zoho

    const v = p.variants?.[0] || {}
    const name = clean(p.name)
    const { dimensions, details, descriptionHtml, descriptionText, summary } = describe(p.description)

    const docs = [...(p.documents || [])].sort((a, b) => (a.attachment_order || 0) - (b.attachment_order || 0))
    const images = docs.map((d) => `/zimg/${d.document_id}/${encodeURIComponent(d.name)}`)

    const price = Number(v.selling_price ?? p.selling_price)
    const stock = Number(v.stock_available) || 0
    const product = {
      SKU: clean(v.sku),
      ZohoVariantId: v.variant_id || '',
      Category: category,
      ProductCode: name,
      Image_Link: images,
      Price: price > 0 ? String(price) : '',
      Availability: stock > 0 ? 'Now' : 'Notify',
      Unit: normalizeUnit(p.unit || v.unit),
      'Minimum Quantity': Number(v.minimum_order_quantity) || 1,
      Product_Dimensions: dimensions,
      Additional_Details: details,
      Description_Html: descriptionHtml,
      Description_Text: descriptionText,
      Description_Summary: summary,
    }
    if (!byCategory.has(category)) byCategory.set(category, [])
    byCategory.get(category).push(product)
  }

  const categories = [...byCategory.entries()]
    .sort(([a], [b]) => categoryRank(a) - categoryRank(b) || a.localeCompare(b))
    .map(([name, products]) => ({
      name,
      Category: name, // catalog.html and pi.html read this key
      Image: categoryImages.get(name) || '',
      Handle: categoryHandles.get(name) || '',
      products: products.sort((a, b) =>
        (a.Availability === 'Now' ? 0 : 1) - (b.Availability === 'Now' ? 0 : 1) ||
        Boolean(b.SKU) - Boolean(a.SKU) ||
        (a.SKU || a.ProductCode).localeCompare(b.SKU || b.ProductCode, undefined, { numeric: true })),
    }))

  // Collections exactly as set up in Zoho: name plus the names of the products inside it.
  let collections
  if (Array.isArray(zohoCollections)) {
    const nameById = new Map(zohoProducts.map((p) => [String(p.product_id), clean(p.name)]))
    const present = new Set(categories.flatMap((cat) => cat.products.map((p) => p.ProductCode)))
    collections = zohoCollections
      .map((col) => ({ name: clean(col.name), handle: col.handle, products: col.productIds.map((id) => nameById.get(id)).filter((n) => n && present.has(n)) }))
      .filter((col) => col.products.length)
  }
  return collections ? { categories, collections } : { categories }
}
