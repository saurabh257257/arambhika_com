(function () {
  'use strict';
  var P = window.Panel, esc = P.esc;

  P.register({ id: 'leads', label: 'Leads', roles: ['admin', 'employee'], order: 3, render: function (el) {
    var isAdmin = P.me.role === 'admin', filter = isAdmin ? 'all' : 'mine', who = '', outcomes = [];

    function item(l) {
      var mine = l.ownerId === P.me.id, tone = l.followStatus === 'overdue' || l.followStatus === 'new' ? 'hot' : l.followStatus === 'due' ? 'warn' : '';
      return '<div class="item ' + tone + '" data-id="' + l.id + '"><div class="head"><b>' + esc(l.name) + (l.company ? ' <span class="muted">' + esc(l.company) + '</span>' : '') + '</b><span class="chips">' + P.pill(l.status, l.status) + P.followBadge(l.followStatus, l.nextDate) + '</span></div>' +
        '<div class="meta">' + (l.phone ? '<span>&#9742; <b>' + esc(l.phone) + '</b></span>' : '') + (l.email ? '<span>' + esc(l.email) + '</span>' : '') + (l.source ? '<span>Source: ' + esc(l.source) + '</span>' : '') +
        '<span>Owner: <b>' + (l.ownerId ? esc(l.ownerName) : 'nobody yet') + '</b></span></div>' +
        (l.need ? '<div>' + esc(l.need) + '</div>' : '') +
        (l.lastAt ? '<div class="stamp">Last follow-up: <b>' + esc(l.lastOutcome) + '</b> &middot; ' + P.stamp(l.lastAt, l.lastByName) + (l.lastNote ? ' &middot; ' + esc(l.lastNote) : '') + '</div>' : '<div class="stamp">Added ' + P.stamp(l.createdAt, l.createdByName) + '</div>') +
        '<div class="actions">' +
        (!l.ownerId && !isAdmin ? '<button class="btn sm" data-act="pick" type="button">I will take this lead</button>' : '') +
        (isAdmin ? '<select data-assign style="width:auto"><option value="">Nobody</option>' + P.userOptions(l.ownerId) + '</select>' : '') +
        (mine && l.status !== 'won' && l.status !== 'lost' ? '<button class="btn sm" data-act="follow" type="button">Log a follow-up</button>' : '') +
        '<button class="btn ghost sm" data-act="history" type="button">History</button>' +
        ((mine || isAdmin) && l.ownerId && l.status !== 'won' ? '<button class="btn ghost sm" data-order type="button">Create an order</button>' : '') + '</div><div data-slot></div></div>';
    }

    function load() {
      var q = '/api/leads?filter=' + filter + (who ? '&userId=' + who : '');
      return P.api('GET', q).then(function (r) {
        outcomes = r.outcomes;
        var seg = isAdmin ? [['all', 'All'], ['unassigned', 'Waiting to be picked']] : [['mine', 'My leads'], ['unassigned', 'Waiting to be picked'], ['all', 'Everything I can see']];
        el.innerHTML = '<div class="card"><div class="between"><div class="seg">' + seg.map(function (s) { return '<button class="btn ' + (filter === s[0] ? '' : 'ghost') + '" data-f="' + s[0] + '" type="button">' + s[1] + '</button>'; }).join('') + '</div>' + (isAdmin ? '<select id="lw" style="width:auto"><option value="">All owners</option>' + P.userOptions(who) + '</select>' : '') + '<button class="btn" id="addLead" type="button">+ Add a lead</button></div>' +
          '<form id="leadForm" class="list" hidden><div class="row"><label>Name or company<input name="name" required maxlength="80"></label><label>Phone<input name="phone" type="tel" maxlength="20"></label><label>Source<input name="source" maxlength="40" placeholder="WhatsApp, call, website..."></label></div><div class="row"><label style="flex:3 1 240px">What do they need?<input name="need" maxlength="500"></label>' + (isAdmin ? '<label>Give it to<select name="ownerId"><option value="">Nobody (let the team pick)</option>' + P.userOptions('') + '</select></label>' : '') + '<button class="btn fit" type="submit">Save lead</button></div></form></div>' +
          (r.leads.length ? '<div class="list">' + r.leads.map(item).join('') + '</div>' : P.empty(filter === 'unassigned' ? 'No leads are waiting. When a new enquiry comes in, add it here and somebody will pick it.' : 'No leads here yet.'));
        el.querySelector('#addLead').addEventListener('click', function () { var f = el.querySelector('#leadForm'); f.hidden = !f.hidden; });
        el.querySelector('#leadForm').addEventListener('submit', function (e) {
          e.preventDefault(); var f = e.target;
          P.api('POST', '/api/leads', { name: f.name.value, phone: f.phone.value, source: f.source.value, need: f.need.value, ownerId: f.ownerId ? f.ownerId.value : undefined }).then(function () { P.toast('Lead added'); return load(); }).catch(P.fail);
        });
        var lw = el.querySelector('#lw'); if (lw) lw.addEventListener('change', function () { who = lw.value; load().catch(P.fail); });
      });
    }
    el.addEventListener('click', function (e) {
      var f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; load().catch(P.fail); return; }
      var o = e.target.closest('[data-order]');
      if (o) {
        var amount = window.prompt('Order amount in rupees (you can leave it empty)', ''); if (amount === null) return;
        P.api('POST', '/api/leads/' + o.closest('[data-id]').dataset.id + '/order', { amount: amount }).then(function () { P.toast('Order created. Follow it in the Orders tab.'); return load(); }).catch(P.fail);
      }
    });
    P.wireRecords(el, { base: '/api/leads', outcomes: function () { return outcomes; }, reload: load });
    return load();
  } });
})();
