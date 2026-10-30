(function () {
  'use strict';
  var P = window.Panel, esc = P.esc;

  function count(p) {
    var t = p.target;
    var cls = t === null ? '' : p.month >= t ? 'ok' : 'pcr';
    return '<b class="' + cls + '">' + p.month + (t === null ? '' : ' of ' + t) + '</b>';
  }

  // a small card for the Dashboard and My day: this month's count per person, linking to the full tab
  P.newCustomersTile = function (el) {
    return P.api('GET', '/api/new-customers').then(function (d) {
      if (!d.people.length) return;
      var c = document.createElement('div'); c.className = 'card';
      c.innerHTML = '<div class="between"><h3>New customers sold this month</h3><a class="btn ghost sm" href="#newcustomers">See the list</a></div>' +
        d.people.map(function (p) { return '<div class="part"><div class="between"><span>' + esc(p.name) + '</span><span>' + count(p) + ' <span class="muted small">&middot; ' + p.week + ' this week</span></span></div></div>'; }).join('');
      el.appendChild(c);
    }).catch(function () {});
  };

  P.register({ id: 'newcustomers', label: 'New customers', roles: ['admin', 'employee'], order: 2.5, render: function (el) {
    var isAdmin = P.me.role === 'admin', month = P.today.slice(0, 7);

    function load() {
      return P.api('GET', '/api/new-customers?month=' + month).then(function (d) {
        var tiles = d.people.map(function (p) {
          return '<div class="card tight"><div class="between"><h3>' + esc(p.name) + '</h3>' + (isAdmin ? '<button class="btn ghost sm" type="button" data-target="' + esc(p.id) + '" data-name="' + esc(p.name) + '" data-val="' + (p.target === null ? '' : p.target) + '">' + (p.target === null ? 'Set target' : 'Change target') + '</button>' : '') + '</div>' +
            '<div class="big">' + count(p) + '<small> in ' + esc(month) + '</small></div>' +
            '<div class="muted small">' + p.today + ' today &middot; ' + p.week + ' this week &middot; ' + p.allTime + ' in all</div>' +
            (p.target !== null ? P.bar(p.month, p.target) : '<div class="muted small">No monthly target set.</div>') + '</div>';
        }).join('') || P.empty('No team members yet.');
        var rows = d.customers.length ? '<table class="table"><thead><tr><th>Customer</th><th>Sold on</th><th>First order</th>' + (isAdmin ? '<th>Sold by</th><th></th>' : '') + '</tr></thead><tbody>' + d.customers.map(function (c) {
          return '<tr><td><b>' + esc(c.customerName) + '</b>' + (c.company ? '<div class="muted small">' + esc(c.company) + '</div>' : '') + '</td><td>' + P.fmtDate(c.soldDate) + '</td><td>' + (c.amount ? P.money(c.amount) : '<span class="muted">&ndash;</span>') + '</td>' +
            (isAdmin ? '<td><select data-credit="' + esc(c.requestId) + '">' + P.userOptions(c.userId) + '</select></td><td><button class="btn ghost sm" type="button" data-notnew="' + esc(c.requestId) + '" data-yes="1">Not new</button></td>' : '') + '</tr>';
        }).join('') + '</tbody></table>' : '<div class="muted">No new customers sold in this month yet.</div>';
        var skipped = d.skipped.length ? '<div class="card"><h3>Not counted</h3><div class="muted small">Delivered this month, but left out because the customer is not new.</div><div class="list">' + d.skipped.map(function (c) {
          return '<div class="item"><div class="between"><span><b>' + esc(c.customerName) + '</b> <span class="muted">' + esc(c.userName) + ' &middot; ' + P.fmtDate(c.soldDate) + '</span></span>' + (c.skip.indexOf('Marked') === 0 ? '<button class="btn ghost sm" type="button" data-notnew="' + esc(c.requestId) + '" data-yes="0">Count it</button>' : '') + '</div><div class="muted small">' + esc(c.skip) + '</div></div>';
        }).join('') + '</div></div>' : '';
        el.innerHTML = '<div class="card"><div class="between"><div><h3>New customers sold</h3><div class="muted small">A customer counts once, when their first request is delivered, for whoever owns that request. Customers who already have an invoice in Zoho are not counted.</div></div>' +
          '<label class="fit">Month<input type="month" id="ncMonth" value="' + esc(month) + '" max="' + P.today.slice(0, 7) + '"></label></div>' +
          (d.zohoChecked ? '' : '<div class="banner">' + (d.zohoError ? 'Zoho could not be checked just now (' + esc(d.zohoError) + '), so older customers may be counted as new.' : 'Zoho is not connected, so customers who already buy from you may be counted as new.') + '</div>') + '</div>' +
          '<div class="grid2">' + tiles + '</div><div class="card"><h3>Customers sold in ' + esc(month) + '</h3>' + rows + '</div>' + skipped;
      });
    }
    el.addEventListener('change', function (e) {
      if (e.target.id === 'ncMonth') { if (e.target.value) { month = e.target.value; load().catch(P.fail); } return; }
      var s = e.target.closest('[data-credit]'); if (s) P.api('POST', '/api/new-customers/' + s.dataset.credit + '/override', { creditTo: s.value }).then(function () { P.toast('Credit moved'); return load(); }).catch(P.fail);
    });
    el.addEventListener('click', function (e) {
      var n = e.target.closest('[data-notnew]');
      if (n) { P.api('POST', '/api/new-customers/' + n.dataset.notnew + '/override', { notNew: n.dataset.yes === '1' }).then(function () { P.toast(n.dataset.yes === '1' ? 'Left out of the count' : 'Counted again'); return load(); }).catch(P.fail); return; }
      var t = e.target.closest('[data-target]');
      if (t) { var v = window.prompt('Monthly target of new customers for ' + t.dataset.name + ' (leave empty for none)', t.dataset.val); if (v === null) return; P.api('PATCH', '/api/users/' + t.dataset.target, { newCustomerTarget: v.trim() }).then(function () { P.toast('Target saved'); return load(); }).catch(P.fail); }
    });
    return load();
  } });
})();
