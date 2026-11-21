(function () {
  'use strict';
  var L = window.LD, esc = L.esc, root = document.getElementById('app'), cfg, me, tab = 'review', filter = '', q = '';
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
    var w = tab === 'review' ? L.api('GET', '/api/admin/listings?status=pending').then(listPage.bind(null, true)) : tab === 'products' ? L.api('GET', '/api/admin/listings?status=' + encodeURIComponent(filter) + '&q=' + encodeURIComponent(q)).then(listPage.bind(null, false))
      : tab === 'sellers' ? L.api('GET', '/api/admin/sellers').then(sellersPage) : tab === 'categories' ? Promise.resolve(catsPage()) : tab === 'leads' ? L.api('GET', '/api/admin/leads').then(leadsPage) : L.api('GET', '/api/admin/summary').then(function (s) { return '<div class="panel"><h2>Recent activity</h2><div class="rows">' + s.audit.map(function (a) { return '<div class="small"><span class="muted">' + L.when(a.at) + ' · ' + esc(a.by_mobile) + '</span> ' + esc(a.action) + '</div>'; }).join('') + '</div></div>'; });
    Promise.all([w, L.api('GET', '/api/admin/summary')]).then(function (r) { frame(r[0], r[1].stats); }).catch(fail);
  }

  function listPage(review, r) {
    var bar = review ? '' : '<div class="panel" style="padding:12px"><form id="lf" style="display:flex;gap:8px;flex-wrap:wrap"><select name="status" style="max-width:180px"><option value="">All statuses</option><option value="pending">Waiting for review</option><option value="live">Live</option><option value="hidden">Hidden</option></select><input name="q" placeholder="Search name, seller, mobile" style="max-width:300px" value="' + esc(q) + '"><button class="btn sm" type="submit">Filter</button></form></div>';
    var rows = r.listings.map(function (l) {
      return '<div class="item"><div class="t">' + (l.cover_id ? '<img src="/img/' + l.cover_id + '" alt="">' : '') + '</div><div><b>' + esc(l.title) + '</b><div class="muted small">' + esc(l.category_name) + ' · ' + L.money(l.price) + ' · ' + esc(l.city) + ', ' + esc(l.state) + '</div><div class="small">' + esc(l.seller_business || '(no business name)') + ' · ' + esc(l.seller_mobile) + ' · ' + l.photo_count + ' photo' + (l.photo_count === 1 ? '' : 's') + ' · ' + l.leads + ' enquiries</div>' +
        (review ? '<div class="small muted" style="margin-top:4px">' + esc(l.description.slice(0, 200)) + (l.description.length > 200 ? '...' : '') + '</div>' : '') + '<span class="tag ' + l.status + '">' + (l.status === 'pending' ? 'Waiting for review' : l.status) + '</span></div>' +
        '<div class="acts">' + (l.status !== 'live' ? '<button class="btn sm" data-a="approve" data-id="' + l.id + '" type="button">' + (l.status === 'pending' ? 'Approve' : 'Show') + '</button>' : '<button class="btn ghost sm" data-a="hide" data-id="' + l.id + '" type="button">Hide</button>') +
        '<button class="btn ghost sm" data-a="edit" data-id="' + l.id + '" type="button">Edit</button>' + (l.status === 'live' ? '<a class="btn ghost sm" href="/p/' + l.id + '" target="_blank" rel="noopener">View</a>' : '') + '<button class="btn danger sm" data-a="del" data-id="' + l.id + '" data-t="' + esc(l.title) + '" type="button">Delete</button></div></div>';
    }).join('');
    return bar + '<div class="rows">' + (rows || '<div class="empty">' + (review ? 'Nothing is waiting for review.' : 'No products match.') + '</div>') + '</div>';
  }
  function sellersPage(r) {
    return '<div class="scroll"><table class="t2"><thead><tr><th>Seller</th><th>Mobile</th><th>Location</th><th>Products</th><th>Enquiries</th><th>Joined</th><th></th></tr></thead><tbody>' + r.sellers.map(function (s) {
      return '<tr><td><b>' + esc(s.business || '(profile not filled)') + '</b><div class="muted small">' + esc(s.name) + '</div></td><td>' + esc(s.mobile) + '</td><td>' + esc([s.city, s.state].filter(Boolean).join(', ')) + '</td><td>' + s.live + ' live / ' + s.listings + '</td><td>' + s.leads + '</td><td>' + L.when(s.created_at) + '</td>' +
        '<td style="white-space:nowrap">' + (s.suspended ? '<span class="tag bad">Suspended</span> ' : s.trusted ? '<span class="tag live">Trusted</span> ' : '') + '<button class="btn ghost sm" data-a="trust" data-m="' + s.mobile + '" data-v="' + (s.trusted ? 0 : 1) + '" type="button">' + (s.trusted ? 'Remove trust' : 'Trust') + '</button> ' +
        '<button class="btn ghost sm" data-a="sedit" data-m="' + s.mobile + '" data-b="' + esc(s.business) + '" data-n="' + esc(s.name) + '" type="button">Edit</button> <button class="btn ' + (s.suspended ? 'ghost' : 'danger') + ' sm" data-a="suspend" data-m="' + s.mobile + '" data-v="' + (s.suspended ? 0 : 1) + '" type="button">' + (s.suspended ? 'Restore' : 'Suspend') + '</button></td></tr>';
    }).join('') + '</tbody></table></div>' + (r.sellers.length ? '' : '<div class="empty">No sellers yet.</div>');
  }
  function catsPage() {
    return '<div class="panel"><form id="cf" style="display:flex;gap:8px;flex-wrap:wrap"><input name="name" placeholder="New category name" style="max-width:300px" maxlength="40"><button class="btn sm" type="submit">Add category</button></form></div><div class="scroll"><table class="t2"><thead><tr><th>Category</th><th>Live</th><th>Total</th><th>Added by</th><th></th></tr></thead><tbody>' +
      cfg.categories.map(function (c) { return '<tr><td><b>' + esc(c.name) + '</b></td><td>' + c.live + '</td><td>' + c.total + '</td><td>' + esc(c.created_by) + '</td><td style="white-space:nowrap"><button class="btn ghost sm" data-a="rencat" data-id="' + c.id + '" data-n="' + esc(c.name) + '" type="button">Rename</button> <button class="btn danger sm" data-a="delcat" data-id="' + c.id + '" data-n="' + esc(c.name) + '" type="button">Remove</button></td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function leadsPage(r) {
    return '<div class="scroll"><table class="t2"><thead><tr><th>When</th><th>Product</th><th>Seller</th></tr></thead><tbody>' + r.leads.map(function (x) { return '<tr><td>' + L.when(x.at) + '</td><td>' + esc(x.title) + '</td><td>' + esc(x.business || '') + ' <span class="muted">' + esc(x.seller_mobile) + '</span></td></tr>'; }).join('') + '</tbody></table></div>' + (r.leads.length ? '' : '<div class="empty">No WhatsApp enquiries yet.</div>');
  }

  // edit any product
  function editForm(l) {
    var cats = cfg.categories;
    document.getElementById('body').innerHTML = '<div class="panel" style="max-width:820px"><h2>Edit product ' + l.id + '</h2><p class="lead">Seller: ' + esc(l.seller_business) + ' · ' + esc(l.seller_mobile) + '</p><form class="f" id="ef">' +
      '<label>Product name<input name="title" value="' + esc(l.title) + '" maxlength="120"></label><div class="row"><label>Category<select name="category_id">' + cats.map(function (c) { return '<option value="' + c.id + '"' + (l.category_id === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></label><label>Brand<input name="brand" value="' + esc(l.brand) + '"></label></div>' +
      '<div class="row"><label>Chemistry<select name="chemistry"><option value="">Not sure</option>' + cfg.chemistries.map(function (c) { return '<option' + (l.chemistry === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label><label>Voltage<input name="voltage" value="' + (l.voltage == null ? '' : l.voltage) + '"></label><label>Capacity (Ah)<input name="capacity_ah" value="' + (l.capacity_ah == null ? '' : l.capacity_ah) + '"></label><label>Energy (Wh)<input name="energy_wh" value="' + (l.energy_wh == null ? '' : l.energy_wh) + '"></label></div>' +
      '<div class="row"><label>Price<input name="price" value="' + (l.price == null ? '' : l.price) + '"></label><label>Unit<input name="price_unit" value="' + esc(l.price_unit) + '"></label><label>Minimum order<input name="min_order" value="' + esc(l.min_order) + '"></label><label>Warranty<input name="warranty" value="' + esc(l.warranty) + '"></label></div>' +
      '<label>Description<textarea name="description" rows="5">' + esc(l.description) + '</textarea></label><div class="row"><label>State<select name="state">' + cfg.states.map(function (s) { return '<option' + (l.state === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></label><label>City<input name="city" value="' + esc(l.city) + '"></label><label>WhatsApp<input name="whatsapp" value="' + esc(l.whatsapp) + '"></label></div>' +
      '<div class="pics">' + l.photos.map(function (p) { return '<div class="pic"><img src="/img/' + p.id + '" alt=""><button type="button" data-a="delpic" data-id="' + p.id + '" aria-label="Remove photo">×</button></div>'; }).join('') + '</div><div id="ee"></div>' +
      '<div style="display:flex;gap:8px"><button class="btn" type="submit">Save</button><button class="btn ghost" data-a="back" type="button">Cancel</button></div></form></div>';
    document.getElementById('ef').addEventListener('submit', function (ev) {
      ev.preventDefault(); var f = ev.target, b = {}; ['title', 'category_id', 'brand', 'chemistry', 'voltage', 'capacity_ah', 'energy_wh', 'price', 'price_unit', 'min_order', 'warranty', 'description', 'state', 'city', 'whatsapp'].forEach(function (k) { b[k] = f[k].value; });
      L.api('PUT', '/api/admin/listings/' + l.id, b).then(function () { L.toast('Saved'); show(); }).catch(function (x) { document.getElementById('ee').innerHTML = '<div class="err" role="alert">' + esc(x.message) + '</div>'; });
    });
  }

  function fail(e) { if (e.status === 401) return location.reload(); L.toast(e.message); }
  function refreshCats() { return L.api('GET', '/api/config').then(function (c) { cfg = c; }); }
  root.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (ev.target.id === 'lf') { filter = ev.target.status.value; q = ev.target.q.value; show(); }
    if (ev.target.id === 'cf') L.api('POST', '/api/categories', { name: ev.target.name.value }).then(function () { return refreshCats(); }).then(show).catch(fail);
  });
  root.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; return show(); }
    var b = ev.target.closest('[data-a]'); if (!b) return; var a = b.dataset.a, id = b.dataset.id, m = b.dataset.m;
    if (a === 'logout') L.api('POST', '/api/auth/logout', {}).then(function () { location.href = '/'; });
    else if (a === 'back') show();
    else if (a === 'approve') L.api('PATCH', '/api/admin/listings/' + id, { status: 'live' }).then(function () { L.toast('Approved'); show(); }).catch(fail);
    else if (a === 'hide') L.api('PATCH', '/api/admin/listings/' + id, { status: 'hidden' }).then(function () { L.toast('Hidden'); show(); }).catch(fail);
    else if (a === 'edit') L.api('GET', '/api/admin/listings/' + id).then(function (r) { editForm(r.listing); }).catch(fail);
    else if (a === 'del') { if (window.confirm('Delete "' + b.dataset.t + '" and its photos? This cannot be undone.')) L.api('DELETE', '/api/admin/listings/' + id).then(function () { L.toast('Deleted'); show(); }).catch(fail); }
    else if (a === 'delpic') L.api('DELETE', '/api/admin/photos/' + id).then(function () { b.closest('.pic').remove(); }).catch(fail);
    else if (a === 'trust') L.api('PATCH', '/api/admin/sellers/' + m, { trusted: b.dataset.v === '1' }).then(show).catch(fail);
    else if (a === 'suspend') { if (b.dataset.v === '0' || window.confirm('Suspend ' + m + '? Their products disappear from the site and they cannot log in.')) L.api('PATCH', '/api/admin/sellers/' + m, { suspended: b.dataset.v === '1' }).then(show).catch(fail); }
    else if (a === 'sedit') { var biz = window.prompt('Business name', b.dataset.b); if (biz) L.api('PATCH', '/api/admin/sellers/' + m, { business: biz }).then(show).catch(fail); }
    else if (a === 'rencat') { var n = window.prompt('Category name', b.dataset.n); if (n) L.api('PATCH', '/api/admin/categories/' + id, { name: n }).then(refreshCats).then(show).catch(fail); }
    else if (a === 'delcat') { if (window.confirm('Remove the category "' + b.dataset.n + '"?')) L.api('DELETE', '/api/admin/categories/' + id).then(refreshCats).then(show).catch(fail); }
  });
  boot();
})();
