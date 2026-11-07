// Shared helpers for the product-led blog posts (blog-content-products-*.mjs).
// Same post shape as blog-content-more.mjs; mk() fills the fields every post repeats.

export const p = (name) => `/?product=${encodeURIComponent(name)}#catalog`
export const guideNote = '<p class="blog-note">General guidance only. Check cell, BMS and strip datasheets and the standards that apply to your product before you build or sell a pack.</p>'

export const mk = (o) => ({
  category: o.category,
  tag: o.tag,
  slug: o.slug,
  title: o.title,
  short: o.short,
  description: o.description,
  keywords: o.keywords,
  teaser: o.short[1],
  productsHeading: o.productsHeading,
  ctaHeading: o.ctaHeading || 'Need these for your next build?',
  waText: o.waText || `Hi Arambhika, I read your blog on ${o.short[0]} and need a quote.`,
  date: '2026-11-07',
  dateLabel: '7 November 2026',
  readTime: o.readTime || 5,
  intro: o.intro,
  body: o.body + guideNote,
  faq: o.faq,
})
