(function () {
  'use strict';
  var P = window.Panel, esc = P.esc;

  P.register({ id: 'customers', label: 'Customers', roles: ['admin', 'employee'], order: 4, render: function (el) {
    var isAdmin = P.me.role === 'admin', filter = isAdmin ? 'all' : 'mine', who = '', q = '', outcomes = [], timer, lastSplit = '';

    function item(c) {
      var mine = c.ownerId === P.me.id, tone = c.followStatus === 'overdue' ? 'hot' : c.followStatus === 'due' ? 'warn' : '';
      var onb = c.onboardedManual ? (c.onboarded ? 'yes' : 'no') : 'auto';
      return '<div class="item ' + tone + '" data-id="' + esc(c.id) + '"><div class="head"><b>' + esc(c.name) + '</b><span class="chips">' + (c.regular ? P.pill('Regular', 'ok') : '') + P.pill(c.onboarded ? 'Onboarded' : 'Not onboarded yet', c.onboarded ? 'ok' : 'new') + (c.ownerId ? P.followBadge(c.followStatus, c.nextDate) : '') + '</span></div>' +
        '<div class="meta">' + (c.phone ? '<span>&#9742; <b>' + esc(c.phone) + '</b></span>' : '') + (c.email ? '<span>' + esc(c.email) + '</span>' : '') +
        '<span>' + (c.invoices ? c.invoices + ' invoice' + (c.invoices === 1 ? '' : 's') + ', ' + P.money(c.billed) + ' billed' + (c.lastInvoice ? ', last ' + P.fmtDate(c.lastInvoice) : '') : 'No invoices yet') + '</span>' + (c.outstanding ? '<span class="err">' + P.money(c.outstanding) + ' unpaid</span>' : '') +
        '<span>Owner: <b>' + (c.ownerId ? esc(c.ownerName) : 'nobody yet') + '</b></span></div>' +
        (c.lastAt ? '<div class="stamp">Last follow-up: <b>' + esc(c.lastOutcome) + '</b> &middot; ' + P.stamp(c.lastAt, c.lastByName) + (c.lastNote ? ' &middot; ' + esc(c.lastNote) : '') + '</div>' : (c.ownerId ? '<div class="stamp">Not followed up yet</div>' : '')) +
        '<div class="actions">' +
        (!c.ownerId && !isAdmin ? '<button class="btn sm" data-act="pick" type="button">I will take this customer</button>' : '') +
        (isAdmin ? '<select data-assign style="width:auto"><option value="">Nobody</option>' + P.userOptions(c.ownerId) + '</select>' : '') +
        (mine ? '<button class="btn sm" data-act="follow" type="button">Log a follow-up</button>' : '') +
        '<button class="btn ghost sm" data-act="history" type="button">History</button>' +
        ((mine || isAdmin) && c.ownerId ? '<select data-onb style="width:auto" title="Is this customer onboarded?"><option value="auto"' + (onb === 'auto' ? ' selected' : '') + '>Onboarded: automatic</option><option value="yes"' + (onb === 'yes' ? ' selected' : '') + '>Onboarded: yes</option><option value="no"' + (onb === 'no' ? ' selected' : '') + '>Onboarded: no</option></select>' : '') +
        '</div><div data-slot></div></div>';
    }

    // one donut chart with a drop-down to choose what it shows; drawn as SVG, the count beside each name in the legend
    var COLORS = ['#0f766e', '#1d4ed8', '#b45309', '#7c3aed', '#be185d', '#0891b2'], GREY = '#cbd5e1', pieView = 'all', owners = [];
    var VIEWS = [['all', 'All customers by owner'], ['regular', 'Regular customers by owner'], ['other', 'Other customers by owner'], ['kind', 'Regular vs occasional']];
    function pieParts(view) {
      var col = function (o, i) { return o.id ? COLORS[i % COLORS.length] : GREY; };
      if (view === 'kind') return [{ name: 'Regular (2+ invoices)', n: owners.reduce(function (s, o) { return s + o.regular; }, 0), color: '#0f766e' }, { name: 'Occasional / not yet invoiced', n: owners.reduce(function (s, o) { return s + o.other; }, 0), color: GREY }];
      return owners.map(function (o, i) { return { name: o.name, n: view === 'regular' ? o.regular : view === 'other' ? o.other : o.regular + o.other, color: col(o, i) }; });
    }
    function donut(parts) {
      var total = parts.reduce(function (s, p) { return s + p.n; }, 0), R = 56, r = 34, C = 60;
      var legend = parts.map(function (p) { var pc = total ? Math.round(p.n / total * 100) : 0; return '<div class="lg"><i style="background:' + p.color + '"></i><span class="nm">' + esc(p.name) + '</span><b>' + p.n + '</b><em>' + pc + '%</em><u style="width:' + pc + '%;background:' + p.color + '"></u></div>'; }).join('');
      var live = parts.filter(function (p) { return p.n > 0; }), svg;
      if (!total) svg = '<circle cx="60" cy="60" r="' + ((R + r) / 2) + '" fill="none" stroke="#eef2f6" stroke-width="' + (R - r) + '"/>';
      else if (live.length === 1) svg = '<circle cx="60" cy="60" r="' + ((R + r) / 2) + '" fill="none" stroke="' + live[0].color + '" stroke-width="' + (R - r) + '"><title>' + esc(live[0].name) + ': ' + live[0].n + '</title></circle>';
      else {
        var a = -Math.PI / 2; svg = parts.map(function (p) {
          if (!p.n) return ''; var x = p.n / total * 2 * Math.PI, e = a + x, big = x > Math.PI ? 1 : 0, pt = function (rad, ang) { return (C + rad * Math.cos(ang)).toFixed(2) + ' ' + (C + rad * Math.sin(ang)).toFixed(2); };
          var d = 'M' + pt(R, a) + ' A' + R + ' ' + R + ' 0 ' + big + ' 1 ' + pt(R, e) + ' L' + pt(r, e) + ' A' + r + ' ' + r + ' 0 ' + big + ' 0 ' + pt(r, a) + ' Z'; a = e;
          return '<path d="' + d + '" fill="' + p.color + '" stroke="#fff" stroke-width="1.5"><title>' + esc(p.name) + ': ' + p.n + '</title></path>';
        }).join('');
      }
      return '<div class="piewrap"><svg viewBox="0 0 120 120" width="170" height="170" role="img" aria-label="Customers donut chart">' + svg + '<text x="60" y="58" text-anchor="middle" font-size="18" font-weight="700" fill="#0f2a4a">' + total + '</text><text x="60" y="72" text-anchor="middle" font-size="8" fill="#64748b">customers</text></svg><div class="legend">' + legend + '</div></div>';
    }
    function ownerTable() {
      var row = function (o, i) { var t = o.regular + o.other; return '<tr><td><i class="dot" style="background:' + (o.id ? COLORS[i % COLORS.length] : GREY) + '"></i>' + esc(o.name) + '</td><td>' + o.regular + '</td><td>' + o.other + '</td><td><b>' + t + '</b></td></tr>'; };
      var sr = owners.reduce(function (s, o) { return s + o.regular; }, 0), so = owners.reduce(function (s, o) { return s + o.other; }, 0);
      return '<table class="otable"><thead><tr><th>Owner</th><th>Regular</th><th>Other</th><th>Total</th></tr></thead><tbody>' + owners.map(row).join('') + '</tbody><tfoot><tr><td>Everyone</td><td>' + sr + '</td><td>' + so + '</td><td>' + (sr + so) + '</td></tr></tfoot></table>';
    }
    function pieCard() {
      if (!owners || !owners.length) return '';
      return '<div class="card" id="pieCard"><div class="between"><div><h3>Customers by owner</h3><div class="muted small">Regular means invoiced 2 or more times.' + (owners.some(function (o) { return !o.id && o.regular + o.other; }) ? ' <b style="color:var(--warn)">Some customers have no owner yet.</b>' : '') + '</div></div><select id="pieSel" style="width:auto">' + VIEWS.map(function (v) { return '<option value="' + v[0] + '"' + (v[0] === pieView ? ' selected' : '') + '>' + esc(v[1]) + '</option>'; }).join('') + '</select></div><div class="pieGrid"><div id="pieBody">' + donut(pieParts(pieView)) + '</div>' + ownerTable() + '</div></div>';
    }
    function load(refresh) {
      var url = '/api/customers?filter=' + filter + (who ? '&userId=' + who : '') + (q ? '&q=' + encodeURIComponent(q) : '') + (refresh ? '&refresh=1' : '');
      return P.api('GET', url).then(function (r) {
        outcomes = r.outcomes; var c = r.counts || {};
        var seg = isAdmin ? [['all', 'All (' + (c.total || 0) + ')'], ['due', 'Follow-up due (' + (c.due || 0) + ')'], ['unassigned', 'No owner (' + (c.unassigned || 0) + ')'], ['notonboarded', 'Not onboarded']] :
          [['mine', 'My customers (' + (c.mine || 0) + ')'], ['due', 'Due today (' + (c.due || 0) + ')'], ['unassigned', 'Waiting for an owner (' + (c.unassigned || 0) + ')']];
        var focus = document.activeElement && document.activeElement.id === 'cq';
        el.innerHTML = '<div class="card"><div class="between"><div class="seg">' + seg.map(function (s) { return '<button class="btn ' + (filter === s[0] ? '' : 'ghost') + '" data-f="' + s[0] + '" type="button">' + s[1] + '</button>'; }).join('') + '</div>' +
          '<div class="actions">' + (isAdmin ? '<button class="btn ghost sm" id="share" type="button">Share unowned customers evenly</button><button class="btn ghost sm" id="resplit" type="button">Re-split all customers</button>' : '') + '<button class="btn ghost sm" id="rf" type="button">Refresh from Zoho</button></div></div>' +
          '<div class="row">' + (isAdmin ? '<label>Team member<select id="cw"><option value="">Everyone</option>' + P.userOptions(who) + '</select></label>' : '') + '<label style="flex:3 1 240px">Search<input id="cq" value="' + esc(q) + '" placeholder="Name, phone or email"></label></div></div>' +
          (isAdmin ? (owners = c.owners || [], pieCard()) : '') +
          (lastSplit ? '<div class="banner info">' + esc(lastSplit) + '</div>' : '') +
          (r.error ? '<div class="banner">Zoho did not answer: ' + esc(r.error) + '. Try "Refresh from Zoho" in a minute.</div>' : '') +
          (r.note ? '<div class="banner info">' + esc(r.note) + '</div>' : '') +
          (r.customers.length ? '<div class="list">' + r.customers.map(item).join('') + '</div>' : P.empty(r.error ? 'Customers could not be loaded.' : 'No customers match.'));
        if (focus) { var i = el.querySelector('#cq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
      });
    }
    // regular and other customers are shared out separately, so nobody ends up with most of either kind
    function split(all) {
      P.api('POST', '/api/customers/auto-assign', { all: all }).then(function (r) {
        var line = function (g, name) { return name + ': ' + g.perPerson.map(function (p) { return p.name + ' ' + p.count; }).join(', '); };
        lastSplit = r.assigned ? 'Shared out ' + r.assigned + ' customers. ' + line(r.groups.regular, 'Regular customers (' + r.groups.regular.customers + ')') + '. ' + line(r.groups.other, 'Other customers (' + r.groups.other.customers + ')') + '.' : 'Every customer already has an owner.';
        P.toast(r.assigned ? 'Customers shared out' : 'Every customer already has an owner');
        return load();
      }).catch(P.fail);
    }
    el.addEventListener('click', function (e) {
      var f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; load().catch(P.fail); return; }
      if (e.target.id === 'rf') { e.target.disabled = true; e.target.textContent = 'Asking Zoho...'; load(true).then(function () { P.toast('Customers refreshed from Zoho'); }).catch(P.fail); return; }
      if (e.target.id === 'resplit') {
        if (!window.confirm('Split ALL customers between the team again?\n\nEvery current owner is removed first. Regular customers (invoiced 2 or more times) are split evenly, and the others are split evenly separately, so nobody gets most of either kind.\n\nFollow-up history is kept.')) return;
        split(true); return;
      }
      if (e.target.id === 'share') { split(false); return; }
    });
    el.addEventListener('input', function (e) { if (e.target.id !== 'cq') return; q = e.target.value; clearTimeout(timer); timer = setTimeout(function () { load().catch(P.fail); }, 350); });
    el.addEventListener('change', function (e) {
      if (e.target.id === 'pieSel') { pieView = e.target.value; el.querySelector('#pieBody').innerHTML = donut(pieParts(pieView)); return; }
      if (e.target.id === 'cw') { who = e.target.value; load().catch(P.fail); return; }
      var o = e.target.closest('[data-onb]'); if (!o) return;
      P.api('PATCH', '/api/customers/' + o.closest('[data-id]').dataset.id, { onboarded: o.value === 'yes' ? true : o.value === 'no' ? false : null }).then(function () { P.toast('Saved'); return load(); }).catch(P.fail);
    });
    P.wireRecords(el, { base: '/api/customers', outcomes: function () { return outcomes; }, reload: load });
    return load();
  } });
})();
