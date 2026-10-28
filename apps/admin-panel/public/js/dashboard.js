(function () {
  'use strict';
  var P = window.Panel, esc = P.esc;

  function part(label, d, goTo) {
    if (!d.total) return '<div class="part"><div class="between"><span>' + esc(label) + '</span><span class="muted">nothing today</span></div></div>';
    return '<div class="part"><div class="between"><span>' + (goTo ? '<a href="#' + goTo + '">' + esc(label) + '</a>' : esc(label)) + '</span><b>' + d.done + ' of ' + d.total + '</b></div>' + P.bar(d.done, d.total) + '</div>';
  }
  function overall(p) {
    var o = p.overall;
    if (o.percent === null) return '<div class="big">&ndash;<small> nothing assigned yet</small></div>';
    return '<div class="between"><div class="big">' + o.percent + '<small>% done</small></div><div class="muted">' + o.done + ' of ' + o.total + ' done &middot; <b>' + o.left + ' left</b></div></div>' + P.bar(o.done, o.total);
  }
  function parts(p) {
    return part('Tasks', p.tasks, 'tasks') + part('Customer follow-ups', p.customers, 'customers') + part('Invoice follow-ups', p.invoices, 'invoices') + part('Leads to contact', p.leads, 'leads');
  }

  // ---------------- a team member's own day ----------------
  P.register({ id: 'home', label: 'My day', roles: ['employee'], order: 0, render: function (el) {
    return P.api('GET', '/api/my-day').then(function (d) {
      var p = d.progress;
      el.innerHTML = '<div class="card"><h3>Today, ' + P.fmtDate(P.today) + '</h3>' + overall(p) + '<div class="grid2">' + parts(p) + '</div>' +
        (p.invoices && p.invoices.error ? '<div class="banner">Invoice follow-ups could not be loaded from Zoho right now: ' + esc(p.invoices.error) + '</div>' : '') +
        '<div class="stamp">' + (d.lastActivity ? 'Your last update: ' + P.fmtTime(d.lastActivity) : 'You have not updated anything yet today.') + '</div></div>' +
        '<div class="card"><h3>Your tasks today</h3>' + (d.tasks.length ? '<div class="list">' + d.tasks.map(function (t) {
          return '<a class="item" href="#tasks" style="text-decoration:none;color:inherit"><div class="between"><b>' + esc(t.name) + '</b><span class="muted">' + t.done + ' of ' + t.total + '</span></div>' + P.bar(t.done, t.total) + (t.updatedAt ? '<div class="stamp">Updated ' + P.fmtTime(t.updatedAt) + '</div>' : '') + '</a>';
        }).join('') + '</div>' : '<div class="muted">No tasks assigned to you today.</div>') + '</div>' +
        ((d.available.leads || d.available.orders) ? '<div class="card"><h3>Waiting for somebody to pick</h3><div class="actions">' + (d.available.leads ? '<a class="btn ghost sm" href="#leads">' + d.available.leads + ' new lead' + (d.available.leads === 1 ? '' : 's') + '</a>' : '') + (d.available.orders ? '<a class="btn ghost sm" href="#orders">' + d.available.orders + ' new order' + (d.available.orders === 1 ? '' : 's') + '</a>' : '') + '</div></div>' : '');
    });
  } });

  // ---------------- the owner's dashboard ----------------
  P.register({ id: 'dashboard', label: 'Dashboard', roles: ['admin'], order: 0, render: function (el) {
    return P.api('GET', '/api/dashboard').then(function (d) {
      var a = d.alerts;
      P.setBadge('office', a.pendingApprovals);
      function stat(n, label, to, hot) { return '<a class="stat link ' + (hot && n ? 'hot' : '') + '" href="#' + to + '" style="text-decoration:none"><b>' + n + '</b><span>' + esc(label) + '</span></a>'; }
      var z = d.zoho;
      el.innerHTML = '<div class="card"><div class="between"><h3>Needs your attention</h3><span class="muted">' + P.fmtDate(d.date) + '</span></div><div class="stats">' +
        stat(a.unassignedLeads, 'new leads, nobody picked', 'leads', true) + stat(a.unassignedOrders, 'new orders, nobody picked', 'orders', true) +
        stat(a.unassignedCustomers + ' / ' + a.totalCustomers, 'customers without an owner', 'customers', a.unassignedCustomers > 0) + stat(a.unassignedInvoices, 'unpaid invoices without an owner', 'invoices', true) +
        stat(a.invoicesToChase, 'invoices not being followed up', 'invoices', true) + stat(a.invoiceCompliance + '%', 'invoice follow-up on track', 'invoices', a.invoiceCompliance < 100) + stat(a.pendingApprovals, 'transactions to approve', 'office', true) + '</div>' +
        (a.notStarted.length ? '<div class="banner">Not started yet today: <b>' + a.notStarted.map(esc).join(', ') + '</b></div>' : '') + '</div>' +
        '<div class="grid2">' + (d.team.map(function (t) {
          var p = t.progress, o = p.overall;
          return '<div class="card"><div class="between"><h3>' + esc(t.name) + '</h3><span class="stamp">' + (t.lastActivity ? 'Last update ' + P.fmtTime(t.lastActivity) : '<span class="err">Not started today</span>') + '</span></div>' + overall(p) + parts(p) +
            '<div class="chips"><span class="chip">' + t.activeOrders + ' active order' + (t.activeOrders === 1 ? '' : 's') + '</span>' + (t.pendingTransactions ? '<span class="chip">' + t.pendingTransactions + ' to approve</span>' : '') + '</div>' +
            '<div class="actions"><button class="btn ghost sm" data-work="' + esc(t.id) + '" type="button">See their work</button></div></div>';
        }).join('') || P.empty('No team members yet. Add them in the Team tab.')) + '</div>' +
        '<div class="card"><div class="between"><h3>Zoho connection</h3><button class="btn ghost sm" id="zr" type="button">Refresh from Zoho</button></div>' +
        (!z.configured ? '<div class="banner">Zoho is not connected to this panel yet. Customers, invoices and website orders will appear once it is.</div>' :
          '<div class="stats">' + [['Customers', z.customers], ['Invoices', z.invoices], ['Sales orders', z.salesOrders]].map(function (r) { return '<div class="stat"><b>' + (r[1].count || 0) + '</b><span>' + r[0] + (r[1].at ? ' &middot; pulled ' + P.fmtTime(new Date(r[1].at).toISOString()) : '') + '</span>' + (r[1].error ? '<span class="err">' + esc(r[1].error) + '</span>' : '') + '</div>'; }).join('') + '</div>' +
          (z.customers.source === 'invoices' ? '<div class="banner info">Customers are being built from invoices because the saved Zoho login cannot read the contact list.</div>' : '')) +
        '<div class="muted small">Data is pulled from Zoho Books when you open a screen (kept for 5 minutes) and nothing is copied or changed in Zoho.</div></div>';
      el.addEventListener('click', function (e) {
        var w = e.target.closest('[data-work]'); if (w) P.go('work', { viewAs: w.dataset.work });
        if (e.target.id === 'zr') { e.target.disabled = true; e.target.textContent = 'Refreshing...'; P.api('POST', '/api/zoho/refresh', {}).then(function () { P.toast('Refreshed from Zoho'); P.go('dashboard'); window.dispatchEvent(new Event('hashchange')); }).catch(P.fail); }
      });
    });
  } });
})();
