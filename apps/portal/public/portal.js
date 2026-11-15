(function () {
  'use strict';
  var seq = 0; // each screen change gets a number, so a slow earlier screen cannot overwrite a newer one
  var $ = function (id) { return document.getElementById(id); }, view = $('view'), me, toastTimer;
  var ICON = { note: '📝', call: '📞', whatsapp: '💬', visit: '🚗', quote: '📄', order: '📦', payment: '💰', dispatch: '🚚', followup: '⏰' };
  var LABEL = { note: 'Note', call: 'Call', whatsapp: 'WhatsApp', visit: 'Visit', quote: 'Quote sent', order: 'Order', payment: 'Payment', dispatch: 'Dispatch', followup: 'Follow-up' };
  var NICE = { email: 'Email', whatsapp: 'WhatsApp', call: 'Call', indiamart: 'IndiaMART', website: 'Website', instagram: 'Instagram', linkedin: 'LinkedIn', referral: 'Referral', exhibition: 'Exhibition', walk_in: 'Walk-in', other: 'Other',
    trader: 'Trader', oem: 'OEM', non_trader: 'OEM', unknown: 'Not known', battery_pack_maker: 'Battery pack maker', ev_maker: 'EV / e-bike maker', solar_storage: 'Solar / energy storage', ups_inverter: 'UPS / inverter', repair_service: 'Repair / service', diy_hobby: 'DIY / hobby', institution_rnd: 'Institution / R&D', reseller_dealer: 'Reseller / dealer',
    immediate: 'Immediately', within_a_month: 'Within a month', later: 'Later', exploring: 'Just exploring' };
  var nice = function (v) { return NICE[v] || v || ''; };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(method, url, body) {
    var o = { method: method, headers: {} };
    if (body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
    return fetch(url, o).then(function (r) {
      if (r.status === 401) { location.replace('/login.html'); throw new Error('Please sign in'); }
      return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong'); return j; });
    });
  }
  function toast(t) { var el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600); }
  function fail(e) { toast(e.message || String(e)); }
  function date(d) { if (!d) return ''; var p = String(d).slice(0, 10).split('-'); return p[2] + '-' + p[1] + '-' + p[0]; }
  function when(iso) { return iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''; }
  function ago(iso) { if (!iso) return 'Never'; var d = Math.floor((Date.now() - Date.parse(iso)) / 86400000); return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : d + ' days ago'; }
  function money(n) { return n == null || n === '' ? '' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
  function size(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function randomPassword() { var a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789', out = '', b = new Uint32Array(14); crypto.getRandomValues(b); for (var i = 0; i < b.length; i++) out += a[b[i] % a.length]; return out; }
  function pill(t, tone) { return '<span class="pill ' + (tone || '') + '">' + esc(t) + '</span>'; }
  function facts(list) { return '<div class="facts">' + list.filter(function (f) { return f[1]; }).map(function (f) { return '<div class="fact"><small>' + esc(f[0]) + '</small><b>' + esc(f[1]) + '</b></div>'; }).join('') + '</div>'; }
  function debounce(input, fn) { var t; input.addEventListener('input', function () { clearTimeout(t); t = setTimeout(fn, 250); }); }

  // ---------- customers ----------
  var COLORS = ['#0f766e', '#2563eb', '#c2410c', '#7c3aed', '#be185d', '#15803d', '#b45309', '#0e7490'];
  function colorOf(s) { var h = 0; String(s || '?').split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) >>> 0; }); return COLORS[h % COLORS.length]; }
  function avatar(name, big) { var n = String(name || '?').trim(); return '<span class="avatar' + (big ? ' big' : '') + '" style="background:' + colorOf(n) + '">' + esc(n.split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase()) + '</span>'; }
  function typePill(t) { return t === 'trader' ? '<span class="pill trader">Trader</span>' : t === 'oem' ? '<span class="pill oem">OEM</span>' : ''; }
  var TONE = { bad: 'off', warn: 'due', ok: 'ok', info: 'info' };
  function chips(list) { return (list || []).map(function (a) { return '<span class="pill ' + (TONE[a.tone] || '') + '">' + esc(a.label) + '</span>'; }).join(' '); }

  var listState = { q: '', owner: '', buyer: '', business: '', state: '', attention: false };
  function customersScreen() {
    var my = seq;
    var qs = ['q', 'owner', 'buyer', 'business', 'state'].map(function (k) { return k + '=' + encodeURIComponent(listState[k]); }).join('&') + (listState.attention ? '&attention=1' : '');
    return Promise.all([api('GET', '/api/people'), api('GET', '/api/customers?' + qs)]).then(function (r) {
      if (my !== seq) return;
      var rows = r[1].customers, opt = r[1].options, people = r[0].people;
      var quick = [['', 'All'], ['attention', 'Needs attention'], ['none', 'Unassigned']].concat(me.role === 'admin' ? [] : [['mine', 'Mine']]);
      var on = function (k) { return k === 'attention' ? listState.attention : k === 'none' ? listState.owner === 'none' : k === 'mine' ? listState.owner === me.id : (!listState.attention && !listState.owner); };
      view.innerHTML = '<div class="card"><div class="between"><h2>Customers</h2><span class="muted">' + rows.length + ' shown</span></div>' +
        '<div class="chips" id="quick">' + quick.map(function (q) { return '<button class="chip' + (on(q[0]) ? ' on' : '') + '" data-q="' + q[0] + '" type="button">' + q[1] + '</button>'; }).join('') + '</div>' +
        '<div class="row"><label>Search<input id="q" value="' + esc(listState.q) + '" placeholder="Name, mobile, company, city, what they want, anything in their history"></label>' +
        '<label>Assigned to<select id="own"><option value="">Anyone</option><option value="none"' + (listState.owner === 'none' ? ' selected' : '') + '>Unassigned</option>' + people.map(function (p) { return '<option value="' + p.id + '"' + (listState.owner === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</select></label>' +
        '<label>State<select id="st"><option value="">All states</option>' + opt.states.map(function (s) { return '<option value="' + esc(s.state) + '"' + (listState.state.toLowerCase() === s.state.toLowerCase() ? ' selected' : '') + '>' + esc(s.state) + ' (' + s.n + ')</option>'; }).join('') + '</select></label>' +
        '<label>Type<select id="buyer"><option value="">Trader or OEM</option>' + opt.buyer_types.filter(function (b) { return b !== 'unknown'; }).map(function (b) { return '<option value="' + b + '"' + (listState.buyer === b ? ' selected' : '') + '>' + nice(b) + '</option>'; }).join('') + '</select></label>' +
        '<label>Business<select id="biz"><option value="">Any</option>' + opt.businesses.map(function (b) { return '<option value="' + b + '"' + (listState.business === b ? ' selected' : '') + '>' + nice(b) + '</option>'; }).join('') + '</select></label></div>' +
        (rows.length ? '<div class="clist">' + rows.map(function (c) {
          return '<div class="crow" data-go="customer/' + c.mobile + '"><div class="cmain">' + avatar(c.name) + '<div><b>' + esc(c.name) + '</b><div class="muted small">' + esc(c.company || '') + '</div></div></div>' +
            '<div class="cnum">' + esc(c.mobile) + '</div>' +
            '<div class="cown">' + (c.owner_name ? avatar(c.owner_name) + ' <span>' + esc(c.owner_name) + '</span>' : '<span class="pill due">Unassigned</span>') + '</div>' +
            '<div class="cmeta">' + typePill(c.buyer_type) + (c.state ? ' <span class="state">' + esc(c.state) + '</span>' : '') + '</div>' +
            '<div class="cflags">' + (chips(c.attention) || '<span class="muted small">' + (c.last_at ? 'Last contact ' + ago(c.last_at).toLowerCase() : 'No contact yet') + '</span>') + '</div></div>';
        }).join('') + '</div>' : '<div class="empty">No customers match. They appear here as your team adds them through Claude.</div>') + '</div>';
      var q = $('q');
      debounce(q, function () { listState.q = q.value; customersScreen().then(function () { var n = $('q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }); });
      [['own', 'owner'], ['st', 'state'], ['buyer', 'buyer'], ['biz', 'business']].forEach(function (p) { $(p[0]).addEventListener('change', function (e) { listState[p[1]] = e.target.value; customersScreen(); }); });
      $('quick').addEventListener('click', function (e) {
        var b = e.target.closest('[data-q]'); if (!b) return; var k = b.dataset.q;
        listState.attention = k === 'attention'; listState.owner = k === 'none' ? 'none' : k === 'mine' ? me.id : ''; customersScreen();
      });
    });
  }

  var typeFilter = '', histQ = '';
  function dueText(d) { var n = Math.round((Date.parse(d) - Date.parse(new Date().toISOString().slice(0, 10))) / 86400000); return n === 0 ? 'today' : n > 0 ? 'in ' + n + ' day' + (n === 1 ? '' : 's') : -n + ' day' + (n === -1 ? '' : 's') + ' late'; }

  function booksHtml(b) {
    if (!b.synced) return '<div class="muted">' + esc(b.note) + '</div>';
    var s = b.summary;
    var doc = function (kind, list, cols, row) {
      return list.length ? '<h4>' + kind + ' (' + list.length + ')</h4><div class="dtable">' + list.map(function (d) {
        return '<details class="doc"><summary><span class="drow">' + row(d) + '</span></summary><div class="docbody"><div>' + pill(d.next.label, TONE[d.next.tone]) + ' <span class="muted">' + esc(d.next.action) + '</span></div>' + (d.lines && d.lines.length ? '<table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>' + d.lines.map(function (l) { return '<tr><td>' + esc(l.name) + '</td><td>' + l.quantity + '</td><td>' + money(l.rate) + '</td><td>' + money(l.total) + '</td></tr>'; }).join('') + '</tbody></table>' : '') + '</div></details>';
      }).join('') + '</div>' : '';
    };
    var top = (b.boughtByCategory[0] || { value: 0 }).value || 1;
    return '<div class="muted small">Saved from Zoho Books by ' + esc(b.syncedBy || 'a team member') + ', ' + ago(b.syncedAt).toLowerCase() + '. To bring it up to date, ask Claude: "Sync this customer from Zoho Books".</div>' +
      (b.boughtByCategory.length ? '<h4>What they have bought, by category</h4><div class="cats">' + b.boughtByCategory.map(function (g, i) {
        return '<details class="cat"><summary><span class="catname"><i style="background:' + COLORS[i % COLORS.length] + '"></i>' + esc(g.category) + '</span><span class="catbar"><b style="width:' + Math.max(4, Math.round(g.value / top * 100)) + '%;background:' + COLORS[i % COLORS.length] + '"></b></span><span class="catval">' + money(g.value) + '</span></summary>' +
          '<table><thead><tr><th>Item</th><th>Quantity</th><th>Times</th><th>Value</th><th class="hide-sm">Last bought</th></tr></thead><tbody>' + g.items.map(function (x) { return '<tr><td>' + esc(x.name) + '</td><td>' + x.quantity + '</td><td>' + x.times + '</td><td>' + money(x.value) + '</td><td class="hide-sm">' + date(x.last) + '</td></tr>'; }).join('') + '</tbody></table></details>';
      }).join('') + '</div>' : '') +
      (b.pendingQuotes.length ? '<h4>Quotes waiting (' + b.pendingQuotes.length + ', ' + money(s.pendingQuotesValue) + ')</h4><div class="dtable">' + b.pendingQuotes.map(function (q) { return '<div class="drow pend"><b>' + esc(q.number) + '</b><span>' + date(q.date) + '</span><span>' + money(q.total) + '</span>' + pill(q.next.label, TONE[q.next.tone]) + '<span class="muted small">' + esc(q.next.action) + '</span></div>'; }).join('') + '</div>' : '') +
      doc('Orders', b.orders, [], function (o) { return '<b>' + esc(o.number) + '</b><span>' + date(o.date) + '</span><span>' + money(o.total) + '</span>' + pill(o.next.label, TONE[o.next.tone]); }) +
      doc('Invoices', b.invoices, [], function (i) { return '<b>' + esc(i.number) + '</b><span>' + date(i.date) + '</span><span>' + money(i.total) + (i.balance ? ' <small class="muted">(' + money(i.balance) + ' due)</small>' : '') + '</span>' + pill(i.next.label, TONE[i.next.tone]); }) +
      doc('All quotes', b.quotes, [], function (q) { return '<b>' + esc(q.number) + '</b><span>' + date(q.date) + '</span><span>' + money(q.total) + '</span>' + pill(q.next.label, TONE[q.next.tone]); });
  }

  function customerScreen(mobile) {
    var my = seq;
    return api('GET', '/api/customers/' + mobile).then(function (r) {
      if (my !== seq) return;
      var c = r.customer, items = c.interactions, last = items[0], types = Object.keys(items.reduce(function (m, i) { m[i.type] = 1; return m; }, {}));
      var logged = items.filter(function (i) { return i.type === 'order' && i.amount; }).reduce(function (s, i) { return s + i.amount; }, 0);
      var next = last && last.next_date ? last.next_date : '';
      var imgs = c.files.filter(function (f) { return /^image\/(png|jpeg|webp|gif)$/.test(f.mime); }), docs = c.files.filter(function (f) { return !/^image\/(png|jpeg|webp|gif)$/.test(f.mime); });
      var place = [c.city, c.state].filter(Boolean).join(', ') + (c.pincode ? ' ' + c.pincode : '');
      view.innerHTML = '<a class="btn ghost sm back" href="#customers">&larr; All customers</a>' +
        '<div class="hero"><div class="herotop">' + avatar(c.name, true) + '<div class="heroname"><h2>' + esc(c.name) + '</h2><div>' + esc(c.company || '') + '</div></div>' +
        '<div class="heropills">' + typePill(c.buyer_type) + (c.business ? pill(nice(c.business), 'light') : '') + (c.source ? pill('From ' + nice(c.source), 'light') : '') + '</div></div>' +
        '<div class="herolines"><a class="tel" href="tel:+91' + c.mobile + '">📞 ' + esc(c.mobile) + '</a>' + (place ? '<span>📍 ' + esc(place) + '</span>' : '') + '<span>' + (c.owner_name ? 'Assigned to <b>' + esc(c.owner_name) + '</b>' : '<b>Unassigned</b>') + '</span><span>Onboarded ' + date(c.created_at) + '</span></div>' +
        '<div class="kpis" id="kpis"><div class="kpi k-green"><small>Sold so far</small><b id="kSold">&hellip;</b></div><div class="kpi k-teal"><small>Collected</small><b id="kColl">&hellip;</b></div><div class="kpi k-red"><small>Still to collect</small><b id="kDue">&hellip;</b></div><div class="kpi k-blue"><small>Quotes waiting</small><b id="kQuote">&hellip;</b></div></div></div>' +
        '<div class="card pursue"><h3>What to do next</h3><div class="plines">' +
        '<div class="pl">' + (next ? '<span class="pill ' + (next < new Date().toISOString().slice(0, 10) ? 'off' : 'info') + '">Follow up ' + dueText(next) + ' (' + date(next) + ')</span> <span class="muted">' + esc(last.summary.slice(0, 140)) + '</span>' : '<span class="pill due">No follow-up date set</span> <span class="muted">Ask Claude to log the next call with a date.</span>') + '</div>' +
        '<div class="pl muted small">' + (last ? 'Last contact: ' + esc(LABEL[last.type]) + ' by ' + esc(last.by_name || '') + ', ' + ago(last.at).toLowerCase() : 'Nobody has contacted them yet.') + '</div>' +
        '<div id="pActions"></div></div></div>' +
        '<div class="cols2"><div class="card"><h3>About</h3>' + (c.about ? '<div>' + esc(c.about) + '</div>' : '') +
        facts([['Address', c.address], ['City / state', place], ['GST', c.gstin], ['Email', c.email], ['Where from', c.source_detail], ['Looking for', c.looking_for], ['For (application)', c.application], ['Cell type / size', c.cell_format], ['Quantity and frequency', c.monthly_volume], ['How soon', nice(c.urgency)]]) +
        (c.missing.length ? '<div class="banner"><b>Not known yet:</b> ' + c.missing.slice(0, 6).map(function (m) { return esc(m.ask); }).join(' &middot; ') + '<div class="muted small" style="margin-top:4px">Tell Claude what you learn and it will fill these in.</div></div>' : '') + '</div>' +
        '<div class="card"><h3>People at ' + esc(c.company || c.name) + ' (' + c.contacts.length + ')</h3>' + (c.contacts.length ? c.contacts.map(function (k) {
          return '<div class="contact">' + avatar(k.name) + '<div><b>' + esc(k.name) + '</b>' + (k.role ? ' <span class="pill light2">' + esc(k.role) + '</span>' : '') + '<div class="small"><a href="tel:+91' + k.mobile + '">' + esc(k.mobile) + '</a>' + (k.email ? ' &middot; <a href="mailto:' + esc(k.email) + '">' + esc(k.email) + '</a>' : '') + '</div>' + (k.notes ? '<div class="muted small">' + esc(k.notes) + '</div>' : '') + '</div>' +
            (me.role === 'admin' ? '<button class="btn ghost sm" data-rmc="' + k.mobile + '" data-name="' + esc(k.name) + '" type="button">Remove</button>' : '') + '</div>';
        }).join('') : '<div class="muted">No other contacts yet. Tell Claude: "Add Anil, buyer at this company, 98xxxxxx".</div>') + '</div></div>' +
        '<div class="card"><h3>Purchases and orders</h3><div id="books" class="muted">Loading...</div>' + (logged && true ? '<div class="muted small" id="loggedNote" hidden>Logged by the team: ' + money(logged) + ' in orders.</div>' : '') + '</div>' +
        '<div class="card"><div class="between"><h3>Every interaction (' + items.length + ')</h3><label style="min-width:200px">Search this history<input id="hq" value="' + esc(histQ) + '" placeholder="Words in a note"></label></div>' +
        (types.length > 1 ? '<div class="chips" id="tchips"><button class="chip' + (typeFilter ? '' : ' on') + '" data-t="" type="button">All</button>' + types.map(function (t) { return '<button class="chip' + (typeFilter === t ? ' on' : '') + '" data-t="' + t + '" type="button">' + LABEL[t] + '</button>'; }).join('') + '</div>' : '') + '<div id="tl"></div></div>' +
        (c.files.length ? '<div class="card"><h3>Photos and documents (' + c.files.length + ')</h3>' + (imgs.length ? '<div class="files">' + imgs.map(function (f) {
          return '<div class="file"><a href="/api/files/' + f.id + '" target="_blank" rel="noopener"><img src="/api/files/' + f.id + '" alt="' + esc(f.name) + '" loading="lazy"></a><b>' + esc(f.name) + '</b><span class="muted small">' + esc(f.by_name || '') + ' &middot; ' + when(f.at) + '</span></div>'; }).join('') + '</div>' : '') +
          (docs.length ? '<div class="docs">' + docs.map(function (f) { return '<a class="docfile" href="/api/files/' + f.id + '?download=1"><span class="docico">📄</span><span><b>' + esc(f.name) + '</b><span class="muted small"> ' + size(f.size) + ' &middot; ' + esc(f.by_name || '') + ' &middot; ' + when(f.at) + '</span></span><span class="btn sm">Download</span></a>'; }).join('') + '</div>' : '') + '</div>' : '');
      if (me.role === 'admin') view.insertAdjacentHTML('beforeend', '<div class="card" style="border-color:#fecaca"><div class="between"><div><h3>Delete this customer</h3><div class="muted small">Admin only. Removes the customer, all ' + items.length + ' interaction' + (items.length === 1 ? '' : 's') + ', ' + c.contacts.length + ' contact' + (c.contacts.length === 1 ? '' : 's') + ' and ' + c.files.length + ' file' + (c.files.length === 1 ? '' : 's') + ' for good. It cannot be undone. Zoho Books is not touched.</div></div><button class="btn bad sm" id="delCust" type="button">Delete customer</button></div></div>');
      if ($('delCust')) $('delCust').addEventListener('click', function () {
        var typed = window.prompt('This permanently deletes ' + c.name + ' and their whole history.\nTo confirm, type their mobile number (' + c.mobile + '):');
        if (typed == null) return;
        api('DELETE', '/api/customers/' + c.mobile, { confirm: typed.replace(/\D/g, '').slice(-10) }).then(function () { toast('Customer deleted'); location.hash = 'customers'; }).catch(fail);
      });
      view.querySelectorAll('[data-rmc]').forEach(function (b) { b.addEventListener('click', function () {
        if (window.confirm('Remove ' + b.dataset.name + ' from this customer\'s contacts?')) api('DELETE', '/api/customers/' + c.mobile + '/contacts/' + b.dataset.rmc, {}).then(function () { toast('Contact removed'); return customerScreen(mobile); }).catch(fail);
      }); });
      function timeline() {
        var w = histQ.toLowerCase(), shown = items.filter(function (i) { return (!typeFilter || i.type === typeFilter) && (!w || i.summary.toLowerCase().indexOf(w) >= 0); });
        $('tl').innerHTML = shown.length ? '<div class="timeline">' + shown.map(function (i) {
          var fl = c.files.filter(function (f) { return f.interaction_id === i.id; });
          return '<div class="tl t-' + i.type + '"><div class="dot">' + (ICON[i.type] || '•') + '</div><div><div class="what">' + LABEL[i.type] + (i.amount != null ? ' <span class="pill ok">' + money(i.amount) + '</span>' : '') + (i.next_date ? ' <span class="pill due">Follow up ' + date(i.next_date) + '</span>' : '') + '</div><p>' + esc(i.summary) + '</p><div class="muted small">' + esc(i.by_name || '') + ' &middot; ' + when(i.at) + '</div>' +
            (fl.length ? '<div class="chips" style="margin-top:6px">' + fl.map(function (f) { return '<a class="chip" href="/api/files/' + f.id + '?download=1">📎 ' + esc(f.name) + '</a>'; }).join('') + '</div>' : '') + '</div></div>';
        }).join('') + '</div>' : '<div class="empty">' + (items.length ? 'Nothing matches.' : 'Nothing recorded yet.') + '</div>';
      }
      timeline();
      debounce($('hq'), function () { histQ = $('hq').value; timeline(); });
      view.querySelectorAll('[data-t]').forEach(function (b) { b.addEventListener('click', function () { typeFilter = b.dataset.t; customerScreen(mobile).catch(fail); }); });
      api('GET', '/api/customers/' + mobile + '/books').then(function (b) {
        if (my !== seq || !$('books')) return;
        $('books').innerHTML = booksHtml(b);
        if (b.synced) { $('kSold').textContent = money(b.summary.billed); $('kColl').textContent = money(b.summary.collected); $('kDue').textContent = money(b.summary.outstanding); $('kQuote').textContent = b.summary.pendingQuotes ? b.summary.pendingQuotes + ' (' + money(b.summary.pendingQuotesValue) + ')' : 'None';
          $('pActions').innerHTML = b.actions.length ? b.actions.map(function (a) { return '<div class="pl">' + pill(a.label, TONE[a.tone]) + ' <b>' + esc(a.kind) + ' ' + esc(a.number) + '</b> <span class="muted">' + esc(a.action) + '</span></div>'; }).join('') : '';
        } else {
          $('kSold').textContent = logged ? money(logged) : '—'; $('kColl').textContent = '—'; $('kDue').textContent = '—'; $('kQuote').textContent = '—';
          if (logged && $('loggedNote')) { $('loggedNote').hidden = false; $('loggedNote').textContent = 'Not synced from Zoho yet. Orders logged by the team so far: ' + money(logged) + '.'; }
        }
      }).catch(function (e) { if ($('books')) $('books').textContent = e.message; });
    });
  }

  // ---------- vendors ----------
  var vq = '';
  function vendorsScreen() {
    var my = seq;
    return api('GET', '/api/vendors?q=' + encodeURIComponent(vq)).then(function (r) {
      if (my !== seq) return;
      var rows = r.vendors;
      view.innerHTML = '<div class="card"><div class="between"><h2>Vendors</h2><span class="muted">' + rows.length + ' shown</span></div><label>Search<input id="vq" value="' + esc(vq) + '" placeholder="Vendor, mobile, city, or a material like nickel strip"></label>' +
        (rows.length ? '<table><thead><tr><th>Vendor</th><th class="hide-sm">City</th><th>Our items they supply</th><th>Last rate</th></tr></thead><tbody>' + rows.map(function (v) {
          return '<tr class="go" data-go="vendor/' + v.mobile + '"><td><b>' + esc(v.name) + '</b><div class="muted small">' + esc([v.company, v.mobile].filter(Boolean).join(' · ')) + '</div></td><td class="hide-sm">' + esc(v.city) + '</td><td>' + (v.materials ? v.materials : pill('No item linked', 'off')) + '</td><td>' + (v.last_offer ? date(v.last_offer) : '') + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">No vendors yet. Tell Claude: "Add vendor Saurav, 98xxxxxx, he supplies nickel strip at 700 a kg".</div>') + '</div>';
      var q = $('vq'); debounce(q, function () { vq = q.value; vendorsScreen().then(function () { var n = $('vq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }); });
    });
  }
  function vendorScreen(mobile) {
    var my = seq;
    return api('GET', '/api/vendors/' + mobile).then(function (r) {
      if (my !== seq) return;
      var v = r.vendor, today = new Date().toISOString().slice(0, 10);
      var mat = function (o) { return o.item_id ? '<a href="#item/' + o.item_id + '">' + esc(o.item_name) + '</a>' : esc(o.item_text) + ' <span class="pill due">not linked</span>'; };
      view.innerHTML = '<a class="btn ghost sm back" href="#vendors">&larr; All vendors</a>' +
        '<div class="card"><h2>' + esc(v.name) + '</h2><div class="muted">' + esc(v.company) + '</div>' + facts([['Mobile (key)', v.mobile], ['Email', v.email], ['City', [v.city, v.state].filter(Boolean).join(', ')], ['GST', v.gstin], ['Added', when(v.created_at) + (v.created_by_name ? ' by ' + v.created_by_name : '')]]) + (v.notes ? '<div>' + esc(v.notes) + '</div>' : '') + '</div>' +
        (v.items.length ? '' : '<div class="banner"><b>This vendor has no matching item.</b> A vendor must be linked to at least one of our items. Ask Claude to link the items they supply' + (me.role === 'admin' ? ', or delete this vendor below.' : '.') + '</div>') +
        '<div class="card"><h3>Our items they supply (' + v.items.length + ')</h3>' + (v.items.length ? '<table><thead><tr><th>Item</th><th>Latest rate</th><th>As of</th></tr></thead><tbody>' + v.items.map(function (i) {
          return '<tr class="go" data-go="item/' + i.id + '"><td><b>' + esc(i.name) + '</b><div class="muted small">' + esc(i.sku) + '</div></td><td>' + (i.rate != null ? '<b>' + money(i.rate) + '</b>' + (i.unit ? ' / ' + esc(i.unit) : '') : '<span class="muted">No rate yet</span>') + '</td><td>' + date(i.offer_date) + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">None linked.</div>') + '</div>' +
        '<div class="card"><h3>What they supply now (latest rate for each material)</h3>' + (v.latest.length ? '<table><thead><tr><th>Material</th><th>Rate</th><th class="hide-sm">Available</th><th class="hide-sm">Valid till</th><th>As of</th></tr></thead><tbody>' + v.latest.map(function (o) {
          return '<tr><td>' + mat(o) + '</td><td><b>' + money(o.rate) + '</b>' + (o.unit ? ' / ' + esc(o.unit) : '') + '</td><td class="hide-sm">' + esc(o.quantity) + '</td><td class="hide-sm">' + (o.valid_till ? (o.valid_till < today ? pill('Expired ' + date(o.valid_till), 'off') : date(o.valid_till)) : '') + '</td><td>' + date(o.offer_date) + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">No rates yet.</div>') + '</div>' +
        '<div class="card"><h3>Rate history (' + v.offers.length + ')</h3>' + (v.offers.length ? '<div class="timeline">' + v.offers.map(function (o) {
          return '<div class="tl"><div class="dot">💱</div><div><div class="what">' + mat(o) + ' <span class="pill">' + money(o.rate) + (o.unit ? ' / ' + esc(o.unit) : '') + '</span></div><p>' + esc([o.quantity && 'Available: ' + o.quantity, o.note].filter(Boolean).join(' · ')) + '</p><div class="muted small">' + date(o.offer_date) + ' &middot; ' + esc(o.by_name || '') + '</div></div></div>';
        }).join('') + '</div>' : '<div class="empty">Nothing yet.</div>') + '</div>';
      if (me.role === 'admin') view.insertAdjacentHTML('beforeend', '<div class="card" style="border-color:#fecaca"><div class="between"><div><h3>Delete this vendor</h3><div class="muted small">Admin only. Removes the vendor and all ' + v.offers.length + ' rate' + (v.offers.length === 1 ? '' : 's') + ' they gave, for good. It cannot be undone.</div></div><button class="btn bad sm" id="delVendor" type="button">Delete vendor</button></div></div>');
      if ($('delVendor')) $('delVendor').addEventListener('click', function () {
        var typed = window.prompt('This permanently deletes ' + v.name + ' and all their rates.\nTo confirm, type their mobile number (' + v.mobile + '):');
        if (typed == null) return;
        api('DELETE', '/api/vendors/' + v.mobile, { confirm: typed.replace(/\D/g, '').slice(-10) }).then(function () { toast('Vendor deleted'); location.hash = 'vendors'; }).catch(fail);
      });
    });
  }

  // ---------- items ----------
  var itemState = { q: '', category: '', stock: false };
  function itemsScreen() {
    var my = seq;
    return api('GET', '/api/items?q=' + encodeURIComponent(itemState.q) + '&category=' + encodeURIComponent(itemState.category) + (itemState.stock ? '&stock=1' : '')).then(function (r) {
      if (my !== seq) return;
      var rows = r.items, st = r.status;
      view.innerHTML = '<div class="card"><div class="between"><h2>Items</h2><span class="muted">' + rows.length + ' shown &middot; ' + (st.at ? 'from Zoho Commerce, updated ' + ago(st.at).toLowerCase() : 'not synced yet') + ' <button class="btn ghost sm" id="sync" type="button">Refresh from Zoho</button></span></div>' +
        (st.last && st.last.ok === false ? '<div class="banner">Zoho could not be read: ' + esc(st.last.error) + '. Showing the last list we have.</div>' : '') +
        '<div class="row"><label>Search<input id="iq" value="' + esc(itemState.q) + '" placeholder="Name, code or category, e.g. nickel strip 0.15"></label><label>Category<select id="icat"><option value="">All</option>' + r.categories.map(function (c) { return '<option value="' + esc(c.category) + '"' + (itemState.category === c.category ? ' selected' : '') + '>' + esc(c.category) + ' (' + c.n + ')</option>'; }).join('') + '</select></label><label class="check" style="flex:0 0 auto"><input type="checkbox" id="istock"' + (itemState.stock ? ' checked' : '') + '> In stock only</label></div>' +
        (rows.length ? '<table><thead><tr><th></th><th>Item</th><th class="hide-sm">Category</th><th>Our price</th><th class="hide-sm">Stock</th><th>Best vendor rate</th></tr></thead><tbody>' + rows.map(function (i) {
          return '<tr class="go" data-go="item/' + i.id + '"><td style="width:54px">' + (i.image_url ? '<img class="thumb" src="' + esc(i.image_url) + '" alt="" loading="lazy">' : '') + '</td><td><b>' + esc(i.name) + '</b><div class="muted small">' + esc(i.sku) + '</div></td><td class="hide-sm">' + esc(i.category) + '</td><td>' + money(i.price) + '</td><td class="hide-sm">' + (i.stock == null ? '' : i.stock > 0 ? i.stock : pill('Out', 'off')) + '</td><td>' + (i.best ? '<b>' + money(i.best.rate) + '</b>' + (i.best.unit ? ' / ' + esc(i.best.unit) : '') + '<div class="muted small">' + esc(i.best.vendor) + (i.best.vendors > 1 ? ' +' + (i.best.vendors - 1) + ' more' : '') + '</div>' : '') + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">' + (st.count ? 'No items match.' : 'No items yet. Press Refresh from Zoho.') + '</div>') + '</div>';
      var q = $('iq'); debounce(q, function () { itemState.q = q.value; itemsScreen().then(function () { var n = $('iq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }); });
      $('icat').addEventListener('change', function (e) { itemState.category = e.target.value; itemsScreen(); });
      $('istock').addEventListener('change', function (e) { itemState.stock = e.target.checked; itemsScreen(); });
      $('sync').addEventListener('click', function () { $('sync').disabled = true; api('POST', '/api/items/sync', {}).then(function (x) { toast(x.result.throttled ? 'Updated a moment ago' : x.result.ok ? 'Updated from Zoho' : 'Zoho: ' + x.result.error); return itemsScreen(); }).catch(fail); });
    });
  }
  function itemScreen(iid) {
    var my = seq;
    return api('GET', '/api/items/' + iid).then(function (r) {
      if (my !== seq) return;
      var i = r.item, today = new Date().toISOString().slice(0, 10);
      view.innerHTML = '<a class="btn ghost sm back" href="#items">&larr; All items</a>' +
        '<div class="card"><div class="between"><div><h2>' + esc(i.name) + '</h2><div class="muted">' + esc(i.sku) + (i.category ? ' &middot; ' + esc(i.category) : '') + '</div></div>' + (i.image_url ? '<img class="thumb big" src="' + esc(i.image_url) + '" alt="">' : '') + '</div>' +
        facts([['Our price', money(i.price)], ['In stock', i.stock == null ? '' : String(i.stock)], ['Unit', i.unit], ['Minimum order', i.moq == null ? '' : String(i.moq)], ['Collections', (i.collections || []).join(', ')]]) + (i.description ? '<div class="desc">' + esc(i.description) + '</div>' : '') + '</div>' +
        '<div class="card"><h3>Who supplies this (cheapest first)</h3>' + (i.suppliers.length ? '<table><thead><tr><th>Vendor</th><th>Rate</th><th class="hide-sm">Available</th><th>As of</th></tr></thead><tbody>' + i.suppliers.map(function (s) {
          return '<tr class="go" data-go="vendor/' + s.vendor_mobile + '"><td><b>' + esc(s.vendor_name) + '</b><div class="muted small">' + esc([s.vendor_company, s.vendor_city, s.vendor_mobile].filter(Boolean).join(' · ')) + '</div></td><td>' + (s.rate != null ? '<b>' + money(s.rate) + '</b>' + (s.unit ? ' / ' + esc(s.unit) : '') : '<span class="muted">No rate yet</span>') + '</td><td class="hide-sm">' + esc(s.quantity) + (s.expired ? ' ' + pill('Expired', 'off') : '') + '</td><td>' + date(s.offered_on) + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">No vendor supplies this yet. Tell Claude: "Saurav has this at 700 a kg today".</div>') + '</div>';
    });
  }

  // ---------- members (admin only) ----------
  function membersScreen() {
    var my = seq;
    return api('GET', '/api/members').then(function (r) {
      if (my !== seq) return;
      view.innerHTML = '<div class="card"><h2>Team members</h2><div class="muted">Create a person here and give them the username and password. They use these to sign in to the portal and to the MCP, and everything they change is saved under their name.</div>' +
        '<form id="mk" class="row"><label>Name<input name="name" maxlength="60" required></label><label>Username<input name="username" maxlength="40" autocapitalize="none" required></label><label>Password (10+ characters)<input name="password" id="pw" minlength="10" required></label><button class="btn ghost fit" id="gen" type="button">Generate</button><button class="btn fit" type="submit">Create member</button></form><div class="err" id="mkErr"></div><div id="shown"></div></div>' +
        '<div class="card"><h3>Members (' + r.members.length + ')</h3>' + (r.members.length ? '<table><thead><tr><th>Name</th><th>Username</th><th></th></tr></thead><tbody>' + r.members.map(function (m) {
          return '<tr><td><b>' + esc(m.name) + '</b> ' + (m.active ? '' : '<span class="pill off">Switched off</span>') + (m.hasKey ? ' <span class="pill ok">MCP key</span>' : '') + '</td><td>' + esc(m.username) + '</td><td style="text-align:right"><button class="btn ghost sm" data-pw="' + m.id + '" data-name="' + esc(m.name) + '" type="button">Reset password</button> ' + (m.hasKey ? '<button class="btn ghost sm" data-rk="' + m.id + '" data-name="' + esc(m.name) + '" type="button">Revoke key</button> ' : '') + '<button class="btn ghost sm" data-act="' + m.id + '" data-on="' + (m.active ? 0 : 1) + '" type="button">' + (m.active ? 'Switch off' : 'Switch on') + '</button></td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">No members yet.</div>') + '</div>' +
        '<div class="card"><h3>Recent changes</h3>' + (r.activity.length ? r.activity.map(function (a) { return '<div class="muted"><b>' + esc(a.who) + '</b> ' + esc(a.action) + ' &middot; ' + when(a.at) + '</div>'; }).join('') : '<div class="muted">Nothing yet.</div>') + '</div>';
      $('gen').addEventListener('click', function () { $('pw').value = randomPassword(); });
      $('mk').addEventListener('submit', function (e) {
        e.preventDefault(); var f = e.target; $('mkErr').textContent = '';
        var pw = f.password.value, un = f.username.value;
        api('POST', '/api/members', { name: f.name.value, username: un, password: pw }).then(function () {
          return membersScreen().then(function () { $('shown').innerHTML = '<div class="card" style="background:#f0fdfa;border-color:#99f6e4"><b>Created. Share these with ' + esc(f.name.value) + ' now, the password will not be shown again.</b><div>Username: <b>' + esc(un) + '</b></div><div>Password: <b>' + esc(pw) + '</b></div></div>'; });
        }).catch(function (x) { $('mkErr').textContent = x.message; });
      });
      view.addEventListener('click', onMembersClick);
    });
  }
  function onMembersClick(e) {
    var p = e.target.closest('[data-pw]'), a = e.target.closest('[data-act]'), rk = e.target.closest('[data-rk]');
    if (rk) { if (window.confirm('Revoke the MCP key of ' + rk.dataset.name + '? Claude stops working for them until they make a new key.')) api('POST', '/api/members/' + rk.dataset.rk + '/revoke-key', {}).then(function () { toast('Key revoked'); return membersScreen(); }).catch(fail); return; }
    if (p) { var pw = randomPassword(); if (!window.confirm('Set a new password for ' + p.dataset.name + '? Their old password stops working.')) return;
      api('POST', '/api/members/' + p.dataset.pw + '/password', { password: pw }).then(function () { return membersScreen(); }).then(function () { $('shown').innerHTML = '<div class="card" style="background:#f0fdfa;border-color:#99f6e4"><b>New password for ' + esc(p.dataset.name) + ' (shown once):</b> <b>' + esc(pw) + '</b></div>'; window.scrollTo(0, 0); }).catch(fail); return; }
    if (a) api('PATCH', '/api/members/' + a.dataset.act, { active: a.dataset.on === '1' }).then(function () { toast(a.dataset.on === '1' ? 'Switched on' : 'Switched off'); return membersScreen(); }).catch(fail);
  }

  // ---------- my connection (MCP key) ----------
  function connectionScreen() {
    var my = seq;
    return api('GET', '/api/my-connection').then(function (r) {
      if (my !== seq) return;
      var url = location.origin + '/mcp';
      if (!r.canConnect) { view.innerHTML = '<div class="card"><h2>My connection</h2><div class="muted">The admin sign-in cannot connect to the MCP. Create a member for yourself under Members, then sign in as that member.</div></div>'; return; }
      view.innerHTML = '<div class="card"><h2>My connection</h2><div class="muted">Connect Claude to the portal, so you can add customers and log calls, quotes, orders and payments by talking to Claude. Everything you save is recorded under your name.</div>' +
        '<div>' + (r.key ? 'You have a key (made ' + when(r.key.at) + '). It cannot be shown again.' : 'You do not have a key yet.') + '</div><div><button class="btn" id="mk" type="button">' + (r.key ? 'Make a new key (the old one stops working)' : 'Make my key') + '</button></div><div id="keyBox"></div></div>' +
        '<div class="card"><h3>Connect the Claude app (easiest)</h3><ol><li>In Claude, open <b>Settings, Connectors, Add custom connector</b>.</li><li>Name: <b>Arambhika</b>. Address: <b>' + esc(url) + '</b></li><li>Choose <b>Sign in now</b> and <b>Register automatically</b>, then add it.</li><li>Claude opens a sign-in page from this portal. Type your portal <b>username and password</b>. Nothing else is needed, no key.</li></ol></div>' +
        '<div class="card"><h3>Or connect Claude Code with a key</h3><ol><li>Make your key above and copy the command that appears.</li><li>Paste it into a terminal on your computer, or in Claude Code.</li><li>Open Claude Code and ask, for example: <i>"Who am I on the portal?"</i> or <i>"Add customer Mr Rao, phone 98xxxxxx, and log a call: interested in nickel strip, follow up on 25 Nov."</i></li></ol><div class="muted small">Address: ' + esc(url) + '. This address is plain http for now, so do not use it on public Wi-Fi.</div></div>';
      $('mk').addEventListener('click', function () {
        if (r.key && !window.confirm('Make a new key? Your old key stops working.')) return;
        api('POST', '/api/my-connection/key', {}).then(function (k) {
          var cmd = 'claude mcp add --transport http arambhika ' + url + ' --header "Authorization: Bearer ' + k.key + '"';
          $('keyBox').innerHTML = '<div class="card" style="background:#f0fdfa;border-color:#99f6e4"><b>Your key is shown once. Copy this command now:</b><textarea id="cmd" readonly rows="3" style="width:100%;font-family:monospace;font-size:12px">' + esc(cmd) + '</textarea><div><button class="btn sm" id="cp" type="button">Copy</button></div></div>';
          $('cp').addEventListener('click', function () { $('cmd').select(); (navigator.clipboard ? navigator.clipboard.writeText(cmd) : Promise.resolve(document.execCommand('copy'))).then(function () { toast('Copied'); }); });
        }).catch(fail);
      });
    });
  }

  // ---------- shell ----------
  function route() {
    var h = location.hash.replace(/^#/, '') || 'customers', parts = h.split('/');
    seq++; view.removeEventListener('click', onMembersClick);
    var tabs = [['customers', 'Customers'], ['vendors', 'Vendors'], ['items', 'Items']].concat(me.role === 'admin' ? [['members', 'Members']] : []).concat([['connection', 'My connection']]);
    var base = { customer: 'customers', vendor: 'vendors', item: 'items' }[parts[0]] || parts[0];
    $('tabs').innerHTML = tabs.map(function (t) { return '<button class="tab' + (base === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '" type="button">' + t[1] + '</button>'; }).join('');
    var arg = decodeURIComponent(parts[1] || '');
    var screen = parts[0] === 'customer' && arg ? customerScreen(arg) : parts[0] === 'vendor' && arg ? vendorScreen(arg) : parts[0] === 'item' && arg ? itemScreen(arg) : parts[0] === 'vendors' ? vendorsScreen() : parts[0] === 'items' ? itemsScreen()
      : parts[0] === 'connection' ? connectionScreen() : parts[0] === 'members' && me.role === 'admin' ? membersScreen() : customersScreen();
    screen.catch(function (e) { view.innerHTML = '<div class="card"><div class="err">' + esc(e.message) + '</div></div>'; });
  }
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) location.hash = b.dataset.tab; });
  // a row or card with data-go opens that page
  view.addEventListener('click', function (e) { if (e.target.closest('a, button, summary')) return; var g = e.target.closest('[data-go]'); if (g) location.hash = g.dataset.go; });
  $('out').addEventListener('click', function () { api('POST', '/api/auth/logout', {}).then(function () { location.replace('/login.html'); }); });
  window.addEventListener('hashchange', route);
  api('GET', '/api/me').then(function (r) { me = r.user; $('who').textContent = me.name + (me.role === 'admin' ? ' (admin)' : ''); route(); }).catch(fail);
})();
