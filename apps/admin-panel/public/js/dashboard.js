(function () {
  'use strict';
  var P = window.Panel, esc = P.esc;

  function part(label, d, goTo, note) {
    if (!d.total) return '<div class="part"><div class="between"><span>' + esc(label) + '</span><span class="muted">nothing today</span></div></div>';
    return '<div class="part"><div class="between"><span>' + (goTo ? '<a href="#' + goTo + '">' + esc(label) + '</a>' : esc(label)) + (note ? ' <span class="muted small">' + esc(note) + '</span>' : '') + '</span><b>' + d.done + ' of ' + d.total + '</b></div>' + P.bar(d.done, d.total) + '</div>';
  }
  function overall(p) {
    var o = p.overall;
    if (o.percent === null) return '<div class="big">&ndash;<small> ' + (p.workDay === false ? 'day off' : 'nothing assigned yet') + '</small></div>';
    return '<div class="between"><div class="big">' + o.percent + '<small>% done</small></div><div class="muted">' + o.done + ' of ' + o.total + ' done &middot; <b>' + o.left + ' left</b></div></div>' + P.bar(o.done, o.total);
  }
  function parts(p) {
    return part('Tasks', p.tasks, 'tasks') + part('Call follow-ups', p.followups, 'tasks') + part('Customer requests', p.requests, 'requests') + part('Customer follow-ups', p.customers, 'customers') + part('Invoice follow-ups', p.invoices, 'invoices');
  }

  // ---------------- a team member's own day ----------------
  P.register({ id: 'home', label: 'My day', roles: ['employee'], order: 0, render: function (el) {
    return P.api('GET', '/api/my-day').then(function (d) {
      var p = d.progress, fu = d.followups, rq = d.requests;
      el.innerHTML = '<div class="card"><h3>' + (p.workDay === false ? 'Day off, ' : 'Today, ') + P.fmtDate(P.today) + '</h3>' + overall(p) + '<div class="grid2">' + parts(p) + '</div>' +
        (p.invoices && p.invoices.error ? '<div class="banner">Invoice follow-ups could not be loaded from Zoho right now: ' + esc(p.invoices.error) + '</div>' : '') +
        '<div class="stamp">' + (d.lastActivity ? 'Your last update: ' + P.fmtTime(d.lastActivity) : 'You have not updated anything yet today.') + '</div></div>' +
        (fu.length ? '<div class="card"><div class="between"><h3>Follow-up calls due</h3><a class="btn sm" href="#tasks">Open and log them</a></div><div class="list">' + fu.map(function (f) {
          return '<div class="item ' + (f.daysLate > 0 ? 'hot' : 'warn') + '"><div class="between"><b>' + esc((f.details[0] || {}).value || 'Call') + '</b>' + P.pill(f.daysLate > 0 ? f.daysLate + ' day' + (f.daysLate === 1 ? '' : 's') + ' late' : 'Today', f.daysLate > 0 ? 'overdue' : 'due') + '</div><div class="meta">' + f.details.slice(1).map(function (x) { return '<span>' + esc(x.label) + ': <b>' + esc(x.value) + '</b></span>'; }).join('') + '</div></div>';
        }).join('') + '</div></div>' : '') +
        (rq.length ? '<div class="card"><div class="between"><h3>Customer requests not finished</h3><a class="btn sm" href="#requests">Open them</a></div><div class="list">' + rq.map(function (r) {
          return '<div class="item ' + (r.needsAttention ? 'hot' : '') + '"><div class="between"><b>' + esc(r.customerName) + '</b><span class="chips">' + P.pill(r.progress.done + ' of ' + r.progress.total + ' steps') + (r.needsAttention ? P.pill('Not touched for ' + r.daysSinceTouched + ' day' + (r.daysSinceTouched === 1 ? '' : 's'), 'overdue') : '') + '</span></div><div class="muted">Next: <b>' + esc(r.nextStep) + '</b>' + (r.nextDate ? ' &middot; follow up on ' + P.fmtDate(r.nextDate) : '') + '</div></div>';
        }).join('') + '</div></div>' : '') +
        '<div class="card"><h3>Your tasks</h3>' + (d.tasks.length ? '<div class="list">' + d.tasks.map(function (t) {
          return '<a class="item" href="#tasks" style="text-decoration:none;color:inherit"><div class="between"><b>' + esc(t.name) + '</b><span class="chips">' + (t.schedule === 'weekly' ? P.pill('This week') : '') + (t.carried ? P.pill('+' + t.carried + ' carried over', 'doing') : '') + '<span class="muted">' + t.done + ' of ' + t.total + '</span></span></div>' + P.bar(t.done, t.total) + (t.updatedAt ? '<div class="stamp">Updated ' + P.fmtTime(t.updatedAt) + '</div>' : '') + '</a>';
        }).join('') + '</div>' : '<div class="muted">No tasks assigned to you today.</div>') + '</div>' +
        (d.available.requests ? '<div class="card"><h3>Waiting for somebody to pick</h3><div class="actions"><a class="btn ghost sm" href="#requests">' + d.available.requests + ' new request' + (d.available.requests === 1 ? '' : 's') + ' from the website</a></div></div>' : '');
    }).then(function () { return P.newCustomersTile(el); });
  } });


  // the customer master list: how fresh it is, how many customers and leads, and a button to pull from Zoho now
  function drawMaster(el) {
    return P.api('GET', '/api/master/status').then(function (m) {
      var c = m.counts || {}, box = document.createElement('div'); box.className = 'card';
      function stat(n, label) { return '<div class="stat"><b>' + (n || 0) + '</b><span>' + label + '</span></div>'; }
      box.innerHTML = '<div class="between"><h3>Customer data (customers.json)</h3><button class="btn ghost sm" id="mdsync" type="button">Update now</button></div>' +
        '<div class="stats">' + stat(c.customers, 'customers from Zoho') + stat(c.leads, 'leads from the team') + stat(c.converted, 'leads converted') + stat(c.unmatchedLeads, 'leads without a mobile') + stat(c.call10, 'Call 10 rows') + stat(c.find4, 'Find 4 rows') + stat(c.requests, 'logged in requests') + '</div>' +
        '<div class="muted small">' + (m.lastFullAt ? 'Last full check from Zoho ' + P.fmtTime(m.lastFullAt) : 'Not read from Zoho yet') + (m.lastWebhookAt ? ' &middot; Zoho last said something changed ' + P.fmtTime(m.lastWebhookAt) : '') + '. ' +
        (m.webhookOn ? 'Zoho changes arrive within 30 seconds.' : 'Zoho changes are picked up every 5 minutes (the instant link is not switched on yet).') + '</div>' + (m.error ? '<div class="banner">' + P.esc(m.error) + '</div>' : '');
      el.appendChild(box);
      box.querySelector('#mdsync').addEventListener('click', function (e) { e.target.disabled = true; e.target.textContent = 'Updating...'; P.api('POST', '/api/master/sync', {}).then(function () { P.toast('Customer data updated'); window.dispatchEvent(new Event('hashchange')); }).catch(function (err) { e.target.disabled = false; e.target.textContent = 'Update now'; P.fail(err); }); });
    }).catch(function () {});
  }

  // the owner's charts: team performance, new customers against target, the request funnel and unpaid invoices by age
  function drawCharts(el) {
    return P.api('GET', '/api/dashboard-charts').then(function (d) {
      var C = P.charts, parts = [];
      var perf = d.performance, nc = d.newCustomers;
      if (perf.people.length) {
        parts.push(C.lines({ title: 'Team performance', sub: 'Share of the daily tasks that was done, last 14 days', labels: perf.days, series: perf.people.map(function (p) { return { name: p.name, values: p.values }; }) }));
        parts.push(C.groups({ title: 'New customers sold', sub: 'Per month, last 6 months' + (nc.zohoChecked ? '' : ' (Zoho not checked)'), labels: nc.months, series: nc.people.map(function (p) { return { name: p.name, values: p.values, target: p.target }; }) }));
      }
      var f = d.funnel, hr = function (h) { return h === null ? 'no data' : h < 24 ? h + ' h' : Math.round(h / 2.4) / 10 + ' days'; };
      parts.push(C.hbars({ title: 'Customer requests funnel', sub: 'How many requests reached each step, and the average wait for it', head: ['Step', 'Requests', 'Average time from the step before'],
        rows: f.map(function (r) { return { label: r.label, value: r.count, text: r.count + (r.avgHours === null ? '' : '  (' + hr(r.avgHours) + ')'), note: r.count + ' requests, average ' + hr(r.avgHours) + ' after the step before', cells: [r.label, String(r.count), hr(r.avgHours)] }; }) }));
      var iv = d.invoices, shades = ['#86b6ef', '#5b9be6', '#2a78d6', '#17488f'];
      if (iv.error) parts.push('<div class="card chartcard"><h3>Unpaid invoices</h3><div class="banner">Could not load from Zoho: ' + P.esc(iv.error) + '</div></div>');
      else parts.push(C.hbars({ title: 'Unpaid invoices by age', sub: P.money(iv.total) + ' unpaid across ' + iv.count + ' invoices', head: ['Age', 'Invoices', 'Amount'],
        rows: iv.buckets.map(function (b, i) { return { label: b.label, value: b.amount, color: shades[i], text: P.money(b.amount) + '  (' + b.count + ')', note: b.count + ' invoice' + (b.count === 1 ? '' : 's') + ', ' + P.money(b.amount), cells: [b.label, String(b.count), P.money(b.amount)] }; }) }));
      var box = document.createElement('div'); box.className = 'chartgrid'; box.innerHTML = parts.map(function (x) { return typeof x === 'string' ? x : x.html; }).join('');
      parts.forEach(function (x) { if (typeof x !== 'string') x.wire(box); });
      C.wireSwitch(box);
      var anchor = el.querySelector(':scope > .grid2') || el.querySelector('.card'); if (anchor) anchor.after(box); else el.appendChild(box);
    }).catch(function () {});
  }

  // ---------------- the owner's dashboard ----------------
  P.register({ id: 'dashboard', label: 'Dashboard', roles: ['admin'], order: 0, render: function (el) {
    return P.api('GET', '/api/dashboard').then(function (d) {
      var a = d.alerts;
      P.setBadge('office', a.pendingApprovals);
      function stat(n, label, to, hot) { return '<a class="stat link ' + (hot && n ? 'hot' : '') + '" href="#' + to + '" style="text-decoration:none"><b>' + n + '</b><span>' + esc(label) + '</span></a>'; }
      var z = d.zoho;
      el.innerHTML = '<div class="card"><div class="between"><h3>Needs your attention</h3><span class="muted">' + P.fmtDate(d.date) + (d.workDay ? '' : ' &middot; day off') + '</span></div><div class="stats">' +
        stat(a.unassignedRequests, 'new requests, nobody picked', 'requests', true) + stat(a.openRequests, 'customer requests not finished', 'requests', false) +
        stat(a.unassignedCustomers + ' / ' + a.totalCustomers, 'customers without an owner', 'customers', a.unassignedCustomers > 0) + stat(a.unassignedInvoices, 'unpaid invoices without an owner', 'invoices', true) +
        stat(a.invoicesToChase, 'invoices not being followed up', 'invoices', true) + stat(a.invoiceCompliance + '%', 'invoice follow-up on track', 'invoices', a.invoiceCompliance < 100) + stat(a.pendingApprovals, 'transactions to approve', 'office', true) + '</div>' +
        (a.notStarted.length && d.workDay ? '<div class="banner">Not started yet today: <b>' + a.notStarted.map(esc).join(', ') + '</b></div>' : '') + '</div>' +
        '<div class="grid2">' + (d.team.map(function (t) {
          var p = t.progress;
          return '<div class="card"><div class="between"><h3>' + esc(t.name) + '</h3><span class="stamp">' + (t.lastActivity ? 'Last update ' + P.fmtTime(t.lastActivity) : (d.workDay ? '<span class="err">Not started today</span>' : 'No updates')) + '</span></div>' + overall(p) + parts(p) +
            '<div class="chips">' + (t.carried ? '<span class="chip">+' + t.carried + ' carried over from earlier</span>' : '') + (t.followupsOverdue ? '<span class="chip" style="background:#fee2e2;color:#b91c1c">' + t.followupsOverdue + ' call follow-up' + (t.followupsOverdue === 1 ? '' : 's') + ' late</span>' : '') +
            '<span class="chip">' + t.openRequests + ' open request' + (t.openRequests === 1 ? '' : 's') + (t.untouchedRequests ? ', ' + t.untouchedRequests + ' not touched today' : '') + '</span>' + (t.pendingTransactions ? '<span class="chip">' + t.pendingTransactions + ' to approve</span>' : '') + '</div>' +
            '<div class="actions"><button class="btn ghost sm" data-work="' + esc(t.id) + '" type="button">See their work</button></div></div>';
        }).join('') || P.empty('No team members yet. Add them in the Team tab.')) + '</div>' +
        '<div class="card"><div class="between"><h3>Zoho connection</h3><button class="btn ghost sm" id="zr" type="button">Refresh from Zoho</button></div>' +
        (!z.configured ? '<div class="banner">Zoho is not connected to this panel yet. Customers, invoices and website orders will appear once it is.</div>' :
          '<div class="stats">' + [['Customers', z.customers], ['Invoices', z.invoices]].map(function (r) { return '<div class="stat"><b>' + (r[1].count || 0) + '</b><span>' + r[0] + (r[1].at ? ' &middot; pulled ' + P.fmtTime(new Date(r[1].at).toISOString()) : '') + '</span>' + (r[1].error ? '<span class="err">' + esc(r[1].error) + '</span>' : '') + '</div>'; }).join('') + '</div>' +
          (z.customers.source === 'invoices' ? '<div class="banner info">Customers are being built from invoices because the saved Zoho login cannot read the contact list.</div>' : '')) +
        '<div class="muted small">Data is pulled from Zoho Books when you open a screen (kept for 5 minutes) and nothing is copied or changed in Zoho.</div></div>';
      el.addEventListener('click', function (e) {
        var w = e.target.closest('[data-work]'); if (w) P.go('work', { viewAs: w.dataset.work });
        if (e.target.id === 'zr') { e.target.disabled = true; e.target.textContent = 'Refreshing...'; P.api('POST', '/api/zoho/refresh', {}).then(function () { P.toast('Refreshed from Zoho'); window.dispatchEvent(new Event('hashchange')); }).catch(P.fail); }
      });
    }).then(function () { return drawCharts(el); }).then(function () { return P.newCustomersTile(el); }).then(function () { return drawMaster(el); });
  } });
})();
