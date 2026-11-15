(function () {
  'use strict';
  var seq = 0; // each screen change gets a number, so a slow earlier screen cannot overwrite a newer one
  var $ = function (id) { return document.getElementById(id); }, view = $('view'), me, toastTimer;
  var ICON = { note: '📝', call: '📞', whatsapp: '💬', visit: '🚗', quote: '📄', order: '📦', payment: '💰', dispatch: '🚚', followup: '⏰' };
  var LABEL = { note: 'Note', call: 'Call', whatsapp: 'WhatsApp', visit: 'Visit', quote: 'Quote sent', order: 'Order', payment: 'Payment', dispatch: 'Dispatch', followup: 'Follow-up' };

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
  function money(n) { return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
  function size(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function randomPassword() { var a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789', out = '', b = new Uint32Array(14); crypto.getRandomValues(b); for (var i = 0; i < b.length; i++) out += a[b[i] % a.length]; return out; }

  // ---------- customers ----------
  var listState = { q: '', owner: '' };
  function customersScreen() {
    var my = seq;
    return Promise.all([api('GET', '/api/people'), api('GET', '/api/customers?q=' + encodeURIComponent(listState.q) + '&owner=' + encodeURIComponent(listState.owner))]).then(function (r) {
      var rows = r[1].customers; if (my !== seq) return;
      view.innerHTML = '<div class="card"><div class="between"><h2>Customers</h2><span class="muted">' + rows.length + ' shown</span></div>' +
        '<div class="row"><label>Search<input id="q" value="' + esc(listState.q) + '" placeholder="Name, company, phone or city"></label><label>Owner<select id="own"><option value="">Everyone</option>' + r[0].people.map(function (p) { return '<option value="' + p.id + '"' + (listState.owner === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</select></label></div>' +
        (rows.length ? '<table><thead><tr><th>Customer</th><th class="hide-sm">Owner</th><th>Last interaction</th><th class="hide-sm">Next follow-up</th></tr></thead><tbody>' + rows.map(function (c) {
          return '<tr class="go" data-id="' + c.id + '"><td><b>' + esc(c.name) + '</b><div class="muted small">' + esc([c.company, c.phone].filter(Boolean).join(' · ')) + '</div></td><td class="hide-sm">' + esc(c.owner_name || '') + '</td><td>' + ago(c.last_at) + '<div class="muted small">' + c.interactions + ' interaction' + (c.interactions === 1 ? '' : 's') + '</div></td><td class="hide-sm">' + (c.next_follow_up ? date(c.next_follow_up) : '') + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">No customers yet. They appear here as your team adds them through the MCP.</div>') + '</div>';
      var q = $('q'), t;
      q.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { listState.q = q.value; customersScreen().then(function () { var n = $('q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }); }, 250); });
      $('own').addEventListener('change', function (e) { listState.owner = e.target.value; customersScreen(); });
      view.querySelectorAll('tr.go').forEach(function (tr) { tr.addEventListener('click', function () { location.hash = 'customer/' + tr.dataset.id; }); });
    });
  }

  var typeFilter = '';
  function customerScreen(cid) {
    var my = seq;
    return api('GET', '/api/customers/' + cid).then(function (r) {
      if (my !== seq) return; var c = r.customer, items = c.interactions, shown = items.filter(function (i) { return !typeFilter || i.type === typeFilter; });
      var types = Object.keys(items.reduce(function (m, i) { m[i.type] = 1; return m; }, {}));
      var upcoming = items.filter(function (i) { return i.next_date && i.next_date >= new Date().toISOString().slice(0, 10); }).map(function (i) { return i.next_date; }).sort()[0];
      var total = items.filter(function (i) { return i.type === 'order' && i.amount; }).reduce(function (s, i) { return s + i.amount; }, 0);
      view.innerHTML = '<a class="btn ghost sm back" href="#customers">&larr; All customers</a>' +
        '<div class="card"><h2>' + esc(c.name) + '</h2><div class="muted">' + esc(c.company) + '</div><div class="facts">' +
        [['Phone', c.phone], ['Email', c.email], ['City', c.city], ['Owner', c.owner_name], ['Added', when(c.created_at) + (c.created_by_name ? ' by ' + c.created_by_name : '')], ['Last interaction', items.length ? ago(items[0].at) : 'Never'], ['Next follow-up', upcoming ? date(upcoming) : ''], ['Ordered in all', total ? money(total) : '']].filter(function (f) { return f[1]; }).map(function (f) { return '<div class="fact"><small>' + f[0] + '</small><b>' + esc(f[1]) + '</b></div>'; }).join('') + '</div></div>' +
        '<div class="card"><div class="between"><h3>What has happened (' + items.length + ')</h3></div>' +
        (types.length > 1 ? '<div class="chips"><button class="chip' + (typeFilter ? '' : ' on') + '" data-t="" type="button">All</button>' + types.map(function (t) { return '<button class="chip' + (typeFilter === t ? ' on' : '') + '" data-t="' + t + '" type="button">' + LABEL[t] + '</button>'; }).join('') + '</div>' : '') +
        (shown.length ? '<div class="timeline">' + shown.map(function (i) {
          var fl = c.files.filter(function (f) { return f.interaction_id === i.id; });
          return '<div class="tl"><div class="dot">' + (ICON[i.type] || '•') + '</div><div><div class="what">' + LABEL[i.type] + (i.amount != null ? ' <span class="pill">' + money(i.amount) + '</span>' : '') + (i.next_date ? ' <span class="pill due">Follow up ' + date(i.next_date) + '</span>' : '') + '</div><p>' + esc(i.summary) + '</p><div class="muted small">' + esc(i.by_name || '') + ' &middot; ' + when(i.at) + '</div>' +
            (fl.length ? '<div class="chips" style="margin-top:6px">' + fl.map(function (f) { return '<a class="chip" href="/api/files/' + f.id + '?download=1">' + esc(f.name) + '</a>'; }).join('') + '</div>' : '') + '</div></div>';
        }).join('') + '</div>' : '<div class="empty">Nothing recorded yet.</div>') + '</div>' +
        (c.files.length ? '<div class="card"><h3>Files and pictures (' + c.files.length + ')</h3><div class="files">' + c.files.map(function (f) {
          return '<div class="file">' + (/^image\/(png|jpeg|webp|gif)$/.test(f.mime) ? '<a href="/api/files/' + f.id + '" target="_blank" rel="noopener"><img src="/api/files/' + f.id + '" alt="' + esc(f.name) + '" loading="lazy"></a>' : '') + '<b>' + esc(f.name) + '</b><span class="muted small">' + size(f.size) + ' &middot; ' + esc(f.by_name || '') + ' &middot; ' + when(f.at) + '</span><a class="btn sm" href="/api/files/' + f.id + '?download=1">Download</a></div>';
        }).join('') + '</div></div>' : '');
      view.querySelectorAll('[data-t]').forEach(function (b) { b.addEventListener('click', function () { typeFilter = b.dataset.t; customerScreen(cid).catch(fail); }); });
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
          return '<tr><td><b>' + esc(m.name) + '</b> ' + (m.active ? '' : '<span class="pill off">Switched off</span>') + '</td><td>' + esc(m.username) + '</td><td style="text-align:right"><button class="btn ghost sm" data-pw="' + m.id + '" data-name="' + esc(m.name) + '" type="button">Reset password</button> <button class="btn ghost sm" data-act="' + m.id + '" data-on="' + (m.active ? 0 : 1) + '" type="button">' + (m.active ? 'Switch off' : 'Switch on') + '</button></td></tr>';
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
    var p = e.target.closest('[data-pw]'), a = e.target.closest('[data-act]');
    if (p) { var pw = randomPassword(); if (!window.confirm('Set a new password for ' + p.dataset.name + '? Their old password stops working.')) return;
      api('POST', '/api/members/' + p.dataset.pw + '/password', { password: pw }).then(function () { return membersScreen(); }).then(function () { $('shown').innerHTML = '<div class="card" style="background:#f0fdfa;border-color:#99f6e4"><b>New password for ' + esc(p.dataset.name) + ' (shown once):</b> <b>' + esc(pw) + '</b></div>'; window.scrollTo(0, 0); }).catch(fail); return; }
    if (a) api('PATCH', '/api/members/' + a.dataset.act, { active: a.dataset.on === '1' }).then(function () { toast(a.dataset.on === '1' ? 'Switched on' : 'Switched off'); return membersScreen(); }).catch(fail);
  }

  // ---------- shell ----------
  function route() {
    var h = location.hash.replace(/^#/, '') || 'customers', parts = h.split('/');
    seq++; view.removeEventListener('click', onMembersClick);
    $('tabs').innerHTML = [['customers', 'Customers']].concat(me.role === 'admin' ? [['members', 'Members']] : []).map(function (t) { return '<button class="tab' + ((parts[0] === t[0] || (parts[0] === 'customer' && t[0] === 'customers')) ? ' on' : '') + '" data-go="' + t[0] + '" type="button">' + t[1] + '</button>'; }).join('');
    var screen = parts[0] === 'customer' && parts[1] ? customerScreen(parts[1]) : parts[0] === 'members' && me.role === 'admin' ? membersScreen() : customersScreen();
    screen.catch(function (e) { view.innerHTML = '<div class="card"><div class="err">' + esc(e.message) + '</div></div>'; });
  }
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b) location.hash = b.dataset.go; });
  $('out').addEventListener('click', function () { api('POST', '/api/auth/logout', {}).then(function () { location.replace('/login.html'); }); });
  window.addEventListener('hashchange', route);
  api('GET', '/api/me').then(function (r) { me = r.user; $('who').textContent = me.name + (me.role === 'admin' ? ' (admin)' : ''); route(); }).catch(fail);
})();
