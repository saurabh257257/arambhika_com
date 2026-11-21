(function () {
  'use strict';
  var L = window.LD, esc = L.esc, root = document.getElementById('app'), cfg, me, state = { view: 'list', editing: null };

  function opts(list, cur, blank) { return (blank ? '<option value="">' + esc(blank) + '</option>' : '') + list.map(function (v) { return '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join(''); }
  function boot() {
    Promise.all([L.api('GET', '/api/config'), L.api('GET', '/api/me')]).then(function (r) {
      cfg = r[0]; me = r[1];
      if (!me.loggedIn) return L.login(root, cfg, function () { location.reload(); }, 'Log in with your mobile number to list your batteries. We will send a one-time code by SMS.');
      if (!me.seller.name || !me.seller.business) return profile(true);
      list();
    }).catch(function (e) { root.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; });
  }

  function head(title, sub) {
    return '<div class="panel"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center"><div><h2>' + esc(title) + '</h2><p class="lead" style="margin:0">' + esc(sub || '') + '</p></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-a="add" type="button">Add a product</button><button class="btn ghost" data-a="profile" type="button">My profile</button><button class="btn ghost" data-a="logout" type="button">Log out</button></div></div></div>';
  }

  // ---- my products ----
  function list() {
    state.view = 'list';
    L.api('GET', '/api/my/listings').then(function (r) {
      var trusted = me.seller.trusted;
      var rows = r.listings.map(function (l) {
        var tag = '<span class="tag ' + l.status + '">' + (l.status === 'pending' ? 'Waiting for review' : l.status === 'live' ? 'Live' : 'Hidden') + '</span>';
        return '<div class="item"><div class="t">' + (l.cover_id ? '<img src="/img/' + l.cover_id + '" alt="">' : '') + '</div><div><b>' + esc(l.title) + '</b><div class="muted small">' + esc(l.category_name) + ' · ' + esc(l.city) + ' · ' + L.money(l.price) + '</div><div class="small">' + tag + ' <span class="muted">' + l.leads + ' WhatsApp ' + (l.leads === 1 ? 'enquiry' : 'enquiries') + ' · ' + l.views + ' views</span></div></div>' +
          '<div class="acts">' + (l.status === 'live' ? '<a class="btn ghost sm" href="/p/' + l.id + '" target="_blank" rel="noopener">View</a>' : '') + '<button class="btn ghost sm" data-a="edit" data-id="' + l.id + '" type="button">Edit</button>' +
          (l.status === 'live' ? '<button class="btn ghost sm" data-a="hide" data-id="' + l.id + '" type="button">Hide</button>' : l.status === 'hidden' ? '<button class="btn ghost sm" data-a="show" data-id="' + l.id + '" type="button">Show</button>' : '') +
          '<button class="btn danger sm" data-a="del" data-id="' + l.id + '" data-t="' + esc(l.title) + '" type="button">Delete</button></div></div>';
      }).join('');
      var leads = r.leads.length ? '<div class="panel"><h2>Recent WhatsApp enquiries</h2><p class="lead">Each time a buyer taps Chat on WhatsApp on one of your products.</p><div class="rows">' + r.leads.slice(0, 10).map(function (x) { return '<div class="muted small">' + L.when(x.at) + ' · ' + esc(x.title) + '</div>'; }).join('') + '</div></div>' : '';
      root.innerHTML = head('My products', me.seller.business + ' · ' + me.mobile) +
        (!trusted && r.listings.length ? '<div class="panel" style="background:#fffbeb;border-color:#fde68a"><b>New products are reviewed before they appear.</b> This usually takes a day. After your first approval, new products go live straight away.</div>' : '') +
        '<div class="rows">' + (rows || '<div class="empty">You have not added a product yet. Tap <b>Add a product</b> to list your first battery.</div>') + '</div>' + leads;
    }).catch(fail);
  }

  // ---- profile ----
  function profile(first) {
    var s = me.seller;
    root.innerHTML = '<div class="panel login" style="max-width:560px"><h2>' + (first ? 'Welcome. Tell buyers who you are' : 'My profile') + '</h2><p class="lead">This shows next to your products.</p><form class="f" id="pf">' +
      '<div class="row"><label>Your name<input name="name" value="' + esc(s.name) + '" maxlength="60" required></label><label>Business or brand name<input name="business" value="' + esc(s.business) + '" maxlength="80" required></label></div>' +
      '<div class="row"><label>City<input name="city" value="' + esc(s.city) + '" maxlength="60"></label><label>State<select name="state">' + opts(cfg.states, s.state, 'Choose state') + '</select></label></div>' +
      '<label>About your business <span class="help">(optional)</span><textarea name="about" rows="3" maxlength="600">' + esc(s.about) + '</textarea></label><div id="pe"></div>' +
      '<div style="display:flex;gap:8px"><button class="btn" type="submit">Save</button>' + (first ? '' : '<button class="btn ghost" data-a="back" type="button">Cancel</button>') + '</div></form></div>';
    document.getElementById('pf').addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.target;
      L.api('PUT', '/api/profile', { name: f.name.value, business: f.business.value, city: f.city.value, state: f.state.value, about: f.about.value }).then(function (r) { me.seller = r.seller; L.toast('Saved'); list(); }).catch(function (x) { document.getElementById('pe').innerHTML = '<div class="err" role="alert">' + esc(x.message) + '</div>'; });
    });
  }

  // ---- add or edit a product ----
  function form(l) {
    state.view = 'form'; var e = l || {}, cats = cfg.categories;
    var pics = (e.photos || []).map(function (p, i) { return '<div class="pic"><img src="/img/' + p.id + '" alt=""><button type="button" data-a="delpic" data-id="' + p.id + '" aria-label="Remove photo">×</button>' + (i ? '<button type="button" class="cv" data-a="cover" data-id="' + p.id + '">Make main</button>' : '') + '</div>'; }).join('');
    root.innerHTML = '<div class="panel" style="max-width:820px"><h2>' + (l ? 'Edit product' : 'Add a product') + '</h2><p class="lead">Clear photos and exact specifications get the most enquiries.</p><form class="f" id="lf" novalidate>' +
      '<label>Product name<input name="title" value="' + esc(e.title || '') + '" maxlength="120" placeholder="e.g. 48V 30Ah LiFePO4 battery pack" required></label>' +
      '<div class="row"><label>Category<select name="category_id" id="cat">' + cats.map(function (c) { return '<option value="' + c.id + '"' + (e.category_id === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '<option value="new">+ Create a new category</option></select></label>' +
      '<label id="newcatw" hidden>New category name<input id="newcat" maxlength="40" placeholder="e.g. Golf cart batteries"></label><label>Brand <span class="help">(optional)</span><input name="brand" value="' + esc(e.brand || '') + '" maxlength="60"></label></div>' +
      '<div class="row"><label>Chemistry<select name="chemistry">' + opts(cfg.chemistries, e.chemistry || '', 'Not sure') + '</select></label><label>Voltage (V)<input name="voltage" inputmode="decimal" value="' + (e.voltage == null ? '' : e.voltage) + '"></label><label>Capacity (Ah)<input name="capacity_ah" inputmode="decimal" value="' + (e.capacity_ah == null ? '' : e.capacity_ah) + '"></label>' +
      '<label>Energy (Wh) <span class="help">worked out for you</span><input name="energy_wh" inputmode="decimal" value="' + (e.energy_wh == null ? '' : e.energy_wh) + '"></label></div>' +
      '<div class="row"><label>Price (₹) <span class="help">leave empty for "price on request"</span><input name="price" inputmode="numeric" value="' + (e.price == null ? '' : e.price) + '"></label><label>Price is<select name="price_unit">' + opts(['per piece', 'per set', 'per kWh', 'per kg'], e.price_unit || 'per piece') + '</select></label>' +
      '<label>Minimum order <span class="help">(optional)</span><input name="min_order" value="' + esc(e.min_order || '') + '" maxlength="60" placeholder="e.g. 10 pieces"></label><label>Warranty <span class="help">(optional)</span><input name="warranty" value="' + esc(e.warranty || '') + '" maxlength="60" placeholder="e.g. 2 years"></label></div>' +
      '<label>Description<textarea name="description" rows="5" maxlength="2000" placeholder="What is it, what is it for, what is included (BMS, charger), cycle life, certifications..." required>' + esc(e.description || '') + '</textarea></label>' +
      '<div class="row"><label>State<select name="state">' + opts(cfg.states, e.state || me.seller.state, 'Choose state') + '</select></label><label>City<input name="city" value="' + esc(e.city || me.seller.city || '') + '" maxlength="60"></label>' +
      '<label>WhatsApp number <span class="help">buyers chat on this</span><input name="whatsapp" inputmode="numeric" value="' + esc(e.whatsapp || me.mobile) + '" maxlength="14"></label></div>' +
      '<div><b>Photos</b> <span class="muted small">up to ' + cfg.maxPhotos + ', JPG, PNG or WebP. The first is the main photo.</span><div class="pics" id="pics">' + pics + '</div><div class="drop" style="margin-top:10px"><input type="file" id="files" accept="image/jpeg,image/png,image/webp" multiple></div></div>' +
      '<div id="le"></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn lg" type="submit">' + (l ? 'Save changes' : 'List product') + '</button><button class="btn ghost lg" data-a="back" type="button">Cancel</button></div></form></div>';
    var f = document.getElementById('lf'), cat = document.getElementById('cat');
    cat.addEventListener('change', function () { document.getElementById('newcatw').hidden = cat.value !== 'new'; if (cat.value === 'new') document.getElementById('newcat').focus(); });
    f.addEventListener('submit', function (ev) {
      ev.preventDefault(); var btn = f.querySelector('button[type=submit]'), err = document.getElementById('le'); err.innerHTML = ''; btn.disabled = true;
      var chosen = [].slice.call(document.getElementById('files').files), have = (e.photos || []).length;
      if (have + chosen.length > cfg.maxPhotos) { err.innerHTML = '<div class="err" role="alert">A product can have up to ' + cfg.maxPhotos + ' photos.</div>'; btn.disabled = false; return; }
      var getCat = cat.value === 'new' ? L.api('POST', '/api/categories', { name: document.getElementById('newcat').value }).then(function (r) { return r.category.id; }) : Promise.resolve(Number(cat.value));
      getCat.then(function (cid) {
        var body = {}; ['title', 'brand', 'chemistry', 'voltage', 'capacity_ah', 'energy_wh', 'price', 'price_unit', 'min_order', 'warranty', 'description', 'state', 'city', 'whatsapp'].forEach(function (k) { body[k] = f[k].value; }); body.category_id = cid;
        if (!l) body.energy_wh = body.energy_wh || '';
        return l ? L.api('PUT', '/api/my/listings/' + l.id, body).then(function () { return { id: l.id }; }) : L.api('POST', '/api/my/listings', body);
      }).then(function (r) {
        var chain = Promise.resolve(); chosen.forEach(function (file) { chain = chain.then(function () { L.toast('Uploading ' + file.name + '...'); return L.upload(r.id, file); }); });
        return chain.then(function () { return r; });
      }).then(function (r) {
        L.toast(l ? 'Saved' : r.status === 'live' ? 'Your product is live' : 'Submitted. We will review it shortly.');
        L.api('GET', '/api/me').then(function (m) { me = m; list(); });
      }).catch(function (x) { err.innerHTML = '<div class="err" role="alert">' + esc(x.message) + '</div>'; btn.disabled = false; window.scrollTo(0, document.body.scrollHeight); });
    });
  }

  function fail(e) { if (e.status === 401) return location.reload(); L.toast(e.message); }
  root.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-a]'); if (!b) return; var a = b.dataset.a, id = b.dataset.id;
    if (a === 'add') form(); else if (a === 'profile') profile(false); else if (a === 'back') list();
    else if (a === 'logout') L.api('POST', '/api/auth/logout', {}).then(function () { location.href = '/'; });
    else if (a === 'edit') L.api('GET', '/api/my/listings').then(function (r) { form(r.listings.filter(function (x) { return String(x.id) === id; })[0]); }).catch(fail);
    else if (a === 'hide' || a === 'show') L.api('PATCH', '/api/my/listings/' + id, { status: a === 'hide' ? 'hidden' : 'live' }).then(list).catch(fail);
    else if (a === 'del') { if (window.confirm('Delete "' + b.dataset.t + '"? This cannot be undone.')) L.api('DELETE', '/api/my/listings/' + id).then(function () { L.toast('Deleted'); list(); }).catch(fail); }
    else if (a === 'delpic') L.api('DELETE', '/api/my/photos/' + id).then(function () { b.closest('.pic').remove(); }).catch(fail);
    else if (a === 'cover') L.api('POST', '/api/my/photos/' + id + '/cover', {}).then(function () { L.toast('Main photo changed'); }).catch(fail);
  });
  boot();
})();
