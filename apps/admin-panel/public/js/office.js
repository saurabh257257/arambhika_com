(function () {
  'use strict';
  var P = window.Panel, esc = P.esc;
  var TYPES = { expense: 'Expense', income: 'Money received', purchase: 'Purchase', other: 'Other' };

  P.register({ id: 'office', label: 'Office', roles: ['admin', 'employee'], order: 7, render: function (el) {
    var isAdmin = P.me.role === 'admin', editing = '', filter = isAdmin ? 'pending' : '';

    function load() {
      return P.api('GET', '/api/transactions' + (filter ? '?status=' + filter : '')).then(function (r) {
        var t0 = r.transactions;
        if (isAdmin) {
          el.innerHTML = '<div class="card"><h3>Transactions for approval</h3><div class="seg">' + [['pending', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['', 'All']].map(function (f) { return '<button class="btn ' + (filter === f[0] ? '' : 'ghost') + '" data-f="' + f[0] + '" type="button">' + f[1] + '</button>'; }).join('') + '</div></div>' +
            (t0.length ? t0.map(function (t) {
              return '<div class="card tight"><div class="between"><div><b>' + P.money(t.amount) + '</b> <span class="muted">' + esc(TYPES[t.type] || t.type) + ' &middot; ' + esc(t.party) + '</span></div>' + P.pill(t.status, t.status) + '</div><div class="muted">' + esc(t.userName) + ' &middot; ' + P.fmtDate(t.date) + (t.description ? ' &middot; ' + esc(t.description) : '') + '</div>' +
                (t.status === 'pending' ? '<div class="row" data-id="' + t.id + '"><label style="flex:3 1 220px">Remark (optional)<input data-remark maxlength="500"></label><button class="btn fit" data-decide="approved" type="button">Approve</button><button class="btn bad fit" data-decide="rejected" type="button">Reject</button></div>' : (t.remark ? '<div><b>Remark:</b> ' + esc(t.remark) + ' <span class="stamp">' + P.fmtTime(t.decidedAt) + '</span></div>' : '')) + '</div>';
            }).join('') : P.empty('Nothing here.'));
          P.api('GET', '/api/transactions?status=pending').then(function (p) { P.setBadge('office', p.transactions.length); });
        } else {
          el.innerHTML = '<div class="card"><h3>Send a transaction for approval</h3><form id="txForm" class="row"><label>Date<input type="date" name="date" value="' + P.today + '" max="' + P.today + '" required></label><label>Type<select name="type">' + Object.keys(TYPES).map(function (k) { return '<option value="' + k + '">' + TYPES[k] + '</option>'; }).join('') + '</select></label><label>Amount (₹)<input name="amount" type="number" step="0.01" min="0.01" required></label><label>Paid to / received from<input name="party" maxlength="100" required></label><label style="flex:3 1 260px">What was it for<input name="description" maxlength="1000"></label><button class="btn fit" type="submit">Send for approval</button><button class="btn ghost fit" type="button" id="txCancel" hidden>Cancel edit</button></form></div>' +
            '<div class="card"><h3>Your transactions</h3><div class="list">' + (t0.map(function (t) {
              return '<div class="item"><div class="head"><b>' + P.money(t.amount) + ' <span class="muted">' + esc(TYPES[t.type] || t.type) + '</span></b>' + P.pill(t.status, t.status) + '</div><div>' + esc(t.party) + ' <span class="muted">' + P.fmtDate(t.date) + '</span></div>' + (t.description ? '<div class="muted">' + esc(t.description) + '</div>' : '') + (t.remark ? '<div><b>Admin:</b> ' + esc(t.remark) + '</div>' : '') +
                (t.status === 'pending' ? '<div class="actions"><button class="btn ghost sm" data-edit=\'' + esc(JSON.stringify(t)) + '\' type="button">Edit</button><button class="btn ghost sm" data-del="' + t.id + '" type="button">Remove</button></div>' : '') + '</div>';
            }).join('') || '<div class="muted">Nothing sent yet.</div>') + '</div></div>';
          el.querySelector('#txForm').addEventListener('submit', function (e) {
            e.preventDefault(); var f = e.target;
            var body = { date: f.date.value, type: f.type.value, amount: f.amount.value, party: f.party.value, description: f.description.value };
            P.api(editing ? 'PUT' : 'POST', '/api/transactions' + (editing ? '/' + editing : ''), body).then(function () { P.toast(editing ? 'Updated' : 'Sent for approval'); editing = ''; return load(); }).catch(P.fail);
          });
        }
      });
    }
    el.addEventListener('click', function (e) {
      var f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; load().catch(P.fail); return; }
      var d = e.target.closest('[data-decide]');
      if (d) { var row = d.closest('[data-id]'); P.api('POST', '/api/transactions/' + row.dataset.id + '/decision', { status: d.dataset.decide, remark: row.querySelector('[data-remark]').value }).then(function () { P.toast(d.dataset.decide === 'approved' ? 'Approved' : 'Rejected'); return load(); }).catch(P.fail); return; }
      var ed = e.target.closest('[data-edit]');
      if (ed) { var t = JSON.parse(ed.dataset.edit), form = el.querySelector('#txForm'); editing = t.id; form.date.value = t.date; form.type.value = t.type; form.amount.value = t.amount; form.party.value = t.party; form.description.value = t.description; el.querySelector('#txCancel').hidden = false; window.scrollTo(0, 0); return; }
      if (e.target.id === 'txCancel') { editing = ''; load().catch(P.fail); return; }
      var dl = e.target.closest('[data-del]'); if (dl) P.api('DELETE', '/api/transactions/' + dl.dataset.del).then(function () { P.toast('Removed'); return load(); }).catch(P.fail);
    });
    return load();
  } });
})();
