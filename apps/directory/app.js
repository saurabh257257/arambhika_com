// Lithium Directory: public listing pages, seller sign-in (mobile OTP), the seller's product pages, and the admin page.
'use strict';
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const compression = require('compression');
const { open } = require('./lib/db');
const makeSession = require('./lib/session');
const makeOtp = require('./lib/otp');
const views = require('./lib/views');

function createApp({ dataDir, adminMobile = '8112662827', sessionSecret, siteUrl = '', devOtp = '', msg91 = {}, fetchFn }) {
  const repo = open(dataDir);
  const admin = repo.mobile10(adminMobile);
  const secret = sessionSecret || crypto.randomBytes(32).toString('hex'); // without a fixed secret, logins end when the app restarts
  const session = makeSession(secret);
  const otp = makeOtp({ authKey: msg91.authKey, templateId: msg91.templateId, length: msg91.length, expiry: msg91.expiry, devCode: devOtp, fetchFn });
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(compression());
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" });
    next();
  });
  const origin = (req) => (siteUrl || req.protocol + '://' + req.get('host')).replace(/\/$/, '');

  // who is signed in (a suspended seller is treated as signed out)
  app.use((req, res, next) => {
    const m = session.read(req.headers.cookie);
    const s = m && repo.seller(m);
    req.user = s && !s.suspended ? { mobile: m, admin: m === admin, seller: s } : null;
    next();
  });
  const needUser = (req, res, next) => (req.user ? next() : res.status(401).json({ error: 'Please log in' }));
  const needAdmin = (req, res, next) => (req.user && req.user.admin ? next() : res.status(req.user ? 403 : 401).json({ error: 'Admin only' }));
  const answer = (res, r, body) => (r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(body || { ok: true }));

  app.get('/health', (req, res) => res.json({ status: 'ok', otp: otp.mode() }));
  app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /api/\nDisallow: /sell\nDisallow: /admin\nDisallow: /go/\nSitemap: ' + origin(req) + '/sitemap.xml\n'));
  app.get('/sitemap.xml', (req, res) => {
    const o = origin(req), urls = ['/', '/browse', '/about', '/terms'].map((u) => o + u).concat(repo.categories().filter((c) => c.live).map((c) => o + '/browse?category=' + c.slug), repo.sitemap().map((l) => o + views.productUrl(l)));
    res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls.map((u) => '<url><loc>' + views.esc(u) + '</loc></url>').join('') + '</urlset>');
  });
  app.get('/favicon.svg', (req, res) => res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="2" y="7" width="26" height="18" rx="4" fill="#0b1f3a"/><rect x="28" y="12" width="3" height="8" rx="1.5" fill="#0b1f3a"/><path d="M17 9l-6 9h5l-1 6 7-10h-5z" fill="#22c55e"/></svg>'));
  app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0, index: false }));

  // ---- public pages ----
  const page = (req, res, o, status = 200) => res.status(status).type('html').send(views.layout({ q: String(req.query.q || '').slice(0, 80), category: String(req.query.category || ''), ...o, cats: repo.categories(), user: req.user, siteUrl: siteUrl || origin(req) }));
  app.get('/', (req, res) => page(req, res, { canonical: '/', body: views.home({ cats: repo.categories(), latest: repo.search({ perPage: 10 }).rows, stats: repo.stats(), states: repo.states() }) }));
  app.get('/browse', (req, res) => {
    const q = req.query, params = {};
    for (const k of ['q', 'category', 'state', 'chemistry', 'minPrice', 'maxPrice', 'minVoltage', 'maxVoltage', 'sort', 'page']) params[k] = String(q[k] || '').slice(0, 80);
    const cats = repo.categories(), cat = cats.find((c) => c.slug === params.category);
    page(req, res, { title: cat ? cat.name : params.q ? 'Search: ' + params.q : 'Browse lithium-ion batteries', description: cat ? 'Buy ' + cat.name.toLowerCase() + ' from manufacturers across India. Compare specifications and message sellers on WhatsApp.' : '', canonical: cat && !params.q ? '/browse?category=' + cat.slug : '/browse', active: 'browse',
      noindex: !!(params.q || params.page > 1 || params.state || params.chemistry || params.minPrice || params.maxPrice || params.minVoltage || params.maxVoltage || params.sort),
      body: views.browse({ result: repo.search({ ...params, page: Number(params.page) || 1 }), params, cats, states: repo.states(), chemistries: repo.CHEMISTRIES }) });
  });
  app.get('/p/:slug', (req, res) => {
    const id = parseInt(req.params.slug, 10), l = id && repo.liveListing(id);
    if (!l) return page(req, res, { title: 'Not found', body: views.notFound(), noindex: true }, 404);
    const url = views.productUrl(l);
    if ('/p/' + req.params.slug !== url) return res.redirect(301, url);
    repo.viewed(l.id);
    const p = views.product({ l, related: repo.related(l), siteUrl: siteUrl || origin(req) });
    page(req, res, { title: l.title, description: [l.title, l.voltage ? l.voltage + ' V' : '', l.capacity_ah ? l.capacity_ah + ' Ah' : '', l.city + ', ' + l.state].filter(Boolean).join(', ') + '. ' + l.description.slice(0, 120), canonical: url, image: l.cover_id ? '/img/' + l.cover_id : '', body: p.body, jsonld: p.jsonld });
  });
  app.get('/about', (req, res) => page(req, res, { title: 'How it works', canonical: '/about', active: 'about', body: views.about() }));
  app.get('/terms', (req, res) => page(req, res, { title: 'Terms and safety', canonical: '/terms', body: views.terms() }));
  app.get('/sell', (req, res) => page(req, res, { title: 'Sell your batteries', noindex: true, body: views.appShell('app', '/seller.js') }));
  app.get('/admin', (req, res) => page(req, res, { title: 'Admin', noindex: true, body: views.appShell('app', '/admin.js') }));

  app.get('/img/:id', (req, res) => {
    const p = repo.photo(req.params.id);
    if (!p || !require('fs').existsSync(p.path)) return res.status(404).end();
    res.set({ 'Content-Type': p.mime, 'Content-Length': String(p.size), 'Cache-Control': 'public, max-age=604800, immutable' });
    require('fs').createReadStream(p.path).pipe(res);
  });

  // the WhatsApp button: record the enquiry as a lead (once per visitor per product every 10 minutes), then open the seller's chat
  const seen = new Map();
  app.get('/go/:id', (req, res) => {
    const l = repo.liveListing(req.params.id);
    if (!l) return res.redirect(302, '/browse');
    const k = req.ip + ':' + l.id, t = Date.now();
    if (!(seen.get(k) > t - 600000)) { repo.addLead(l); seen.set(k, t); if (seen.size > 5000) seen.clear(); }
    const text = 'Hi, I saw "' + l.title + '" on Lithium Directory (' + origin(req) + views.productUrl(l) + '). Is it available?';
    res.redirect(302, 'https://wa.me/91' + l.whatsapp + '?text=' + encodeURIComponent(text));
  });

  // ---- API: JSON only (the photo upload is the one exception, and it needs its own header) ----
  app.use('/api', (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.path !== '/upload' && !/^application\/json/i.test(req.headers['content-type'] || '')) return res.status(415).json({ error: 'JSON only' });
    next();
  });
  app.use('/api', express.json({ limit: '50kb' }));

  app.get('/api/config', (req, res) => res.json({ otp: otp.mode() !== 'off', otpLength: otp.length(), states: repo.STATES, chemistries: repo.CHEMISTRIES, categories: repo.categories(), maxPhotos: repo.MAX_PHOTOS }));
  app.get('/api/me', (req, res) => res.json(req.user ? { loggedIn: true, mobile: req.user.mobile, admin: req.user.admin, seller: req.user.seller } : { loggedIn: false }));

  app.post('/api/auth/send-otp', async (req, res) => {
    const mobile = repo.mobile10(req.body && req.body.mobile);
    if (!mobile) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
    if (otp.mode() === 'off') return res.status(503).json({ error: 'Login is not switched on yet.' });
    const s = repo.seller(mobile); if (s && s.suspended) return res.status(403).json({ error: 'This account has been suspended. Please contact the site admin.' });
    const blocked = otp.checkSend(mobile, req.ip); if (blocked) return res.status(429).json({ error: blocked });
    try {
      const r = await otp.send(mobile, !!(req.body && req.body.resend));
      if (!r.ok) return res.status(502).json({ error: 'Could not send the OTP right now. Please try again in a moment.' });
      otp.clear(mobile); res.json({ ok: true, length: otp.length() });
    } catch (e) { res.status(502).json({ error: 'Could not send the OTP right now. Please try again in a moment.' }); }
  });
  app.post('/api/auth/verify-otp', async (req, res) => {
    const mobile = repo.mobile10(req.body && req.body.mobile), code = String((req.body && req.body.otp) || '').replace(/\D/g, '');
    if (!mobile) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
    if (otp.mode() === 'off') return res.status(503).json({ error: 'Login is not switched on yet.' });
    if (code.length !== otp.length()) return res.status(400).json({ error: 'Enter the ' + otp.length() + '-digit OTP.' });
    if (otp.locked(mobile)) return res.status(429).json({ error: 'Too many wrong attempts. Please request a new OTP.' });
    let r; try { r = await otp.verify(mobile, code); } catch (e) { return res.status(502).json({ error: 'Could not verify the OTP right now. Please try again.' }); }
    if (!r.ok) { otp.fail(mobile); return res.status(401).json({ error: 'That OTP is not correct or has expired.' }); }
    otp.clear(mobile);
    const s = repo.touchSeller(mobile); if (s.suspended) return res.status(403).json({ error: 'This account has been suspended. Please contact the site admin.' });
    session.start(req, res, mobile);
    res.json({ ok: true, admin: mobile === admin, seller: s });
  });
  app.post('/api/auth/logout', (req, res) => { session.end(res); res.json({ ok: true }); });

  // ---- seller ----
  app.put('/api/profile', needUser, (req, res) => { const r = repo.updateSeller(req.user.mobile, req.body || {}); answer(res, r, { seller: r.seller }); });
  app.post('/api/categories', needUser, (req, res) => { const r = repo.addCategory((req.body || {}).name, req.user.admin ? 'admin' : req.user.mobile); answer(res, r, r); });
  app.get('/api/my/listings', needUser, (req, res) => res.json({ listings: repo.sellerListings(req.user.mobile).map((l) => ({ ...l, photos: repo.listing(l.id).photos })), leads: repo.sellerLeads(req.user.mobile) }));
  app.post('/api/my/listings', needUser, (req, res) => { const r = repo.createListing(req.user.mobile, req.body || {}); answer(res, r, r); });
  app.put('/api/my/listings/:id', needUser, (req, res) => answer(res, repo.updateListing(req.params.id, req.body || {}, req.user.mobile, false)));
  app.patch('/api/my/listings/:id', needUser, (req, res) => answer(res, repo.setListingStatus(req.params.id, (req.body || {}).status, req.user.mobile, false)));
  app.delete('/api/my/listings/:id', needUser, (req, res) => answer(res, repo.deleteListing(req.params.id, req.user.mobile, false)));
  app.delete('/api/my/photos/:id', needUser, (req, res) => answer(res, repo.deletePhoto(req.params.id, req.user.mobile, false)));
  app.post('/api/my/photos/:id/cover', needUser, (req, res) => answer(res, repo.makeCover(req.params.id, req.user.mobile, false)));
  // a photo goes in as the original bytes; the custom header cannot be sent by another website
  app.post('/api/upload', needUser, express.raw({ type: () => true, limit: '6mb' }), (req, res) => {
    if (req.headers['x-ld-upload'] !== '1') return res.status(400).json({ error: 'Not an upload from the site' });
    const r = repo.addPhoto(req.query.listing, req.user.mobile, req.user.admin, req.query.name, Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0));
    answer(res, r, r);
  });

  // ---- admin ----
  app.get('/api/admin/summary', needAdmin, (req, res) => res.json({ stats: repo.stats(), audit: repo.auditLog(30) }));
  app.get('/api/admin/listings', needAdmin, (req, res) => res.json({ listings: repo.adminListings({ status: String(req.query.status || ''), q: String(req.query.q || '') }) }));
  app.put('/api/admin/listings/:id', needAdmin, (req, res) => answer(res, repo.updateListing(req.params.id, req.body || {}, req.user.mobile, true)));
  app.patch('/api/admin/listings/:id', needAdmin, (req, res) => answer(res, repo.setListingStatus(req.params.id, (req.body || {}).status, req.user.mobile, true)));
  app.delete('/api/admin/listings/:id', needAdmin, (req, res) => answer(res, repo.deleteListing(req.params.id, req.user.mobile, true)));
  app.delete('/api/admin/photos/:id', needAdmin, (req, res) => answer(res, repo.deletePhoto(req.params.id, req.user.mobile, true)));
  app.get('/api/admin/listings/:id', needAdmin, (req, res) => { const l = repo.listing(req.params.id); return l ? res.json({ listing: l }) : res.status(404).json({ error: 'Product not found' }); });
  app.get('/api/admin/sellers', needAdmin, (req, res) => res.json({ sellers: repo.sellers() }));
  app.post('/api/admin/sellers', needAdmin, (req, res) => { const r = repo.addSellerByAdmin(req.body || {}, req.user.mobile); answer(res, r, { seller: r.seller }); });
  // everything about one seller: their details, products and enquiries (the admin page for a seller)
  app.get('/api/admin/sellers/:mobile', needAdmin, (req, res) => {
    const m = repo.mobile10(req.params.mobile), s = m && repo.seller(m);
    if (!s) return res.status(404).json({ error: 'Seller not found' });
    res.json({ seller: s, listings: repo.sellerListings(m), leads: repo.sellerLeads(m, 30) });
  });
  app.post('/api/admin/sellers/:mobile/listings', needAdmin, (req, res) => { const r = repo.createListing(repo.mobile10(req.params.mobile), req.body || {}, req.user.mobile); answer(res, r, r); });
  app.patch('/api/admin/sellers/:mobile', needAdmin, (req, res) => { const r = repo.setSeller(repo.mobile10(req.params.mobile), req.body || {}, req.user.mobile); answer(res, r, { seller: r.seller }); });
  app.patch('/api/admin/categories/:id', needAdmin, (req, res) => answer(res, repo.renameCategory(req.params.id, (req.body || {}).name, req.user.mobile)));
  app.delete('/api/admin/categories/:id', needAdmin, (req, res) => answer(res, repo.deleteCategory(req.params.id, req.user.mobile)));
  app.get('/api/admin/leads', needAdmin, (req, res) => res.json({ leads: repo.leads(200) }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((req, res) => page(req, res, { title: 'Not found', body: views.notFound(), noindex: true }, 404));
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'That is too big' });
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad request' });
    console.error(err); res.status(500).json({ error: 'Something went wrong' });
  });

  app.repo = repo;
  return app;
}

module.exports = { createApp };
