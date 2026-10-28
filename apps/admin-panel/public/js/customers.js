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
      if (e.target.id === 'cw') { who = e.target.value; load().catch(P.fail); return; }
      var o = e.target.closest('[data-onb]'); if (!o) return;
      P.api('PATCH', '/api/customers/' + o.closest('[data-id]').dataset.id, { onboarded: o.value === 'yes' ? true : o.value === 'no' ? false : null }).then(function () { P.toast('Saved'); return load(); }).catch(P.fail);
    });
    P.wireRecords(el, { base: '/api/customers', outcomes: function () { return outcomes; }, reload: load });
    return load();
  } });
})();
