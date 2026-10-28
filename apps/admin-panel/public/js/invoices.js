(function () {
  'use strict';
  var P = window.Panel, esc = P.esc;

  P.register({ id: 'invoices', label: 'Invoices', roles: ['admin', 'employee'], order: 6, render: function (el) {
    var isAdmin = P.me.role === 'admin', filter = isAdmin ? 'needs' : 'mine', who = '', q = '', outcomes = [], timer;

    function item(i) {
      var mine = i.ownerId === P.me.id, tone = i.followStatus === 'overdue' && i.needs ? 'hot' : i.followStatus === 'due' ? 'warn' : i.needs && i.compliant ? 'good' : '';
      var due = i.daysOverdue > 0 ? '<span class="err">' + i.daysOverdue + ' day' + (i.daysOverdue === 1 ? '' : 's') + ' overdue (due ' + P.fmtDate(i.dueDate) + ')</span>' : i.dueDate ? '<span>Due ' + P.fmtDate(i.dueDate) + (i.daysToDue !== null && i.daysToDue <= 7 ? ' (in ' + i.daysToDue + ' day' + (i.daysToDue === 1 ? '' : 's') + ')' : '') + '</span>' : '';
      return '<div class="item ' + tone + '" data-id="' + esc(i.id) + '"><div class="head"><b>' + esc(i.number) + ' &middot; ' + esc(i.customerName) + '</b><span class="chips"><b>' + P.money(i.balance) + '</b>' + (i.needs || i.nextDate ? P.followBadge(i.followStatus, i.nextDate) : P.pill('Not due yet', 'none')) + '</span></div>' +
        '<div class="meta">' + due + (i.phone ? '<span>&#9742; <b>' + esc(i.phone) + '</b></span>' : '') + '<span>Invoice of ' + P.money(i.total) + ' dated ' + P.fmtDate(i.date) + '</span><span>Owner: <b>' + (i.ownerId ? esc(i.ownerName) : 'nobody yet') + '</b></span></div>' +
        (i.lastAt ? '<div class="stamp">Last follow-up: <b>' + esc(i.lastOutcome) + '</b> &middot; ' + P.stamp(i.lastAt, i.lastByName) + (i.lastNote ? ' &middot; ' + esc(i.lastNote) : '') + '</div>' : (i.needs ? '<div class="stamp err">Nobody has followed this up yet</div>' : '')) +
        '<div class="actions">' + (!i.ownerId && !isAdmin ? '<button class="btn sm" data-act="pick" type="button">I will chase this</button>' : '') + (isAdmin ? '<select data-assign style="width:auto"><option value="">Nobody</option>' + P.userOptions(i.ownerExplicit ? i.ownerId : '') + '</select>' + (!i.ownerExplicit && i.ownerId ? '<span class="stamp">(customer\'s owner)</span>' : '') : '') +
        (mine ? '<button class="btn sm" data-act="follow" type="button">Log a follow-up</button>' : '') + '<button class="btn ghost sm" data-act="history" type="button">History</button></div><div data-slot></div></div>';
    }

    function load(refresh) {
      var url = '/api/invoices?filter=' + filter + (who ? '&userId=' + who : '') + (q ? '&q=' + encodeURIComponent(q) : '') + (refresh ? '&refresh=1' : '');
      return P.api('GET', url).then(function (r) {
        outcomes = r.outcomes; var s = r.summary || {};
        var seg = isAdmin ? [['needs', 'Not followed up properly'], ['overdue', 'Overdue'], ['unassigned', 'No owner'], ['all', 'All unpaid']] : [['mine', 'My invoices'], ['unassigned', 'Waiting for an owner'], ['all', 'All I can see']];
        var focus = document.activeElement && document.activeElement.id === 'iq';
        el.innerHTML = (s.unpaid !== undefined ? '<div class="card"><div class="stats"><div class="stat"><b>' + s.unpaid + '</b><span>unpaid invoices</span></div><div class="stat"><b>' + P.money(s.outstanding) + '</b><span>to collect</span></div><div class="stat ' + (s.overdue ? 'hot' : '') + '"><b>' + s.overdue + '</b><span>overdue</span></div><div class="stat ' + (s.percent < 100 ? 'hot' : '') + '"><b>' + s.percent + '%</b><span>follow-up on track (' + s.compliant + ' of ' + s.needing + ')</span></div></div>' +
          '<div class="muted small">An invoice needs follow-up when it is overdue or due within a few days. "On track" means somebody followed it up and a next follow-up date is set, or it was followed up today.</div></div>' : '') +
          '<div class="card"><div class="between"><div class="seg">' + seg.map(function (x) { return '<button class="btn ' + (filter === x[0] ? '' : 'ghost') + '" data-f="' + x[0] + '" type="button">' + x[1] + '</button>'; }).join('') + '</div><button class="btn ghost sm" id="rf" type="button">Refresh from Zoho</button></div>' +
          '<div class="row">' + (isAdmin ? '<label>Owner<select id="iw"><option value="">Everyone</option>' + P.userOptions(who) + '</select></label>' : '') + '<label style="flex:3 1 240px">Search<input id="iq" value="' + esc(q) + '" placeholder="Invoice number, customer or phone"></label></div></div>' +
          (r.error ? '<div class="banner">Zoho did not answer: ' + esc(r.error) + '. Try "Refresh from Zoho" in a minute.</div>' : '') +
          (r.invoices.length ? '<div class="list">' + r.invoices.map(item).join('') + '</div>' : P.empty(r.error ? 'Invoices could not be loaded.' : filter === 'needs' ? 'Every invoice that needs a follow-up has one. Well done.' : 'No invoices here.'));
        if (focus) { var i = el.querySelector('#iq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
      });
    }
    el.addEventListener('click', function (e) {
      var f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; load().catch(P.fail); return; }
      if (e.target.id === 'rf') { e.target.disabled = true; e.target.textContent = 'Asking Zoho...'; load(true).then(function () { P.toast('Invoices refreshed from Zoho'); }).catch(P.fail); }
    });
    el.addEventListener('input', function (e) { if (e.target.id !== 'iq') return; q = e.target.value; clearTimeout(timer); timer = setTimeout(function () { load().catch(P.fail); }, 350); });
    el.addEventListener('change', function (e) { if (e.target.id === 'iw') { who = e.target.value; load().catch(P.fail); } });
    P.wireRecords(el, { base: '/api/invoices', outcomes: function () { return outcomes; }, reload: load });
    return load();
  } });
})();
