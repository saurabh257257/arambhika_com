// Helps search engines and AI assistants find and understand the store:
//  - /llms.txt: a plain-text summary of who we are, what we make and where each product lives
//  - IndexNow: tells Bing (which ChatGPT search draws on), Yandex and others the moment a product or
//    category page appears or is removed, instead of waiting for them to re-crawl the sitemap.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { slugify, allProducts, SITE_URL } from './product-pages.js'
import { listCategories } from './category-pages.js'

// The key is public by design (it is served at /<key>.txt so the engine can verify the site is ours).
export const indexNowKey = () =>
  process.env.INDEXNOW_KEY || crypto.createHash('sha256').update(`indexnow:${SITE_URL()}`).digest('hex').slice(0, 32)

export function renderLlmsTxt(catalog) {
  const site = SITE_URL()
  const cats = listCategories(catalog)
  const lines = [
    '# Arambhika',
    '',
    '> Arambhika is an Indian manufacturer and supplier of nickel strips (pure and plated), copper and aluminium busbars, BMS, epoxy board and battery cells for lithium-ion battery pack makers (EV, ESS, e-bike and solar storage). Bulk B2B supply with a GST invoice, shipped across India.',
    '',
    '## About',
    `- Website: ${site}/`,
    '- Location: SK-201, Sector 116, Noida, Uttar Pradesh 201301, India',
    '- Phone / WhatsApp: +91 93155 45821',
    '- Email: info@arambhika.com',
    '- Prices are in INR per kg and exclude GST (added at checkout). Minimum order quantities apply per product.',
    '- Items marked "available on request" can be requested on WhatsApp or from the product page.',
    '',
    '## Product categories',
    ...cats.map((c) => `- [${c.name}](${site}/category/${c.slug}): ${c.products.length} products`),
    '',
    '## Guides and help',
    `- [Blog and buying guides](${site}/blog/)`,
    `- [Frequently asked questions](${site}/faq.html)`,
    `- [Nickel strip sizing guide for 18650, 21700 and 32650 cells](${site}/18650-21700-32650-nickel-strip-sizing-guide.html)`,
    '',
    '## Products',
  ]
  for (const c of cats) {
    lines.push('', `### ${c.name}`)
    for (const { product } of c.products) {
      const price = String(product.Price ?? '').replace(/[^\d.]/g, '')
      lines.push(`- [${product.ProductCode}](${site}/product/${slugify(product.ProductCode)})${price ? `: ₹${price} per ${product.Unit || 'KG'}` : ''}`)
    }
  }
  return lines.join('\n') + '\n'
}

export const pageUrls = (catalog) => {
  const site = SITE_URL()
  return [
    ...listCategories(catalog).map((c) => `${site}/category/${c.slug}`),
    ...allProducts(catalog).map(({ product }) => `${site}/product/${slugify(product.ProductCode)}`),
  ]
}

// Pings IndexNow with the pages that are new since the last ping (everything on the first run).
// Never throws: a failed ping must not affect the store.
export async function pingIndexNow(catalog, dataDir, { fetchImpl = fetch } = {}) {
  try {
    const site = SITE_URL()
    const file = path.join(dataDir, 'indexnow-sent.json')
    let sent = new Set()
    try { sent = new Set(JSON.parse(fs.readFileSync(file, 'utf8'))) } catch {}
    const urls = pageUrls(catalog)
    const fresh = urls.filter((u) => !sent.has(u))
    if (!fresh.length) return { sent: 0 }
    const host = new URL(site).host
    const res = await fetchImpl('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key: indexNowKey(), keyLocation: `${site}/${indexNowKey()}.txt`, urlList: fresh.slice(0, 10000) }),
    })
    if (res.status >= 200 && res.status < 300) {
      fs.mkdirSync(dataDir, { recursive: true })
      fs.writeFileSync(file, JSON.stringify(urls))
      return { sent: fresh.length }
    }
    return { sent: 0, status: res.status }
  } catch (err) {
    return { sent: 0, error: err.message }
  }
}
