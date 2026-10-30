(function () {
  'use strict';
  var P = window.Panel, esc = P.esc;

  function count(p) {
    var t = p.target;
    var cls = t === null ? '' : p.month >= t ? 'ok' : 'pcr';
    return '<b class="' + cls + '">' + p.month + (t === null ? '' : ' of ' + t) + '</b>';
  }

  // a small card for the Dashboard and My day: this month's count per person, with the target button for the owner
  P.newCustomersTile = function (el) {
    return P.api('GET', '/api/new-customers').then(function (d) {
      if (!d.people.length) return;
      var c = document.createElement('div'); c.className = 'card';
      c.innerHTML = '<h3>New customers sold this month</h3>' +
        d.people.map(function (p) { return '<div class="part"><div class="between"><span>' + esc(p.name) + '</span><span>' + count(p) + ' <span class="muted small">&middot; ' + p.week + ' this week</span>' + (P.me.role === 'admin' ? ' <button class="btn ghost sm" type="button" data-target="' + esc(p.id) + '" data-name="' + esc(p.name) + '" data-val="' + (p.target === null ? '' : p.target) + '">' + (p.target === null ? 'Set target' : 'Target') + '</button>' : '') + '</span></div></div>'; }).join('');
      c.addEventListener('click', function (e) {
        var t = e.target.closest('[data-target]'); if (!t) return;
        var v = window.prompt('Monthly target of new customers for ' + t.dataset.name + ' (leave empty for none)', t.dataset.val); if (v === null) return;
        P.api('PATCH', '/api/users/' + t.dataset.target, { newCustomerTarget: v.trim() }).then(function () { P.toast('Target saved'); window.dispatchEvent(new Event('hashchange')); }).catch(P.fail);
      });
      el.appendChild(c);
    }).catch(function () {});
  };
})();
