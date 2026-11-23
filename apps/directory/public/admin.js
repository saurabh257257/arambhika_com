(function () {
  'use strict';
  var L = window.LD, esc = L.esc, root = document.getElementById('app'), cfg, me, tab = 'review', filter = '', q = '', back = null;
  var TABS = [['review', 'To review'], ['products', 'Products'], ['sellers', 'Sellers'], ['categories', 'Categories'], ['leads', 'Enquiries'], ['activity', 'Activity']];

  function boot() {
    Promise.all([L.api('GET', '/api/config'), L.api('GET', '/api/me')]).then(function (r) {
      cfg = r[0]; me = r[1];
      if (!me.loggedIn) return L.login(root, cfg, function () { location.reload(); }, 'Admin log in. Use the admin mobile number.');
      if (!me.admin) { root.innerHTML = '<div class="panel login"><h2>Admin only</h2><p class="lead">This page is for the Lithium Directory admin.</p><a class="btn" href="/sell">Go to my products</a></div>'; return; }
      show();
    }).catch(function (e) { root.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; });
  }
  function frame(html, stats) {
    root.innerHTML = (stats ? '<div class="kpis"><div class="kpi"><b>' + stats.pending + '</b><span>Waiting for review</span></div><div class="kpi"><b>' + stats.live + '</b><span>Live products</span></div><div class="kpi"><b>' + stats.sellers + '</b><span>Sellers</span></div><div class="kpi"><b>' + stats.leads_week + '</b><span>WhatsApp enquiries, 7 days</span></div><div class="kpi"><b>' + stats.leads_total + '</b><span>Enquiries, all time</span></div></div>' : '') +
      '<div class="tabs" role="tablist">' + TABS.map(function (t) { return '<button type="button" class="' + (tab === t[0] ? 'on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '<button type="button" data-a="logout" style="margin-left:auto">Log out</button></div><div id="body">' + html + '</div>';
  }
  function show() {
    back = show;
    var w = tab === 'review' ? L.api('GET', '/api/admin/listings?status=pending').then(listPage.bind(null, true)) : tab === 'products' ? L.api('GET', '/api/admin/listings?status=' + encodeURIComponent(filter) + '&q=' + encodeURIComponent(q)).then(listPage.bind(null, false))
      : tab === 'sellers' ? L.api('GET', '/api/admin/sellers').then(sellersPage) : tab === 'categories' ? Promise.resolve(catsPage()) : tab === 'leads' ? L.api('GET', '/api/admin/leads').then(leadsPage) : L.api('GET', '/api/admin/summary').then(function (s) { return '<div class="panel"><h2>Recent activity</h2><div class="rows">' + s.audit.map(function (a) { return '<div class="small"><span class="muted">' + L.when(a.at) + ' · ' + esc(a.by_mobile) + '</span> ' + esc(a.action) + '</div>'; }).join('') + '</div></div>'; });
    Promise.all([w, L.api('GET', '/api/admin/summary')]).then(function (r) { frame(r[0], r[1].stats); }).catch(fail);
  }

  // one product row, with the actions the admin has on it
  function itemRow(l, review, withSeller) {
    return '<div class="item"><div class="t">' + (l.cover_id ? '<img src="/img/' + l.cover_id + '" alt="">' : '') + '</div><div><b>' + esc(l.title) + '</b><div class="muted small">' + esc(l.category_name) + ' · ' + L.money(l.price) + ' · ' + esc(l.city) + ', ' + esc(l.state) + '</div>' +
      '<div class="small">' + (withSeller ? '<a href="#" data-a="open" data-m="' + l.seller_mobile + '">' + esc(l.seller_business || '(no business name)') + '</a> · ' + esc(l.seller_mobile) + ' · ' : '') + l.photo_count + ' photo' + (l.photo_count === 1 ? '' : 's') + ' · ' + l.leads + ' enquiries · ' + l.views + ' views</div>' +
      (review ? '<div class="small muted" style="margin-top:4px">' + esc(l.description.slice(0, 200)) + (l.description.length > 200 ? '...' : '') + '</div>' : '') + '<span class="tag ' + l.status + '">' + (l.status === 'pending' ? 'Waiting for review' : l.status) + '</span></div>' +
      '<div class="acts">' + (l.status !== 'live' ? '<button class="btn sm" data-a="approve" data-id="' + l.id + '" type="button">' + (l.status === 'pending' ? 'Approve' : 'Show') + '</button>' : '<button class="btn ghost sm" data-a="hide" data-id="' + l.id + '" type="button">Hide</button>') +
      '<button class="btn ghost sm" data-a="edit" data-id="' + l.id + '" type="button">Edit</button>' + (l.status === 'live' ? '<a class="btn ghost sm" href="/p/' + l.id + '" target="_blank" rel="noopener">View as customer</a>' : '') + '<button class="btn danger sm" data-a="del" data-id="' + l.id + '" data-t="' + esc(l.title) + '" type="button">Delete</button></div></div>';
  }
  function listPage(review, r) {
    var bar = review ? '' : '<div class="panel" style="padding:12px"><form id="lf" style="display:flex;gap:8px;flex-wrap:wrap"><select name="status" style="max-width:180px"><option value="">All statuses</option><option value="pending">Waiting for review</option><option value="live">Live</option><option value="hidden">Hidden</option></select><input name="q" placeholder="Search name, seller, mobile" style="max-width:300px" value="' + esc(q) + '"><button class="btn sm" type="submit">Filter</button></form></div>';
    var rows = r.listings.map(function (l) { return itemRow(l, review, true); }).join('');
    return bar + '<div class="rows">' + (rows || '<div class="empty">' + (review ? 'Nothing is waiting for review.' : 'No products match.') + '</div>') + '</div>';
  }

  // ---- sellers: the list, and a page for each seller ----
  function sellersPage(r) {
    return '<div class="panel"><h2>Add a seller</h2><p class="lead">Add a manufacturer yourself. They can then log in with this mobile number and manage their products.</p><form class="f" id="asf"><div class="row"><label>Mobile number<input name="mobile" inputmode="numeric" maxlength="14" required></label><label>Name<input name="name" maxlength="60" required></label><label>Business name<input name="business" maxlength="80" required></label>' +
      '<label>City<input name="city" maxlength="60"></label></div><div id="ase"></div><div><button class="btn sm" type="submit">Add seller</button></div></form></div>' +
      '<div class="scroll"><table class="t2"><thead><tr><th>Seller</th><th>Mobile</th><th>Location</th><th>Products</th><th>Enquiries</th><th>Joined</th><th></th></tr></thead><tbody>' + r.sellers.map(function (s) {
        return '<tr><td><a href="#" data-a="open" data-m="' + s.mobile + '"><b>' + esc(s.business || '(profile not filled)') + '</b></a><div class="muted small">' + esc(s.name) + '</div></td><td>' + esc(s.mobile) + '</td><td>' + esc([s.city, s.state].filter(Boolean).join(', ')) + '</td><td>' + s.live + ' live / ' + s.listings + '</td><td>' + s.leads + '</td><td>' + L.when(s.created_at) + '</td>' +
          '<td style="white-space:nowrap">' + (s.suspended ? '<span class="tag bad">Suspended</span> ' : s.trusted ? '<span class="tag live">Trusted</span> ' : '') + '<button class="btn sm" data-a="open" data-m="' + s.mobile + '" type="button">Open</button></td></tr>';
      }).join('') + '</tbody></table></div>' + (r.sellers.length ? '' : '<div class="empty">No sellers yet.</div>');
  }
  function sellerPage(m) {
    L.api('GET', '/api/admin/sellers/' + m).then(function (r) {
      var s = r.seller; back = function () { sellerPage(m); };
      document.getElementById('body').innerHTML = '<p><button class="btn ghost sm" data-a="back" type="button" data-to="sellers">← All sellers</button></p>' +
        '<div class="panel"><div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:space-between"><div style="display:flex;gap:14px;align-items:center"><span class="av">' + esc((s.business || '?').charAt(0).toUpperCase()) + '</span><div><h2 style="margin:0">' + esc(s.business || '(profile not filled)') + '</h2><div class="muted">' + esc(s.name) + ' · ' + esc(s.mobile) + ' · joined ' + L.when(s.created_at) + '</div></div></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' + (s.suspended ? '<span class="tag bad">Suspended</span>' : s.trusted ? '<span class="tag live">Trusted</span>' : '<span class="tag pending">New seller</span>') + '<button class="btn ghost sm" data-a="trust" data-m="' + s.mobile + '" data-v="' + (s.trusted ? 0 : 1) + '" type="button" data-open="1">' + (s.trusted ? 'Remove trust' : 'Trust this seller') + '</button><button class="btn ' + (s.suspended ? 'ghost' : 'danger') + ' sm" data-a="suspend" data-m="' + s.mobile + '" data-v="' + (s.suspended ? 0 : 1) + '" type="button" data-open="1">' + (s.suspended ? 'Restore' : 'Suspend') + '</button></div></div></div>' +
        '<div class="panel"><h2>Seller details</h2><p class="lead">What buyers see next to this seller\'s products.</p><form class="f" id="sp" data-m="' + s.mobile + '"><div class="row"><label>Name<input name="name" value="' + esc(s.name) + '" maxlength="60"></label><label>Business name<input name="business" value="' + esc(s.business) + '" maxlength="80"></label><label>City<input name="city" value="' + esc(s.city) + '" maxlength="60"></label>' +
        '<label>State<select name="state"><option value="">Choose state</option>' + cfg.states.map(function (x) { return '<option' + (s.state === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></label></div><label>About<textarea name="about" rows="2" maxlength="600">' + esc(s.about) + '</textarea></label><div id="spe"></div><div><button class="btn sm" type="submit">Save details</button></div></form></div>' +
        '<div class="panel" style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center"><div><h2 style="margin:0">Products (' + r.listings.length + ')</h2><div class="muted small">Edit anything, approve, hide or delete. Products you add here go live straight away.</div></div><button class="btn" data-a="addp" data-m="' + s.mobile + '" type="button">Add a product for this seller</button></div>' +
        '<div class="rows">' + (r.listings.length ? r.listings.map(function (l) { return itemRow(l, false, false); }).join('') : '<div class="empty">This seller has no products yet.</div>') + '</div>' +
        (r.leads.length ? '<div class="panel" style="margin-top:18px"><h2>Recent WhatsApp enquiries</h2><div class="rows">' + r.leads.map(function (x) { return '<div class="muted small">' + L.when(x.at) + ' · ' + esc(x.title) + '</div>'; }).join('') + '</div></div>' : '');
      window.scrollTo(0, 0);
    }).catch(fail);
  }

  function catsPage() {
    return '<div class="panel"><form id="cf" style="display:flex;gap:8px;flex-wrap:wrap"><input name="name" placeholder="New category name" style="max-width:300px" maxlength="40"><button class="btn sm" type="submit">Add category</button></form></div><div class="scroll"><table class="t2"><thead><tr><th>Category</th><th>Live</th><th>Total</th><th>Added by</th><th></th></tr></thead><tbody>' +
      cfg.categories.map(function (c) { return '<tr><td><b>' + esc(c.name) + '</b></td><td>' + c.live + '</td><td>' + c.total + '</td><td>' + esc(c.created_by) + '</td><td style="white-space:nowrap"><button class="btn ghost sm" data-a="rencat" data-id="' + c.id + '" data-n="' + esc(c.name) + '" type="button">Rename</button> <button class="btn danger sm" data-a="delcat" data-id="' + c.id + '" data-n="' + esc(c.name) + '" type="button">Remove</button></td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function leadsPage(r) {
    return '<div class="scroll"><table class="t2"><thead><tr><th>When</th><th>Product</th><th>Seller</th></tr></thead><tbody>' + r.leads.map(function (x) { return '<tr><td>' + L.when(x.at) + '</td><td>' + esc(x.title) + '</td><td>' + esc(x.business || '') + ' <span class="muted">' + esc(x.seller_mobile) + '</span></td></tr>'; }).join('') + '</tbody></table></div>' + (r.leads.length ? '' : '<div class="empty">No WhatsApp enquiries yet.</div>');
  }

  // add a product for a seller (l is null), or edit any product
  function editForm(l, sellerMobile) {
    var e = l || {}, cats = cfg.categories, pics = (e.photos || []).map(function (p) { return '<div class="pic"><img src="/img/' + p.id + '" alt=""><button type="button" data-a="delpic" data-id="' + p.id + '" aria-label="Remove photo">×</button></div>'; }).join('');
    document.getElementById('body').innerHTML = '<div class="panel" style="max-width:860px"><h2>' + (l ? 'Edit product ' + l.id : 'Add a product') + '</h2><p class="lead">' + (l ? 'Seller: ' + esc(l.seller_business) + ' · ' + esc(l.seller_mobile) : 'For seller ' + esc(sellerMobile)) + '</p><form class="f" id="ef">' +
      '<label>Product name<input name="title" value="' + esc(e.title || '') + '" maxlength="120"></label><div class="row"><label>Category<select name="category_id">' + cats.map(function (c) { return '<option value="' + c.id + '"' + (e.category_id === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></label><label>Brand<input name="brand" value="' + esc(e.brand || '') + '"></label></div>' +
      '<div class="row"><label>Chemistry<select name="chemistry"><option value="">Not sure</option>' + cfg.chemistries.map(function (c) { return '<option' + (e.chemistry === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label><label>Voltage (V)<input name="voltage" value="' + (e.voltage == null ? '' : e.voltage) + '"></label><label>Capacity (Ah)<input name="capacity_ah" value="' + (e.capacity_ah == null ? '' : e.capacity_ah) + '"></label><label>Energy (Wh)<input name="energy_wh" value="' + (e.energy_wh == null ? '' : e.energy_wh) + '"></label></div>' +
      '<div class="row"><label>Price (₹)<input name="price" value="' + (e.price == null ? '' : e.price) + '"></label><label>Price is<input name="price_unit" value="' + esc(e.price_unit || 'per piece') + '"></label><label>Minimum order<input name="min_order" value="' + esc(e.min_order || '') + '"></label><label>Warranty<input name="warranty" value="' + esc(e.warranty || '') + '"></label></div>' +
      '<label>Description<textarea name="description" rows="5">' + esc(e.description || '') + '</textarea></label><div class="row"><label>State<select name="state"><option value="">Choose state</option>' + cfg.states.map(function (s) { return '<option' + (e.state === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></label><label>City<input name="city" value="' + esc(e.city || '') + '"></label><label>WhatsApp number<input name="whatsapp" value="' + esc(e.whatsapp || sellerMobile || '') + '"></label></div>' +
      '<div><b>Photos</b> <span class="muted small">JPG, PNG or WebP, up to ' + cfg.maxPhotos + '.</span><div class="pics">' + pics + '</div><div class="drop" style="margin-top:10px"><input type="file" id="files" accept="image/jpeg,image/png,image/webp" multiple></div></div><div id="ee"></div>' +
      '<div style="display:flex;gap:8px"><button class="btn" type="submit">' + (l ? 'Save changes' : 'Add product') + '</button><button class="btn ghost" data-a="back" type="button">Cancel</button></div></form></div>';
    document.getElementById('ef').addEventListener('submit', function (ev) {
      ev.preventDefault(); var f = ev.target, b = {}, btn = f.querySelector('button[type=submit]'), err = document.getElementById('ee'); err.innerHTML = ''; btn.disabled = true;
      ['title', 'category_id', 'brand', 'chemistry', 'voltage', 'capacity_ah', 'energy_wh', 'price', 'price_unit', 'min_order', 'warranty', 'description', 'state', 'city', 'whatsapp'].forEach(function (k) { b[k] = f[k].value; });
      var chosen = [].slice.call(document.getElementById('files').files);
      (l ? L.api('PUT', '/api/admin/listings/' + l.id, b).then(function () { return { id: l.id }; }) : L.api('POST', '/api/admin/sellers/' + sellerMobile + '/listings', b)).then(function (r) {
        var chain = Promise.resolve(); chosen.forEach(function (file) { chain = chain.then(function () { L.toast('Uploading ' + file.name + '...'); return L.upload(r.id, file); }); }); return chain;
      }).then(function () { L.toast(l ? 'Saved' : 'Product added'); (back || show)(); }).catch(function (x) { err.innerHTML = '<div class="err" role="alert">' + esc(x.message) + '</div>'; btn.disabled = false; });
    });
  }

  function fail(e) { if (e.status === 401) return location.reload(); L.toast(e.message); }
  function refreshCats() { return L.api('GET', '/api/config').then(function (c) { cfg = c; }); }
  root.addEventListener('submit', function (ev) {
    var id = ev.target.id; if (!id) return; ev.preventDefault(); var f = ev.target;
    if (id === 'lf') { filter = f.status.value; q = f.q.value; show(); }
    else if (id === 'cf') L.api('POST', '/api/categories', { name: f.name.value }).then(function () { return refreshCats(); }).then(show).catch(fail);
    else if (id === 'asf') L.api('POST', '/api/admin/sellers', { mobile: f.mobile.value, name: f.name.value, business: f.business.value, city: f.city.value }).then(function (r) { L.toast('Seller added'); sellerPage(r.seller.mobile); }).catch(function (x) { document.getElementById('ase').innerHTML = '<div class="err" role="alert">' + esc(x.message) + '</div>'; });
    else if (id === 'sp') L.api('PATCH', '/api/admin/sellers/' + f.dataset.m, { name: f.name.value, business: f.business.value, city: f.city.value, state: f.state.value, about: f.about.value }).then(function () { L.toast('Saved'); sellerPage(f.dataset.m); }).catch(function (x) { document.getElementById('spe').innerHTML = '<div class="err" role="alert">' + esc(x.message) + '</div>'; });
  });
  root.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; return show(); }
    var b = ev.target.closest('[data-a]'); if (!b) return; ev.preventDefault(); var a = b.dataset.a, id = b.dataset.id, m = b.dataset.m, again = function () { (back || show)(); };
    if (a === 'logout') L.api('POST', '/api/auth/logout', {}).then(function () { location.href = '/'; });
    else if (a === 'back') { if (b.dataset.to) { tab = b.dataset.to; show(); } else again(); }
    else if (a === 'open') sellerPage(m);
    else if (a === 'addp') editForm(null, m);
    else if (a === 'approve') L.api('PATCH', '/api/admin/listings/' + id, { status: 'live' }).then(function () { L.toast('Approved'); again(); }).catch(fail);
    else if (a === 'hide') L.api('PATCH', '/api/admin/listings/' + id, { status: 'hidden' }).then(function () { L.toast('Hidden'); again(); }).catch(fail);
    else if (a === 'edit') L.api('GET', '/api/admin/listings/' + id).then(function (r) { editForm(r.listing, r.listing.seller_mobile); }).catch(fail);
    else if (a === 'del') { if (window.confirm('Delete "' + b.dataset.t + '" and its photos? This cannot be undone.')) L.api('DELETE', '/api/admin/listings/' + id).then(function () { L.toast('Deleted'); again(); }).catch(fail); }
    else if (a === 'delpic') L.api('DELETE', '/api/admin/photos/' + id).then(function () { b.closest('.pic').remove(); }).catch(fail);
    else if (a === 'trust') L.api('PATCH', '/api/admin/sellers/' + m, { trusted: b.dataset.v === '1' }).then(function () { if (b.dataset.open) sellerPage(m); else show(); }).catch(fail);
    else if (a === 'suspend') { if (b.dataset.v === '0' || window.confirm('Suspend ' + m + '? Their products disappear from the site and they cannot log in.')) L.api('PATCH', '/api/admin/sellers/' + m, { suspended: b.dataset.v === '1' }).then(function () { if (b.dataset.open) sellerPage(m); else show(); }).catch(fail); }
    else if (a === 'rencat') { var n = window.prompt('Category name', b.dataset.n); if (n) L.api('PATCH', '/api/admin/categories/' + id, { name: n }).then(refreshCats).then(show).catch(fail); }
    else if (a === 'delcat') { if (window.confirm('Remove the category "' + b.dataset.n + '"?')) L.api('DELETE', '/api/admin/categories/' + id).then(refreshCats).then(show).catch(fail); }
  });
  boot();
})();
