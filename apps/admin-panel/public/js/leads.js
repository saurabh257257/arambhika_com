(function () {
  'use strict';
  var P = window.Panel, esc = P.esc;
  var TYPE = { call10: 'Call 10', find4: 'Find 4', request: 'Request' };
  var COLS = [['name', 'Customer'], ['phone', 'Phone'], ['status', 'Status'], ['owner', 'Found by'], ['source', 'Source'], ['category', 'Category'], ['first', 'First contact'], ['follow', 'Follow up on'], ['note', 'What was said']].concat([['actions', '']]);

  // the leads found by the team (from customers.json) as a table, with filters, sorting and a spreadsheet download
  P.register({ id: 'leads', label: 'Leads', roles: ['admin', 'employee'], order: 10.5, render: function (el) {
    var isAdmin = P.me.role === 'admin', rows = [], timer;
    var f = { q: '', status: 'lead', owner: '', source: '', category: '', follow: '', month: '' }, sort = { key: 'first', dir: -1 };

    function toRow(c) {
      var l = c.lead || { sources: [], categories: [] }, last = l.sources.filter(function (s) { return s.note; }).pop();
      var status = c.stage === 'customer' ? (l.converted ? 'Converted' : l.linkedOnly ? 'Already a customer' : 'Customer') : (c.unmatched ? 'Lead (no mobile)' : 'Lead');
      return { id: c.id, manual: Boolean(l.manual), requestIds: l.sources.filter(function (x) { return x.type === 'request'; }).map(function (x) { return x.refId; }), name: c.name, company: c.company || '', phone: c.phone || '', stage: c.stage, status: status, ownerId: l.ownerId || '', owner: l.ownerName || '',
        sources: uniq(l.sources.map(function (s) { return s.type; })), source: uniq(l.sources.map(function (s) { return TYPE[s.type] || s.type; })).join(', '),
        categories: l.categories || [], category: (l.categories || []).join(', '), first: l.firstContactOn || '', follow: l.nextFollowUp || '', note: last ? last.note : '' };
    }
    function uniq(a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); }
    function matches(r) {
      if (f.status === 'lead' && r.stage !== 'lead') return false;
      if (f.status === 'customer' && r.stage !== 'customer') return false;
      if (f.owner && r.ownerId !== f.owner) return false;
      if (f.source && r.sources.indexOf(f.source) < 0) return false;
      if (f.category && r.categories.indexOf(f.category) < 0) return false;
      if (f.month && String(r.first).slice(0, 7) !== f.month) return false;
      if (f.follow === 'none' && r.follow) return false;
      if (f.follow === 'set' && !r.follow) return false;
      if (f.follow === 'due' && !(r.follow && r.follow <= P.today)) return false;
      if (f.q && (r.name + ' ' + r.company + ' ' + r.phone + ' ' + r.note).toLowerCase().indexOf(f.q.toLowerCase()) < 0) return false;
      return true;
    }
    function sorted(list) {
      return list.slice().sort(function (a, b) {
        var x = String(a[sort.key] || '').toLowerCase(), y = String(b[sort.key] || '').toLowerCase();
        if (!x !== !y && (sort.key === 'follow' || sort.key === 'first')) return !x ? 1 : -1; // a missing date goes last
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
      });
    }
    function options(values, current, blank) {
      return '<option value="">' + esc(blank) + '</option>' + values.map(function (v) { return '<option value="' + esc(v[0]) + '"' + (v[0] === current ? ' selected' : '') + '>' + esc(v[1]) + '</option>'; }).join('');
    }
    function draw() {
      var all = rows, shown = sorted(all.filter(matches));
      var owners = uniq(all.map(function (r) { return r.ownerId; })).map(function (id) { return [id, (all.filter(function (r) { return r.ownerId === id; })[0] || {}).owner || '?']; });
      var cats = uniq([].concat.apply([], all.map(function (r) { return r.categories; }))).map(function (c) { return [c, c]; });
      var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      var months = uniq(all.map(function (r) { return String(r.first).slice(0, 7); })).sort().reverse().map(function (m) { return [m, MON[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4)]; });
      var count = function (s) { return all.filter(function (r) { return r.stage === s; }).length; };
      var tbody = shown.map(function (r) {
        var late = r.follow && r.follow <= P.today && r.stage === 'lead';
        return '<tr><td><b>' + esc(r.name) + '</b>' + (r.company ? '<div class="muted small">' + esc(r.company) + '</div>' : '') + '</td><td>' + esc(r.phone) + '</td><td>' + P.pill(r.status, r.stage === 'customer' ? 'ok' : r.status.indexOf('no mobile') >= 0 ? 'overdue' : 'due') + '</td><td>' + esc(r.owner) + '</td><td>' + esc(r.source) + '</td><td>' + esc(r.category) + '</td><td>' + P.fmtDate(r.first) + '</td><td>' + (r.follow ? (late ? '<span class="err">' + P.fmtDate(r.follow) + '</span>' : P.fmtDate(r.follow)) : '<span class="muted">&ndash;</span>') + '</td><td>' + esc(r.note) + '</td><td>' + actions(r) + '</td></tr>';
      }).join('');
      var focus = document.activeElement && document.activeElement.id === 'lq';
      el.innerHTML = '<div class="card"><div class="between"><div class="seg">' + [['lead', 'Leads (' + count('lead') + ')'], ['customer', 'Became customers (' + count('customer') + ')'], ['all', 'All (' + all.length + ')']].map(function (s) { return '<button class="btn ' + (f.status === s[0] ? '' : 'ghost') + '" data-s="' + s[0] + '" type="button">' + s[1] + '</button>'; }).join('') + '</div>' +
        '<div class="actions"><button class="btn ghost sm" id="lcsv" type="button">Download this table (CSV)</button>' + (isAdmin ? '<a class="btn ghost sm" href="/api/master/file/customers" download>customers.json</a><a class="btn ghost sm" href="/api/master/file/call10" download>call10.json</a><a class="btn ghost sm" href="/api/master/file/find4" download>find4.json</a><a class="btn ghost sm" href="/api/master/file/newrequests" download>newrequests.json</a>' : '') + '</div></div>' +
        '<div class="row"><label style="flex:2 1 200px">Search<input id="lq" value="' + esc(f.q) + '" placeholder="Name, phone, company or note"></label>' +
        '<label>Found by<select data-f="owner">' + options(owners, f.owner, 'Everyone') + '</select></label>' +
        '<label>Source<select data-f="source">' + options([['call10', 'Call 10 people'], ['find4', 'Find 4 customers'], ['request', 'Customer request']], f.source, 'All sources') + '</select></label>' +
        '<label>Category<select data-f="category">' + options(cats, f.category, 'All categories') + '</select></label>' +
        '<label>Month found<select data-f="month">' + options(months, f.month, 'All months') + '</select></label>' +
        '<label>Follow-up<select data-f="follow">' + options([['due', 'Due or overdue'], ['set', 'Has a date'], ['none', 'No date']], f.follow, 'Any') + '</select></label></div>' +
        '<div class="muted small">' + shown.length + ' of ' + all.length + ' shown. People the team logged, matched by mobile number. A lead becomes a customer when Zoho shows a paid invoice for the same number.</div></div>' +
        '<div class="card" style="padding:0;overflow-x:auto"><table class="table leadtable"><thead><tr>' + COLS.map(function (c) { return '<th data-sort="' + c[0] + '" style="cursor:pointer">' + c[1] + (sort.key === c[0] ? (sort.dir > 0 ? ' &#9650;' : ' &#9660;') : '') + '</th>'; }).join('') + '</tr></thead><tbody>' + (tbody || '<tr><td colspan="' + COLS.length + '" class="muted">Nothing matches.</td></tr>') + '</tbody></table></div>';
      if (focus) { var i = el.querySelector('#lq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
      el.__shown = shown;
    }
    // owner only: turn a lead into a customer by hand (and undo it), or delete the customer requests it came from
    function actions(r) {
      if (!isAdmin) return '';
      return (r.stage === 'lead' ? '<button class="btn sm" data-conv="' + esc(r.id) + '" type="button">Convert to customer</button>' : r.manual ? '<button class="btn ghost sm" data-unconv="' + esc(r.id) + '" type="button">Undo</button>' : '') +
        (r.requestIds.length ? '<button class="btn ghost sm" data-delreq="' + esc(r.requestIds.join(',')) + '" type="button" style="color:#b91c1c">Delete request' + (r.requestIds.length > 1 ? 's' : '') + '</button>' : '');
    }
    function reload() { return P.api('GET', '/api/master/customers?leads=1').then(function (r) { rows = r.customers.filter(function (c) { return c.lead; }).map(toRow); draw(); }); }
    function csv(list) {
      var cell = function (v) { var t = String(v == null ? '' : v); if (/^[=+@-]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
      var head = ['Customer', 'Company', 'Phone', 'Status', 'Found by', 'Source', 'Category', 'First contact', 'Follow up on', 'What was said'];
      var body = list.map(function (r) { return [r.name, r.company, r.phone, r.status, r.owner, r.source, r.category, r.first, r.follow, r.note].map(cell).join(','); });
      var blob = new Blob(['﻿' + [head.map(cell).join(',')].concat(body).join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'leads-' + P.today + '.csv'; document.body.appendChild(a); a.click(); a.remove();
    }

    el.addEventListener('click', function (e) {
      var s = e.target.closest('[data-s]'); if (s) { f.status = s.dataset.s; draw(); return; }
      var h = e.target.closest('[data-sort]'); if (h) { sort = { key: h.dataset.sort, dir: sort.key === h.dataset.sort ? -sort.dir : 1 }; draw(); return; }
      if (e.target.id === 'lcsv') { csv(el.__shown || []); return; }
      var cv = e.target.closest('[data-conv]');
      if (cv) { if (window.confirm('Turn this lead into a customer? Use this when they already buy from you or have paid outside Zoho. You can undo it.')) P.api('POST', '/api/master/convert', { id: cv.dataset.conv }).then(function () { P.toast('Converted to a customer'); return reload(); }).catch(P.fail); return; }
      var uc = e.target.closest('[data-unconv]');
      if (uc) { P.api('POST', '/api/master/convert', { id: uc.dataset.unconv, undo: true }).then(function () { P.toast('Back to a lead'); return reload(); }).catch(P.fail); return; }
      var dr = e.target.closest('[data-delreq]');
      if (dr) {
        var ids = dr.dataset.delreq.split(',');
        if (!window.confirm('Delete ' + (ids.length > 1 ? 'these ' + ids.length + ' customer requests' : 'this customer request') + ' for good? Notes and screenshots are removed too. If the lead came from Call 10 or Find 4 as well, it stays.')) return;
        Promise.all(ids.map(function (id) { return P.api('DELETE', '/api/requests/' + id); })).then(function () { P.toast('Deleted'); return new Promise(function (ok) { setTimeout(ok, 1300); }); }).then(reload).catch(P.fail);
      }
    });
    el.addEventListener('change', function (e) { var k = e.target.dataset && e.target.dataset.f; if (k) { f[k] = e.target.value; draw(); } });
    el.addEventListener('input', function (e) { if (e.target.id !== 'lq') return; f.q = e.target.value; clearTimeout(timer); timer = setTimeout(draw, 200); });
    return P.api('GET', '/api/master/customers?leads=1').then(function (r) { rows = r.customers.filter(function (c) { return c.lead; }).map(toRow); draw(); });
  } });
})();
