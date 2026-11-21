// The public pages, written as plain HTML on the server so every product page can be found by search engines and opens instantly.
'use strict';
const { slugify } = require('./db');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '₹' + Number(n).toLocaleString('en-IN');
const productUrl = (l) => '/p/' + l.id + '-' + (slugify(l.title) || 'product');
const num = (n) => (n == null ? '' : String(Math.round(n * 100) / 100));
const BOLT = '<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><rect x="2" y="7" width="26" height="18" rx="4" fill="#0b1f3a"/><rect x="28" y="12" width="3" height="8" rx="1.5" fill="#0b1f3a"/><path d="M17 9l-6 9h5l-1 6 7-10h-5z" fill="#22c55e"/></svg>';
const CELL = '<svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true"><rect x="3" y="8" width="24" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="27" y="13" width="3" height="6" rx="1" fill="currentColor"/><path d="M16 11l-4 6h4l-1 4 5-7h-4z" fill="currentColor"/></svg>';
const WA = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 .9-2.2.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.8-1c.2-.2.4-.2.6-.1l2 .9c.3.1.5.2.5.3.1.2.1.6-.1 1.2z"/></svg>';

function specLine(l) {
  const a = [];
  if (l.voltage != null) a.push(num(l.voltage) + ' V');
  if (l.capacity_ah != null) a.push(num(l.capacity_ah) + ' Ah');
  if (l.energy_wh != null) a.push(num(l.energy_wh) + ' Wh');
  if (l.chemistry) a.push(l.chemistry);
  return a.join(' · ');
}
const priceHtml = (l) => (l.price == null ? '<span class="onreq">Price on request</span>' : '<span class="amt">' + money(l.price) + '</span> <span class="unit">/ ' + esc((l.price_unit || 'per piece').replace(/^per /, '')) + '</span>');
const waLink = (l, cls, label) => '<a class="btn wa ' + (cls || '') + '" href="/go/' + l.id + '" rel="nofollow noopener" target="_blank">' + WA + esc(label || 'Chat on WhatsApp') + '</a>';
const initial = (s) => esc((s || '?').trim().charAt(0).toUpperCase() || '?');

function layout({ title, description, canonical, image, body, user, siteUrl, jsonld, noindex, active, cats = [], q = '', category = '' }) {
  const full = (title ? title + ' | ' : '') + 'Lithium Directory';
  const desc = description || 'Lithium Directory lists lithium-ion batteries, packs and cells from manufacturers across India. Browse and message the seller directly on WhatsApp.';
  const canon = canonical && siteUrl ? siteUrl + canonical : '';
  const live = cats.filter((c) => c.live > 0);
  const search = '<form class="hsearch" action="/browse" method="get" role="search"><select name="category" aria-label="Category"><option value="">All categories</option>' + live.map((c) => '<option value="' + esc(c.slug) + '"' + (c.slug === category ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select>' +
    '<input name="q" type="search" value="' + esc(q) + '" placeholder="Search products, e.g. 48V 30Ah LiFePO4" aria-label="Search products"><button type="submit">Search</button></form>';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + esc(full) + '</title><meta name="description" content="' + esc(desc) + '">' + (noindex ? '<meta name="robots" content="noindex">' : '') + (canon ? '<link rel="canonical" href="' + esc(canon) + '">' : '') +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="Lithium Directory"><meta property="og:title" content="' + esc(full) + '"><meta property="og:description" content="' + esc(desc) + '">' + (image && siteUrl ? '<meta property="og:image" content="' + esc(siteUrl + image) + '">' : '') +
    '<meta name="theme-color" content="#0b1f3a"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/style.css">' + (jsonld ? '<script type="application/ld+json">' + JSON.stringify(jsonld).replace(/</g, '\\u003c') + '</script>' : '') + '</head><body>' +
    '<div class="strip"><div class="wrap strip-in"><span>India\'s directory of lithium-ion batteries and packs</span><span class="strip-r"><a href="/about">How it works</a><a href="/terms">Terms and safety</a>' + (user && user.admin ? '<a href="/admin">Admin</a>' : '') + '</span></div></div>' +
    '<header class="top"><div class="wrap bar"><a class="brand" href="/">' + BOLT + '<span>Lithium Directory</span></a>' + search +
    '<div class="acct"><a class="link" href="/sell">' + (user ? 'My products' : 'Log in') + '</a><a class="btn" href="/sell">Sell your batteries</a></div></div>' +
    (live.length ? '<nav class="catnav" aria-label="Categories"><div class="wrap catnav-in"><a href="/browse"' + (active === 'browse' && !category ? ' class="on"' : '') + '>All products</a>' + live.map((c) => '<a href="/browse?category=' + esc(c.slug) + '"' + (c.slug === category ? ' class="on"' : '') + '>' + esc(c.name) + '</a>').join('') + '</div></nav>' : '') + '</header>' +
    '<main>' + body + '</main>' +
    '<footer class="foot"><div class="wrap foot-in"><div><div class="brand sm">' + BOLT + '<span>Lithium Directory</span></div><p class="muted">A product of Arambhika. We list lithium-ion batteries and related products from manufacturers and suppliers across India. Buyers and sellers deal directly with each other.</p></div>' +
    '<div><h4>Explore</h4><a href="/browse">Browse products</a><a href="/sell">Sell your batteries</a><a href="/about">How it works</a><a href="/terms">Terms and safety</a></div></div>' +
    '<div class="wrap copy">© ' + new Date().getFullYear() + ' Lithium Directory by Arambhika</div></footer></body></html>';
}

// a compact product card for the home page and "more like this"
function card(l) {
  return '<article class="card"><a class="ph" href="' + productUrl(l) + '" tabindex="-1" aria-hidden="true">' + (l.cover_id ? '<img src="/img/' + l.cover_id + '" alt="" loading="lazy">' : '<div class="noimg">' + BOLT + '</div>') + '</a>' +
    '<div class="cb"><div class="cat">' + esc(l.category_name) + '</div><h3><a href="' + productUrl(l) + '">' + esc(l.title) + '</a></h3><div class="spec">' + esc(specLine(l)) + '</div><div class="price">' + priceHtml(l) + '</div>' +
    '<div class="by"><b>' + esc(l.seller_business) + '</b><span>' + esc(l.city) + ', ' + esc(l.state) + '</span></div>' + waLink(l, 'sm full', 'Chat with supplier') + '</div></article>';
}
const grid = (rows) => '<div class="grid">' + rows.map(card).join('') + '</div>';

// a result row for the browse page, in the style of a marketplace listing
function row(l) {
  const kv = [['Voltage', l.voltage != null ? num(l.voltage) + ' V' : ''], ['Capacity', l.capacity_ah != null ? num(l.capacity_ah) + ' Ah' : ''], ['Energy', l.energy_wh != null ? num(l.energy_wh) + ' Wh' : ''], ['Chemistry', l.chemistry], ['Warranty', l.warranty], ['Minimum order', l.min_order]].filter((x) => x[1]).slice(0, 6);
  return '<article class="lrow"><a class="rimg" href="' + productUrl(l) + '" tabindex="-1" aria-hidden="true">' + (l.cover_id ? '<img src="/img/' + l.cover_id + '" alt="" loading="lazy">' : '<div class="noimg">' + BOLT + '</div>') + '</a>' +
    '<div class="rmain"><div class="cat">' + esc(l.category_name) + '</div><h3><a href="' + productUrl(l) + '">' + esc(l.title) + '</a></h3><div class="price">' + priceHtml(l) + '</div>' +
    (kv.length ? '<dl class="rspec">' + kv.map((x) => '<div><dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd></div>').join('') + '</dl>' : '') + '<p class="rdesc">' + esc(l.description.slice(0, 150)) + (l.description.length > 150 ? '...' : '') + '</p></div>' +
    '<div class="rside"><div class="sup"><span class="av sm">' + initial(l.seller_business) + '</span><div><b>' + esc(l.seller_business) + '</b><span class="muted">' + esc(l.city) + ', ' + esc(l.state) + '</span></div></div>' +
    waLink(l, 'full', 'Chat on WhatsApp') + '<a class="btn ghost full" href="' + productUrl(l) + '">View details</a></div></article>';
}

function home({ cats, latest, stats, states }) {
  const live = cats.filter((c) => c.live > 0);
  const side = '<aside class="catside"><h2>Categories</h2><ul>' + (live.length ? live.map((c) => '<li><a href="/browse?category=' + esc(c.slug) + '"><span>' + esc(c.name) + '</span><em>' + c.live + '</em></a></li>').join('') : '<li class="muted small" style="padding:10px 14px">Categories appear as products are listed.</li>') + '</ul><a class="more" href="/browse">All products</a></aside>';
  const banner = '<div class="banner"><span class="kick">For buyers and manufacturers</span><h1>Find lithium-ion batteries direct from Indian manufacturers</h1><p>Battery packs, e-scooter and e-bike batteries, solar storage and cells. See the specifications and price, then message the maker on WhatsApp.</p>' +
    '<div class="bcta"><a class="btn lg" href="/browse">Browse products</a><a class="btn ghost lg" href="/sell">Sell your batteries</a></div><ul class="ticks"><li>No sign-up for buyers</li><li>Chat directly on WhatsApp</li><li>Listings are reviewed</li></ul></div>';
  const sell = '<aside class="sellcard"><h2>Make batteries? List them free.</h2><p>Log in with your mobile number and reach buyers across India.</p><ol><li>Log in with an SMS code</li><li>Add photos, specifications and price</li><li>Get enquiries on your WhatsApp</li></ol><a class="btn full" href="/sell">Start listing</a>' + (stats.live ? '<span class="muted small">' + stats.live + ' products listed so far</span>' : '') + '</aside>';
  const tiles = live.length ? '<section class="wrap sec"><div class="sechead"><h2>Shop by category</h2><a class="link" href="/browse">See all</a></div><div class="tiles">' + live.map((c, i) => '<a class="tile t' + (i % 6) + '" href="/browse?category=' + esc(c.slug) + '"><span class="ic">' + CELL + '</span><b>' + esc(c.name) + '</b><span class="muted">' + c.live + ' product' + (c.live === 1 ? '' : 's') + '</span></a>').join('') + '</div></section>' : '';
  const st = states && states.length ? '<section class="wrap sec"><div class="sechead"><h2>Browse by state</h2></div><div class="schips">' + states.slice(0, 14).map((s) => '<a href="/browse?state=' + encodeURIComponent(s.state) + '">' + esc(s.state) + ' <span>' + s.n + '</span></a>').join('') + '</div></section>' : '';
  return '<section class="hero"><div class="wrap hgrid">' + side + banner + sell + '</div></section>' + tiles +
    '<section class="wrap sec"><div class="sechead"><h2>Latest products</h2><a class="link" href="/browse">See all</a></div>' + (latest.length ? grid(latest) : '<p class="empty">New products are being added. Check back soon, or <a href="/sell">list yours</a>.</p>') + '</section>' + st +
    '<section class="band"><div class="wrap steps"><div><span class="n">1</span><h3>Search</h3><p>Filter by category, voltage, chemistry, price and state to find the right battery.</p></div>' +
    '<div><span class="n">2</span><h3>Message on WhatsApp</h3><p>Every product has a WhatsApp button that opens a chat with the seller. No sign-up for buyers.</p></div>' +
    '<div><span class="n">3</span><h3>Deal directly</h3><p>Agree on price, quantity and delivery with the manufacturer. There is no checkout on this site.</p></div></div></section>';
}

function qs(params, over) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...over })) if (v !== '' && v != null && !(k === 'page' && Number(v) <= 1)) p.set(k, v);
  const s = p.toString(); return s ? '?' + s : '';
}

function browse({ result, params, cats, states, chemistries }) {
  const opt = (v, label, cur) => '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + esc(label) + '</option>';
  const cat = cats.find((c) => c.slug === params.category);
  const filters = '<details class="fwrap" id="fwrap" open><summary>Filters and sorting</summary><form class="filters" action="/browse" method="get"><h2>Refine results</h2>' +
    '<label>Search<input name="q" value="' + esc(params.q || '') + '" placeholder="Name, brand, city"></label>' +
    '<label>Category<select name="category">' + opt('', 'All categories', params.category) + cats.map((c) => opt(c.slug, c.name + ' (' + c.live + ')', params.category)).join('') + '</select></label>' +
    '<label>Chemistry<select name="chemistry">' + opt('', 'Any', params.chemistry) + chemistries.map((c) => opt(c, c, params.chemistry)).join('') + '</select></label>' +
    '<label>State<select name="state">' + opt('', 'All India', params.state) + states.map((s) => opt(s.state, s.state + ' (' + s.n + ')', params.state)).join('') + '</select></label>' +
    '<div class="two"><label>Min voltage<input name="minVoltage" inputmode="decimal" value="' + esc(params.minVoltage || '') + '" placeholder="V"></label><label>Max voltage<input name="maxVoltage" inputmode="decimal" value="' + esc(params.maxVoltage || '') + '" placeholder="V"></label></div>' +
    '<div class="two"><label>Min price<input name="minPrice" inputmode="numeric" value="' + esc(params.minPrice || '') + '" placeholder="Rs"></label><label>Max price<input name="maxPrice" inputmode="numeric" value="' + esc(params.maxPrice || '') + '" placeholder="Rs"></label></div>' +
    '<label>Sort by<select name="sort">' + opt('', 'Newest first', params.sort) + opt('price_asc', 'Price, low to high', params.sort) + opt('price_desc', 'Price, high to low', params.sort) + '</select></label>' +
    '<button class="btn" type="submit">Apply filters</button><a class="link clear" href="/browse">Clear all</a></form></details>';
  const pg = result.pages > 1 ? '<nav class="pager" aria-label="Pages">' + (result.page > 1 ? '<a class="btn ghost" href="/browse' + qs(params, { page: result.page - 1 }) + '">Previous</a>' : '') +
    '<span>Page ' + result.page + ' of ' + result.pages + '</span>' + (result.page < result.pages ? '<a class="btn ghost" href="/browse' + qs(params, { page: result.page + 1 }) + '">Next</a>' : '') + '</nav>' : '';
  const nofilters = !Object.entries(params).some(([k, v]) => v && k !== 'page');
  const active = [params.q && '"' + params.q + '"', params.chemistry, params.state].filter(Boolean);
  return '<div class="wrap crumbs2"><a href="/">Home</a> / <span>' + esc(cat ? cat.name : 'All products') + '</span></div><div class="wrap browse"><aside>' + filters + '</aside><section><div class="sechead"><div><h1 class="h2">' + esc(cat ? cat.name : params.q ? 'Results for "' + params.q + '"' : 'All products') + '</h1>' +
    (active.length ? '<div class="muted small">Filtered by ' + esc(active.join(', ')) + '</div>' : '') + '</div><span class="muted">' + result.total + ' product' + (result.total === 1 ? '' : 's') + ' found</span></div>' +
    (result.rows.length ? '<div class="lrows">' + result.rows.map(row).join('') + '</div>' : '<p class="empty">No products match these filters. Try removing one, or <a href="/browse">see everything</a>.</p>') + pg + '</section></div>' + (nofilters ? '<script src="/browse.js" defer></script>' : '');
}

function product({ l, related, siteUrl }) {
  const imgs = l.photos.length ? '<div class="gal"><div class="main"><img id="mainimg" src="/img/' + l.photos[0].id + '" alt="' + esc(l.title) + '"></div>' +
    (l.photos.length > 1 ? '<div class="thumbs">' + l.photos.map((p, i) => '<button type="button" class="th' + (i === 0 ? ' on' : '') + '" data-src="/img/' + p.id + '" aria-label="Photo ' + (i + 1) + '"><img src="/img/' + p.id + '" alt="" loading="lazy"></button>').join('') + '</div>' : '') + '</div>'
    : '<div class="gal"><div class="main empty-img">' + BOLT + '<span>No photo yet</span></div></div>';
  const rowTr = (k, v) => (v ? '<tr><th>' + esc(k) + '</th><td>' + esc(v) + '</td></tr>' : '');
  const specs = '<table class="specs"><tbody>' + rowTr('Category', l.category_name) + rowTr('Brand', l.brand) + rowTr('Chemistry', l.chemistry) + rowTr('Voltage', l.voltage != null ? num(l.voltage) + ' V' : '') + rowTr('Capacity', l.capacity_ah != null ? num(l.capacity_ah) + ' Ah' : '') +
    rowTr('Energy', l.energy_wh != null ? num(l.energy_wh) + ' Wh' : '') + rowTr('Minimum order', l.min_order) + rowTr('Warranty', l.warranty) + rowTr('Location', l.city + ', ' + l.state) + '</tbody></table>';
  const jsonld = { '@context': 'https://schema.org', '@type': 'Product', name: l.title, description: l.description.slice(0, 300), category: l.category_name, brand: l.brand ? { '@type': 'Brand', name: l.brand } : undefined,
    image: l.photos.length && siteUrl ? l.photos.map((p) => siteUrl + '/img/' + p.id) : undefined,
    offers: l.price != null ? { '@type': 'Offer', priceCurrency: 'INR', price: l.price, availability: 'https://schema.org/InStock', url: siteUrl ? siteUrl + productUrl(l) : undefined } : undefined };
  const since = l.seller_since ? new Date(l.seller_since).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '';
  const sellerCard = '<aside class="sellbox"><div class="sup"><span class="av">' + initial(l.seller_business) + '</span><div><b>' + esc(l.seller_business) + '</b><span class="muted">' + esc([l.seller_city, l.seller_state].filter(Boolean).join(', ')) + '</span></div></div>' +
    (since ? '<div class="muted small">Listed on Lithium Directory since ' + esc(since) + '</div>' : '') + (l.seller_about ? '<p class="small">' + esc(l.seller_about) + '</p>' : '') + waLink(l, 'lg full', 'Chat on WhatsApp') +
    '<p class="note">Ask about availability, price and delivery. Payment and delivery are agreed directly with the seller.</p></aside>';
  const body = '<div class="wrap prod"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/browse?category=' + esc(l.category_slug) + '">' + esc(l.category_name) + '</a> / <span>' + esc(l.title) + '</span></nav>' +
    '<div class="pgrid">' + imgs + '<div class="info"><div class="cat">' + esc(l.category_name) + '</div><h1>' + esc(l.title) + '</h1><div class="price big">' + priceHtml(l) + '</div><div class="spec big">' + esc(specLine(l)) + '</div>' +
    '<div class="loc">' + esc(l.city) + ', ' + esc(l.state) + '</div>' + specs + '</div>' + sellerCard + '</div>' +
    '<div class="detail one"><div><h2>Description</h2><p class="desc">' + esc(l.description).replace(/\n/g, '<br>') + '</p></div></div>' +
    (related.length ? '<h2 class="rel">More in ' + esc(l.category_name) + '</h2>' + grid(related) : '') + '</div><script src="/gallery.js" defer></script>';
  return { body, jsonld };
}

const about = () => '<div class="wrap doc"><h1>How Lithium Directory works</h1>' +
  '<p>Lithium Directory is a free listing site for lithium-ion batteries and related products made or supplied in India. It connects manufacturers with buyers. It is not a shop: there is no cart and no payment on this site.</p>' +
  '<h2>For buyers</h2><ol><li>Browse or search by category, voltage, chemistry, price and state.</li><li>Open a product to see photos, specifications and the seller.</li><li>Tap <b>Chat on WhatsApp</b> to message the seller directly. You do not need an account.</li></ol>' +
  '<h2>For sellers</h2><ol><li>Tap <b>Sell your batteries</b> and log in with your mobile number. We send a one-time code by SMS.</li><li>Add your name and business name once.</li><li>Add a product: category, photos, specifications, price and location. You can create a new category if yours is missing.</li><li>The first products are reviewed before they appear. After your first approval, new products go live straight away.</li></ol>' +
  '<p>Buyers who tap the WhatsApp button open a chat on your number, so keep it active.</p><p><a class="btn" href="/sell">Start listing</a></p></div>';

const terms = () => '<div class="wrap doc"><h1>Terms and safety</h1>' +
  '<p>Lithium Directory only lists products. Sellers are responsible for the accuracy of their listings, their prices and their products. Buyers should confirm specifications, certifications, warranty and delivery with the seller before paying.</p>' +
  '<h2>Safety</h2><p>Lithium-ion batteries are classed as dangerous goods for transport. Sellers must pack and ship them as the law requires. Buyers should ask for test reports, BMS details and applicable certifications, and should never use a damaged or swollen battery.</p>' +
  '<h2>Listings</h2><p>We may review, hide or remove any listing that is misleading, unsafe, or not related to lithium-ion products, and may suspend sellers who break these rules.</p>' +
  '<h2>Your data</h2><p>Sellers give their mobile number to log in and to receive WhatsApp enquiries. A seller\'s number is used only for the WhatsApp button on their products and is not shown as text on the site.</p></div>';

const notFound = () => '<div class="wrap doc"><h1>Page not found</h1><p>The page may have moved, or the product may have been removed.</p><p><a class="btn" href="/browse">Browse products</a></p></div>';

// the seller and admin pages are small apps: a shell plus a script
const appShell = (id, script) => '<div class="wrap appwrap"><div id="' + id + '" aria-live="polite"><p class="muted">Loading...</p></div></div><script src="/common.js" defer></script><script src="' + script + '" defer></script>';

module.exports = { layout, home, browse, product, about, terms, notFound, appShell, esc, productUrl };
