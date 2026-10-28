(function () {
  'use strict';
  var P = window.Panel, esc = P.esc;

  P.register({ id: 'orders', label: 'Orders', roles: ['admin', 'employee'], order: 5, render: function (el) {
    var isAdmin = P.me.role === 'admin', filter = isAdmin ? 'active' : 'mine', who = '', stages = [];

    function item(o) {
      var mine = o.ownerId === P.me.id, can = mine || isAdmin, nextKey = (stages.filter(function (s) { return !o.stages[s.key]; })[0] || {}).key;
      return '<div class="item ' + (o.ownerId ? '' : 'hot') + '" data-id="' + o.id + '"><div class="head"><b>' + esc(o.customerName) + (o.amount ? ' <span class="muted">' + P.money(o.amount) + '</span>' : '') + '</b><span class="chips">' + P.pill(o.source === 'zoho' ? 'From the website' : o.source === 'lead' ? 'From a lead' : 'Added by hand') + (o.complete ? P.pill('Complete', 'ok') : P.pill(o.progress.percent + '% done')) + '</span></div>' +
        '<div class="meta">' + (o.phone ? '<span>&#9742; <b>' + esc(o.phone) + '</b></span>' : '') + (o.zohoSoNumber ? '<span>Zoho ' + esc(o.zohoSoNumber) + '</span>' : '') + '<span>Owner: <b>' + (o.ownerId ? esc(o.ownerName) : 'nobody yet') + '</b></span>' + (o.complete ? '' : '<span>Next: <b>' + esc(o.nextStage) + '</b></span>') + '</div>' +
        P.bar(o.progress.done, o.progress.total) +
        '<div class="stages">' + stages.map(function (s) {
          var d = o.stages[s.key];
          return '<div class="stage ' + (d ? 'on' : s.key === nextKey ? 'next' : '') + (can ? ' click' : '') + '" ' + (can ? 'data-stage="' + s.key + '" data-on="' + (d ? 1 : 0) + '"' : '') + ' title="' + (d ? esc(s.label) + ': ' + P.fmtTime(d.at) + ' by ' + esc(d.by) : (can ? 'Tap when this is done' : '')) + '"><b>' + esc(s.label) + '</b>' + (d ? '<i>&#10003; ' + P.fmtTime(d.at) + '<br>' + esc(d.by) + '</i>' : '<i style="color:#94a3b8">' + (can ? 'tap when done' : 'pending') + '</i>') + '</div>';
        }).join('') + '</div>' +
        (o.note ? '<div class="muted">' + esc(o.note) + '</div>' : '') +
        '<div class="actions">' + (!o.ownerId && !isAdmin ? '<button class="btn sm" data-act="pick" type="button">I will handle this order</button>' : '') + (isAdmin ? '<select data-assign style="width:auto"><option value="">Nobody</option>' + P.userOptions(o.ownerId) + '</select>' : '') + (o.updatedAt ? '<span class="stamp">Updated ' + P.stamp(o.updatedAt, o.updatedByName) + '</span>' : '') + '</div></div>';
    }

    function load(refresh) {
      var url = '/api/orders?filter=' + (filter === 'active' ? 'active' : filter) + (who ? '&userId=' + who : '') + (refresh ? '&refresh=1' : '');
      return P.api('GET', url).then(function (r) {
        stages = r.stages;
        var seg = isAdmin ? [['active', 'Active'], ['unassigned', 'Waiting to be picked'], ['all', 'Including finished']] : [['mine', 'My orders'], ['unassigned', 'Waiting to be picked'], ['active', 'All active'], ['all', 'Including finished']];
        el.innerHTML = '<div class="card"><div class="between"><div class="seg">' + seg.map(function (s) { return '<button class="btn ' + (filter === s[0] ? '' : 'ghost') + '" data-f="' + s[0] + '" type="button">' + s[1] + '</button>'; }).join('') + '</div><div class="actions">' + (isAdmin ? '<select id="ow" style="width:auto"><option value="">All owners</option>' + P.userOptions(who) + '</select>' : '') + '<button class="btn ghost sm" id="rf" type="button">Check Zoho</button><button class="btn" id="addO" type="button">+ Add an order</button></div></div>' +
          '<form id="oForm" class="row" hidden><label>Customer<input name="customerName" required maxlength="100"></label><label>Phone<input name="phone" type="tel" maxlength="20"></label><label>Amount (₹)<input name="amount" type="number" min="0" step="0.01"></label><label style="flex:3 1 220px">Note<input name="note" maxlength="1000"></label>' + (isAdmin ? '<label>Give it to<select name="ownerId"><option value="">Nobody (let the team pick)</option>' + P.userOptions('') + '</select></label>' : '') + '<button class="btn fit" type="submit">Save order</button></form>' +
          '<div class="muted small">The six steps: lead received, quotation, invoice, payment, dispatch, delivery. New website orders appear here by themselves and their invoice, payment and shipping steps tick from Zoho. Tick the other steps yourself when they are done.</div></div>' +
          (r.zoho && !r.zoho.ok ? '<div class="banner">Zoho did not answer (' + esc(r.zoho.error) + '). Orders you already have are shown; new website orders will appear once Zoho is reachable.</div>' : '') +
          (r.orders.length ? '<div class="list">' + r.orders.map(item).join('') + '</div>' : P.empty('No orders here.'));
        el.querySelector('#addO').addEventListener('click', function () { var f = el.querySelector('#oForm'); f.hidden = !f.hidden; });
        el.querySelector('#oForm').addEventListener('submit', function (e) {
          e.preventDefault(); var f = e.target;
          P.api('POST', '/api/orders', { customerName: f.customerName.value, phone: f.phone.value, amount: f.amount.value, note: f.note.value, ownerId: f.ownerId ? f.ownerId.value : undefined }).then(function () { P.toast('Order added'); return load(); }).catch(P.fail);
        });
        var ow = el.querySelector('#ow'); if (ow) ow.addEventListener('change', function () { who = ow.value; load().catch(P.fail); });
      });
    }
    el.addEventListener('click', function (e) {
      var f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; load().catch(P.fail); return; }
      if (e.target.id === 'rf') { e.target.disabled = true; load(true).then(function () { P.toast('Checked Zoho'); }).catch(P.fail); return; }
      var s = e.target.closest('[data-stage]');
      if (s) {
        var on = s.dataset.on === '1';
        if (on && !window.confirm('Untick "' + s.querySelector('b').textContent + '"?')) return;
        P.api('PUT', '/api/orders/' + s.closest('[data-id]').dataset.id + '/stages/' + s.dataset.stage, { done: !on }).then(function () { P.toast(on ? 'Unticked' : 'Done, saved ' + P.fmtTime(new Date().toISOString())); return load(); }).catch(P.fail);
      }
    });
    P.wireRecords(el, { base: '/api/orders', outcomes: function () { return []; }, reload: load });
    return load();
  } });
})();
