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

export function buildCatalog({ categories: zohoCategories, products: zohoProducts }, localCatalog) {
  // Only categories that are switched on in the online store are returned by Zoho.
  const categoryNames = new Map()
  const addCategory = (c) => {
    if (c.visibility === false) return
    categoryNames.set(String(c.category_id), clean(c.name))
    ;(c.sub_categories || []).forEach(addCategory)
  }
  zohoCategories.forEach(addCategory)

  // Local photos are only a fallback for products that have none in Zoho. Matched by
  // name, not SKU: the site's local SKUs collide with Zoho's (e.g. both have a "CP1").
  const localImages = new Map()
  for (const cat of localCatalog.categories || []) {
    for (const p of cat.products || []) {
      if (p.Image_Link?.length) localImages.set(key(p.ProductCode), p.Image_Link)
    }
  }

  const byCategory = new Map()
  for (const p of zohoProducts) {
    const categoryId = String(p.category_id ?? '')
    const uncategorised = !categoryId || categoryId === '0' || categoryId === '-1'
    const category = uncategorised ? 'Other' : categoryNames.get(categoryId)
    if (!category) continue // its category is switched off in Zoho

    const v = p.variants?.[0] || {}
    const name = clean(p.name)
    const { dimensions, details } = parseDescription(p.description)

    const docs = [...(p.documents || [])].sort((a, b) => (a.attachment_order || 0) - (b.attachment_order || 0))
    let images = docs.map((d) => `/zimg/${d.document_id}/${encodeURIComponent(d.name)}`)
    if (!images.length) images = localImages.get(key(name)) || []

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
    }
    if (!byCategory.has(category)) byCategory.set(category, [])
    byCategory.get(category).push(product)
  }

  const categories = [...byCategory.entries()]
    .sort(([a], [b]) => categoryRank(a) - categoryRank(b) || a.localeCompare(b))
    .map(([name, products]) => ({
      name,
      Category: name, // catalog.html and pi.html read this key
      products: products.sort((a, b) =>
        (a.Availability === 'Now' ? 0 : 1) - (b.Availability === 'Now' ? 0 : 1) ||
        Boolean(b.SKU) - Boolean(a.SKU) ||
        (a.SKU || a.ProductCode).localeCompare(b.SKU || b.ProductCode, undefined, { numeric: true })),
    }))

  return { categories }
}
