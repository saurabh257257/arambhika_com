// The small framework every screen plugs into. To add a feature: write a file in /js that calls Panel.register(...) and
// list it in index.html. Nothing else needs to change. (The server side is the same idea: one file in /modules.)
//
//   Panel.register({ id, label, roles: ['admin', 'employee'], order, badge?, render: async (el) => { ... } })
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var screens = [], current = '', toastTimer;

  var Panel = window.Panel = {
    me: null, today: '', users: [], viewAs: '', badges: {},
    esc: esc,
    register: function (s) { screens.push(s); },
    toast: function (t) { var el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600); },
    fail: function (e) { Panel.toast(e.message || String(e)); },
    api: function (method, url, body) {
      var o = { method: method, headers: {} };
      if (body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
      return fetch(url, o).then(function (r) {
        if (r.status === 401) { location.replace('/login.html'); throw new Error('Please sign in'); }
        return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong'); return j; });
      });
    },
    // ---- small helpers the screens share ----
    fmtDate: function (d) { if (!d) return ''; var p = String(d).slice(0, 10).split('-'); return p[2] + '-' + p[1] + '-' + p[0]; },
    fmtTime: function (iso) { return iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''; },
    stamp: function (iso, by) { return iso ? (by ? esc(by) + ' &middot; ' : '') + Panel.fmtTime(iso) : ''; },
    money: function (n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }); },
    addDays: function (d, n) { return new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10); },
    pct: function (d, t) { return t > 0 ? Math.min(100, Math.round(d / t * 100)) : 0; },
    // a request's progress as a row of stops: what is done (and how long that step took after the one before it), what is
    // being waited on (and for how long), and what is still ahead. The first step is timed from when the request was logged.
    track: function (r, can) {
      var keys = [['ask', 'Asked'], ['quote', 'Quote sent'], ['payment', 'Paid'], ['ready', 'Ready'], ['dispatched', 'Dispatched'], ['done', 'Delivered']];
      var ms = function (iso) { return new Date(iso).getTime(); };
      var dur = function (n) { var m = Math.round(n / 60000); if (m < 1) return 'under 1 min'; if (m < 60) return m + ' min'; var h = Math.floor(m / 60); if (h < 24) return h + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : ''); var d = Math.floor(h / 24); return d + 'd' + (h % 24 ? ' ' + (h % 24) + 'h' : ''); };
      var times = [ms(r.createdAt)].concat(keys.filter(function (k) { return r.steps[k[0]]; }).map(function (k) { return ms(r.steps[k[0]].at); })).sort(function (a, b) { return a - b; });
      var prevOf = function (t) { var p = times[0]; times.forEach(function (x) { if (x < t) p = x; }); return t === times[0] ? t : p; };
      var cur = -1; keys.some(function (k, i) { if (!r.steps[k[0]]) { cur = i; return true; } return false; });
      var last = times[times.length - 1];
      var html = keys.map(function (k, i) {
        var d = r.steps[k[0]], cls = d ? 'done' : i === cur ? 'now' : '', sub = '';
        if (d) sub = '<b>' + dur(ms(d.at) - prevOf(ms(d.at))) + '</b><span>' + esc(Panel.fmtTime(d.at)) + '</span>';
        else if (i === cur) sub = '<b>waiting ' + dur(Date.now() - last) + '</b>';
        return '<div class="tk ' + cls + (can ? ' tap' : '') + '"><i' + (can ? ' role="button" tabindex="0" data-tick="' + k[0] + '" data-on="' + (d ? 1 : 0) + '" title="' + (d ? 'Click to undo' : 'Click when done') + '"' : '') + '>' + (d ? '&#10003;' : i + 1) + '</i><em>' + k[1] + '</em>' + sub + '</div>';
      }).join('');
      var all = r.steps.done ? ms(r.steps.done.at) - times[0] : 0;
      return '<div class="track">' + html + '</div>' + (r.steps.done ? '<div class="muted small">Delivered in ' + dur(all) + ' from when it was logged</div>' : '');
    },
    bar: function (done, total) { var p = Panel.pct(done, total); return '<div class="bar ' + (total > 0 && done >= total ? 'done' : '') + '"><i style="width:' + p + '%"></i></div>'; },
    pill: function (text, cls) { return '<span class="pill ' + (cls || '') + '">' + esc(text) + '</span>'; },
    empty: function (text) { return '<div class="card empty">' + esc(text) + '</div>'; },
    userOptions: function (selected, blank) { return (blank ? '<option value="">' + esc(blank) + '</option>' : '') + Panel.users.filter(function (u) { return u.active !== false; }).map(function (u) { return '<option value="' + esc(u.id) + '"' + (u.id === selected ? ' selected' : '') + '>' + esc(u.name) + '</option>'; }).join(''); },
    // the follow-up badge: where this follow-up stands
    followBadge: function (status, nextDate) {
      var label = { overdue: 'Follow-up overdue', due: 'Follow up today', ok: 'Next: ' + Panel.fmtDate(nextDate), none: 'Not started', new: 'New, not contacted', later: 'Not needed yet', closed: 'Closed' }[status] || status;
      return Panel.pill(label, status === 'ok' ? 'ok' : status);
    },
    // the follow-up form used by leads, customers and invoices: pick what happened, and the next date fills itself in from the rules
    followForm: function (outcomes, noteHint) {
      return '<form class="fu" data-fu><div class="row"><label>What happened<select name="outcome"><option value="">Choose...</option>' + outcomes.map(function (o) { return '<option value="' + esc(o.key) + '">' + esc(o.label) + '</option>'; }).join('') + '</select></label>' +
        '<label>Next follow-up<input type="date" name="nextDate" min="' + Panel.today + '"></label></div>' +
        '<div class="small muted" data-hint>Pick what happened. The next follow-up date is suggested from your rules, and you can change it.</div>' +
        '<label>Note<input name="note" maxlength="1000" placeholder="' + esc(noteHint || 'What was said') + '"></label><div class="actions"><button class="btn sm" type="submit">Save follow-up</button><button class="btn ghost sm" type="button" data-fu-cancel>Cancel</button></div></form>';
    },
    wireFollow: function (form, outcomes, submit) {
      var sel = form.outcome, date = form.nextDate, hint = form.querySelector('[data-hint]');
      sel.addEventListener('change', function () {
        var r = outcomes.filter(function (o) { return o.key === sel.value; })[0]; if (!r) return;
        if (r.askDate) { date.value = ''; hint.textContent = 'Pick the date they promised.'; }
        else if (r.days) { date.value = Panel.addDays(Panel.today, r.days); hint.textContent = 'Suggested: follow up again in ' + r.days + ' day' + (r.days === 1 ? '' : 's') + '. You can change the date.'; }
        else { date.value = ''; hint.textContent = 'No further follow-up is needed for this.'; }
      });
      form.addEventListener('submit', function (e) { e.preventDefault(); if (!sel.value) { Panel.toast('Choose what happened'); return; } submit({ outcome: sel.value, note: form.note.value, nextDate: date.value }, form); });
    },
    history: function (rows) {
      return rows.length ? '<div class="hist">' + rows.map(function (h) { return '<div><b>' + esc(h.outcomeLabel) + '</b> &middot; ' + Panel.stamp(h.at, h.byName) + (h.nextDate ? ' &middot; next ' + Panel.fmtDate(h.nextDate) : '') + (h.note ? '<div class="muted">' + esc(h.note) + '</div>' : '') + '</div>'; }).join('') + '</div>' : '<div class="hist muted">No follow-ups yet.</div>';
    },
    // Buttons shared by leads, customers and invoices. Put data-id on the item, a <div data-slot> inside it, and
    // buttons with data-act="pick" | "follow" | "history", plus <select data-assign> for the owner. o = { base, outcomes(), reload() }
    wireRecords: function (el, o) {
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]'); if (!b) return;
        var item = b.closest('[data-id]'), id = item.dataset.id, slot = item.querySelector('[data-slot]'), act = b.dataset.act;
        if (act === 'pick') { b.disabled = true; Panel.api('POST', o.base + '/' + id + '/pick', {}).then(function () { Panel.toast('Picked. It is yours now.'); return o.reload(); }).catch(function (err) { b.disabled = false; Panel.fail(err); }); return; }
        if (act === 'follow') {
          if (slot.dataset.mode === 'follow') { slot.innerHTML = ''; slot.dataset.mode = ''; return; }
          var outs = o.outcomes(); slot.dataset.mode = 'follow'; slot.innerHTML = Panel.followForm(outs);
          var f = slot.querySelector('form');
          f.querySelector('[data-fu-cancel]').addEventListener('click', function () { slot.innerHTML = ''; slot.dataset.mode = ''; });
          Panel.wireFollow(f, outs, function (vals) { Panel.api('POST', o.base + '/' + id + '/followup', vals).then(function () { Panel.toast('Follow-up saved ' + Panel.fmtTime(new Date().toISOString())); return o.reload(); }).catch(Panel.fail); });
          return;
        }
        if (act === 'history') {
          if (slot.dataset.mode === 'history') { slot.innerHTML = ''; slot.dataset.mode = ''; return; }
          Panel.api('GET', o.base + '/' + id + '/history').then(function (r) { slot.dataset.mode = 'history'; slot.innerHTML = Panel.history(r.history); }).catch(Panel.fail);
        }
      });
      el.addEventListener('change', function (e) {
        var s = e.target.closest('[data-assign]'); if (!s) return;
        Panel.api('POST', o.base + '/' + s.closest('[data-id]').dataset.id + '/assign', { ownerId: s.value }).then(function () { Panel.toast('Assigned'); return o.reload(); }).catch(Panel.fail);
      });
    },
    go: function (id, opts) { if (opts && opts.viewAs !== undefined) Panel.viewAs = opts.viewAs; if (location.hash !== '#' + id) location.hash = id; else show(id); },
    refreshBadges: function () { return Promise.resolve(); },
  };

  function visible() {
    return screens.filter(function (s) { return s.roles.indexOf(Panel.me.role) >= 0; }).sort(function (a, b) { return a.order - b.order; });
  }
  function drawTabs() {
    $('tabs').innerHTML = visible().map(function (s) {
      var n = Panel.badges[s.id];
      return '<button type="button" class="tab ' + (s.id === current ? 'on' : '') + '" data-t="' + s.id + '">' + esc(s.label) + (n ? '<span class="n">' + n + '</span>' : '') + '</button>';
    }).join('');
  }
  function show(id) {
    var s = visible().filter(function (x) { return x.id === id; })[0] || visible()[0];
    current = s.id; drawTabs();
    var el = document.createElement('div'); el.innerHTML = '<p class="muted">Loading...</p>';
    $('view').replaceChildren(el);
    Promise.resolve(s.render(el)).catch(function (e) { el.innerHTML = '<div class="card"><div class="err">' + esc(e.message || e) + '</div></div>'; });
    window.scrollTo(0, 0);
  }
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (b) Panel.go(b.dataset.t, { viewAs: '' }); });
  window.addEventListener('hashchange', function () { if (Panel.me) show(location.hash.slice(1)); });
  $('out').addEventListener('click', function () { fetch('/api/auth/logout', { method: 'POST' }).finally(function () { location.replace('/login.html'); }); });

  // called once every screen file has loaded
  Panel.start = function () {
    Panel.api('GET', '/api/me').then(function (r) {
      Panel.me = r.user; Panel.today = r.today; $('who').textContent = r.user.name;
      return Panel.api('GET', '/api/users').then(function (u) { Panel.users = u.users; });
    }).then(function () { show(location.hash.slice(1)); }).catch(Panel.fail);
  };
  Panel.setBadge = function (id, n) { Panel.badges[id] = n; drawTabs(); };
})();
