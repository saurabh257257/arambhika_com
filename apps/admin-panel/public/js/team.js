(function () {
  'use strict';
  var P = window.Panel, esc = P.esc;

  // ---------------- team members and passwords ----------------
  P.register({ id: 'team', label: 'Team', roles: ['admin'], order: 8, render: function (el) {
    function load() {
      return P.api('GET', '/api/users').then(function (r) {
        P.users = r.users;
        el.innerHTML = '<div class="card"><h3>Add a team member</h3><form id="newUser" class="row"><label>Name<input name="name" required maxlength="60"></label><label>Username (to sign in)<input name="username" required maxlength="30" autocapitalize="none"></label><label>Password (8+ characters)<input name="password" type="text" minlength="8" required autocomplete="off"></label><button class="btn fit" type="submit">Add</button></form>' +
          '<div class="muted small">Tell them the username and the password you set. They sign in at this address and see only their own work.</div></div>' +
          '<div class="card"><h3>Your team</h3><div class="list">' + (r.users.map(function (u) {
            return '<div class="item"><div class="head"><b>' + esc(u.name) + ' <span class="muted">@' + esc(u.username) + '</span></b>' + P.pill(u.active ? 'Active' : 'Switched off', u.active ? 'ok' : 'none') + '</div><div class="actions"><button class="btn ghost sm" data-toggle="' + u.id + '" data-active="' + (u.active ? 1 : 0) + '" type="button">' + (u.active ? 'Switch off' : 'Switch on') + '</button><button class="btn ghost sm" data-reset="' + u.id + '" type="button">Set a new password</button><button class="btn ghost sm" data-rename="' + u.id + '" data-name="' + esc(u.name) + '" type="button">Rename</button></div></div>';
          }).join('') || '<div class="muted">No team members yet.</div>') + '</div></div>';
        el.querySelector('#newUser').addEventListener('submit', function (e) {
          e.preventDefault(); var f = e.target;
          P.api('POST', '/api/users', { name: f.name.value, username: f.username.value, password: f.password.value }).then(function () { P.toast('Team member added'); return load(); }).catch(P.fail);
        });
      });
    }
    el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-toggle]');
      if (t) { P.api('PATCH', '/api/users/' + t.dataset.toggle, { active: t.dataset.active !== '1' }).then(function () { return load(); }).catch(P.fail); return; }
      var r = e.target.closest('[data-reset]');
      if (r) { var pw = window.prompt('New password (at least 8 characters)'); if (pw) P.api('PATCH', '/api/users/' + r.dataset.reset, { password: pw }).then(function () { P.toast('Password changed'); }).catch(P.fail); return; }
      var n = e.target.closest('[data-rename]');
      if (n) { var nm = window.prompt('Name', n.dataset.name); if (nm) P.api('PATCH', '/api/users/' + n.dataset.rename, { name: nm }).then(function () { return load(); }).catch(P.fail); }
    });
    return load();
  } });

  // ---------------- follow-up rules: what happened -> when to follow up next ----------------
  var KIND = { lead: 'New leads', customer: 'Existing customers', invoice: 'Unpaid invoices' };
  P.register({ id: 'rules', label: 'Follow-up rules', roles: ['admin'], order: 9, render: function (el) {
    return P.api('GET', '/api/settings').then(function (s) {
      el.innerHTML = '<div class="card"><h3>When should the next follow-up be?</h3><div class="muted">After every follow-up the team member says what happened, and the next date is filled in from this table. They can still change the date. Leave the days empty when nothing more is needed.</div>' +
        Object.keys(KIND).map(function (k) {
          return '<h4 style="margin-top:8px">' + KIND[k] + '</h4><div class="list">' + s.cadence[k].map(function (r) {
            return '<div class="row" data-kind="' + k + '" data-key="' + esc(r.key) + '"><div style="flex:3 1 240px">' + esc(r.label) + '</div>' + (r.askDate ? '<div class="muted">They pick the date</div>' : '<label>Follow up again after (days)<input type="number" min="1" max="365" name="days" value="' + (r.days === null ? '' : r.days) + '" placeholder="no more"></label>') + '</div>';
          }).join('') + '</div>';
        }).join('') +
        '<h4 style="margin-top:8px">Invoices</h4><div class="row"><label>Start following up an invoice this many days before the due date<input type="number" id="lead" min="0" max="30" value="' + s.invoiceLeadDays + '"></label></div>' +
        '<div class="actions"><button class="btn" id="saveRules" type="button">Save rules</button></div></div>';
      el.querySelector('#saveRules').addEventListener('click', function () {
        var cadence = {};
        [].forEach.call(el.querySelectorAll('[data-kind]'), function (r) {
          var k = r.dataset.kind; cadence[k] = cadence[k] || []; var d = r.querySelector('[name=days]');
          cadence[k].push({ key: r.dataset.key, days: d ? (d.value === '' ? null : Number(d.value)) : null });
        });
        P.api('PUT', '/api/settings', { cadence: cadence, invoiceLeadDays: el.querySelector('#lead').value }).then(function () { P.toast('Rules saved'); }).catch(P.fail);
      });
    });
  } });

  // ---------------- who did what, and when ----------------
  P.register({ id: 'activity', label: 'Activity', roles: ['admin'], order: 10, render: function (el) {
    var who = '';
    function load() {
      return P.api('GET', '/api/activity?limit=150' + (who ? '&userId=' + who : '')).then(function (r) {
        el.innerHTML = '<div class="card"><div class="row"><label>Team member<select id="aw"><option value="">Everyone</option>' + P.userOptions(who) + '</select></label></div><h3>Latest updates</h3><div class="list">' +
          (r.activity.map(function (a) { return '<div class="item" style="padding:8px 12px"><div class="between"><span><b>' + esc(a.userName) + '</b> ' + esc(a.text) + '</span><span class="stamp">' + P.fmtTime(a.at) + '</span></div></div>'; }).join('') || '<div class="muted">Nothing yet.</div>') + '</div></div>';
        el.querySelector('#aw').addEventListener('change', function (e) { who = e.target.value; load().catch(P.fail); });
      });
    }
    return load();
  } });
})();
