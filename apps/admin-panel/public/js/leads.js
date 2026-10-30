(function () {
  'use strict';
  var P = window.Panel, esc = P.esc;
  var TYPE = { call10: 'Call 10 people', find4: 'Find 4 customers', request: 'Customer request' };

  // the leads found by the team (from customers.json): who, what they said, which category, when to follow up, and where they came from
  P.register({ id: 'leads', label: 'Leads', roles: ['admin', 'employee'], order: 10.5, render: function (el) {
    var q = '', timer, isAdmin = P.me.role === 'admin', show = 'lead';

    function item(c) {
      var l = c.lead || { sources: [] };
      var tone = c.stage === 'customer' ? 'good' : '';
      return '<div class="item ' + tone + '"><div class="head"><b>' + esc(c.name) + '</b><span class="chips">' + P.pill(c.stage === 'customer' ? (l.converted ? 'Converted to customer' : l.linkedOnly ? 'Already a customer' : 'Customer') : 'Lead', c.stage === 'customer' ? 'ok' : 'due') +
        (c.unmatched ? P.pill('No mobile number', 'overdue') : '') + '</span></div>' +
        '<div class="meta">' + (c.phone ? '<span>&#9742; <b>' + esc(c.phone) + '</b></span>' : '') + (c.company ? '<span>' + esc(c.company) + '</span>' : '') +
        '<span>Found by <b>' + esc(l.ownerName || '') + '</b> on ' + P.fmtDate(l.firstContactOn) + '</span>' + (l.categories && l.categories.length ? '<span>Category: <b>' + l.categories.map(esc).join(', ') + '</b></span>' : '') +
        (l.nextFollowUp ? '<span>Follow up on <b>' + P.fmtDate(l.nextFollowUp) + '</b></span>' : '') + (l.convertedOn ? '<span>Paid on <b>' + P.fmtDate(l.convertedOn) + '</b></span>' : '') + '</div>' +
        '<div class="hist">' + l.sources.map(function (s) { return '<div><b>' + esc(TYPE[s.type] || s.type) + '</b> &middot; ' + esc(s.userName) + ' &middot; ' + P.fmtDate(s.date) + (s.category ? ' &middot; ' + esc(s.category) : '') + (s.note ? '<div class="muted">' + esc(s.note) + '</div>' : '') + '</div>'; }).join('') + '</div></div>';
    }

    function load() {
      return P.api('GET', '/api/master/customers?leads=1&q=' + encodeURIComponent(q)).then(function (r) {
        var list = r.customers.filter(function (c) { return c.lead; });
        var leads = list.filter(function (c) { return c.stage === 'lead'; }), done = list.filter(function (c) { return c.stage === 'customer'; });
        var shown = show === 'lead' ? leads : show === 'customer' ? done : list;
        var focus = document.activeElement && document.activeElement.id === 'lq';
        el.innerHTML = '<div class="card"><div class="between"><div class="seg">' + [['lead', 'Leads (' + leads.length + ')'], ['customer', 'Became customers (' + done.length + ')'], ['all', 'All (' + list.length + ')']].map(function (s) { return '<button class="btn ' + (show === s[0] ? '' : 'ghost') + '" data-s="' + s[0] + '" type="button">' + s[1] + '</button>'; }).join('') + '</div>' +
          (isAdmin ? '<div class="actions"><a class="btn ghost sm" href="/api/master/file/customers" download>customers.json</a><a class="btn ghost sm" href="/api/master/file/call10" download>call10.json</a><a class="btn ghost sm" href="/api/master/file/find4" download>find4.json</a><a class="btn ghost sm" href="/api/master/file/newrequests" download>newrequests.json</a></div>' : '') + '</div>' +
          '<div class="muted small">People the team logged in Call 10 people, Find 4 customers and Customer requests, matched by mobile number. A lead becomes a customer when Zoho shows a paid invoice for the same number. The list refreshes a second after the team saves, and from Zoho every 30 minutes.</div>' +
          '<label>Search<input id="lq" value="' + esc(q) + '" placeholder="Name, phone or company"></label></div>' +
          (shown.length ? '<div class="list">' + shown.map(item).join('') + '</div>' : P.empty('Nothing here yet.'));
        if (focus) { var i = el.querySelector('#lq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
      });
    }
    el.addEventListener('click', function (e) { var b = e.target.closest('[data-s]'); if (b) { show = b.dataset.s; load().catch(P.fail); } });
    el.addEventListener('input', function (e) { if (e.target.id !== 'lq') return; q = e.target.value; clearTimeout(timer); timer = setTimeout(function () { load().catch(P.fail); }, 350); });
    return load();
  } });
})();
