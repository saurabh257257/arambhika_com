(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var me = null, today = '', windowDays = 30, tab = '', openDate = '', users = [];
  var view = $('view'), toastTimer;

  function toast(t) { var el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2400); }
  function api(method, url, body) {
    var o = { method: method, headers: {} };
    if (body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
    return fetch(url, o).then(function (r) {
      if (r.status === 401) { location.replace('/login.html'); throw new Error('Please sign in'); }
      return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong'); return j; });
    });
  }
  function fail(e) { toast(e.message); }
  function fmt(d) { if (!d) return ''; var p = String(d).slice(0, 10).split('-'); return p[2] + '-' + p[1] + '-' + p[0]; }
  function fmtTime(s) { return s ? new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''; }
  function money(n) { return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
  function addDays(d, n) { return new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10); }
  function pct(c, t) { return t > 0 ? Math.min(100, Math.round(c / t * 100)) : 100; }
  function bar(c, t) { return '<div class="bar ' + (t > 0 && c >= t ? 'done' : '') + '"><i style="width:' + pct(c, t) + '%"></i></div>'; }
  function userName(id) { var u = users.filter(function (x) { return x.id === id; })[0]; return u ? u.name : ''; }
  function empOptions(sel) { return users.filter(function (u) { return u.active; }).map(function (u) { return '<option value="' + esc(u.id) + '"' + (u.id === sel ? ' selected' : '') + '>' + esc(u.name) + '</option>'; }).join(''); }

  // ---------------- tabs ----------------
  var EMP_TABS = [['today', 'Today'], ['history', 'History'], ['tasks', 'My tasks'], ['office', 'Office']];
  var ADM_TABS = [['overview', 'Overview'], ['atasks', 'Tasks'], ['approvals', 'Approvals'], ['records', 'Records'], ['team', 'Team'], ['routine', 'Daily jobs']];
  var pendingCount = 0;
  function drawTabs() {
    var list = me.role === 'admin' ? ADM_TABS : EMP_TABS;
    $('tabs').innerHTML = list.map(function (t) { return '<button type="button" class="tab ' + (t[0] === tab ? 'on' : '') + '" data-t="' + t[0] + '">' + t[1] + (t[0] === 'approvals' && pendingCount ? '<span class="n">' + pendingCount + '</span>' : '') + '</button>'; }).join('');
  }
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (b) go(b.dataset.t); });
  function go(t, date) {
    tab = t; if (date) openDate = date; drawTabs(); view.innerHTML = '<p class="muted">Loading...</p>';
    ({ today: viewToday, history: viewHistory, tasks: viewMyTasks, office: viewOffice, overview: viewOverview, atasks: viewAdminTasks, approvals: viewApprovals, records: viewRecords, team: viewTeam, routine: viewRoutine })[t]().catch(fail);
    window.scrollTo(0, 0);
  }
  $('out').addEventListener('click', function () { fetch('/api/auth/logout', { method: 'POST' }).finally(function () { location.replace('/login.html'); }); });

  // ---------------- employee: today ----------------
  var OUTCOMES = ['Spoke', 'No answer', 'Interested', 'Call back later', 'Not interested', 'Wrong number'];
  function viewToday() {
    var date = openDate || today; openDate = '';
    return api('GET', '/api/daily?date=' + date).then(function (rec) { drawDay(rec, true); });
  }
  function drawDay(rec, editable) {
    var done = rec.items.filter(function (i) { return i.done; }).length;
    var html = '<div class="card"><div class="row"><label>Date<input type="date" id="dayDate" value="' + rec.date + '" max="' + today + '" min="' + addDays(today, -windowDays) + '"' + (editable ? '' : ' disabled') + '></label>' +
      '<div><h3>' + done + ' of ' + rec.items.length + ' jobs done</h3><div class="muted">' + (rec.date === today ? 'Today' : fmt(rec.date)) + '</div></div></div></div>';
    html += rec.items.map(function (it) {
      var body = '';
      if (it.type === 'calls') {
        body = rec.calls.map(function (c) { return '<div class="item"><div class="head"><b>' + esc(c.person) + (c.phone ? ' <span class="muted">' + esc(c.phone) + '</span>' : '') + '</b><span><span class="pill">' + esc(c.outcome) + '</span>' + (editable ? ' <button class="btn ghost sm" data-delcall="' + c.id + '" type="button">Remove</button>' : '') + '</span></div>' + (c.note ? '<div class="muted">' + esc(c.note) + '</div>' : '') + '</div>'; }).join('') || '<p class="muted">No calls recorded yet.</p>';
        if (editable) body += '<form class="row" id="callForm"><label>Name<input name="person" required maxlength="80"></label><label>Phone<input name="phone" inputmode="tel" maxlength="20"></label><label>Result<select name="outcome">' + OUTCOMES.map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select></label><label>Note<input name="note" maxlength="300"></label><button class="btn fit" type="submit">Add call</button></form>';
      } else if (editable) {
        body = '<form class="row" data-job="' + it.id + '"><label>How many ' + esc(it.unit) + '<input type="number" name="count" min="0" max="100000" value="' + it.count + '"></label><label style="flex:3 1 220px">Notes / link<input name="notes" maxlength="2000" value="' + esc(it.notes) + '" placeholder="What was done"></label><button class="btn fit" type="submit">Save</button></form>';
      } else {
        body = it.notes ? '<div class="muted">' + esc(it.notes) + '</div>' : '';
      }
      return '<div class="job"><h4><span>' + esc(it.name) + '</span><span class="pill ' + (it.done ? 'ok' : '') + '">' + it.count + ' / ' + it.target + ' ' + esc(it.unit) + '</span></h4>' + bar(it.count, it.target) + body + '</div>';
    }).join('');
    view.innerHTML = html;
    var dd = $('dayDate'); if (dd && editable) dd.addEventListener('change', function () { if (dd.value) { api('GET', '/api/daily?date=' + dd.value).then(function (r) { drawDay(r, true); }).catch(fail); } });
  }
  view.addEventListener('submit', function (e) {
    var f = e.target; e.preventDefault();
    var date = ($('dayDate') || {}).value || today;
    if (f.id === 'callForm') {
      api('POST', '/api/calls', { date: date, person: f.person.value, phone: f.phone.value, outcome: f.outcome.value, note: f.note.value }).then(function (r) { drawDay(r, true); toast('Call added'); }).catch(fail);
    } else if (f.dataset.job) {
      api('PUT', '/api/daily', { date: date, itemId: f.dataset.job, count: f.count.value, notes: f.notes.value }).then(function (r) { drawDay(r, true); toast('Saved'); }).catch(fail);
    } else if (f.id === 'txForm') { saveTx(f);
    } else if (f.id === 'newTask') { addTask(f);
    } else if (f.dataset.sub) { addSub(f);
    } else if (f.id === 'newUser') { addUser(f);
    } else if (f.id === 'routineForm') { saveRoutine(f); }
  });
  view.addEventListener('click', function (e) {
    var d = e.target.closest('[data-delcall]');
    if (d) { var date = ($('dayDate') || {}).value || today; api('DELETE', '/api/calls/' + d.dataset.delcall).then(function (r) { drawDay(r, true); toast('Removed'); }).catch(fail); }
  });

  // ---------------- employee: history ----------------
  function viewHistory() {
    return api('GET', '/api/history?days=30').then(function (h) {
      view.innerHTML = '<div class="card"><h3>Your last 30 days</h3><p class="muted">Tap a day to see or fix what you recorded.</p></div>' + h.days.map(function (d) {
        return '<div class="card"><div class="row"><div><b>' + (d.date === today ? 'Today' : fmt(d.date)) + '</b> ' + (d.active ? (d.allDone ? '<span class="pill ok">All done</span>' : '<span class="pill pending">Partly done</span>') : '<span class="pill">Nothing recorded</span>') + '</div><button class="btn ghost sm fit" data-open="' + d.date + '" type="button">Open</button></div><div class="chips">' + d.items.map(function (i) { return '<span class="chip ' + (i.done ? 'ok' : (i.count ? '' : 'no')) + '">' + esc(i.name) + ' ' + i.count + '/' + i.target + '</span>'; }).join('') + '</div></div>';
      }).join('');
    });
  }
  view.addEventListener('click', function (e) { var o = e.target.closest('[data-open]'); if (o) go('today', o.dataset.open); });

  // ---------------- tasks (employee view) ----------------
  function taskTree(list) {
    var mains = list.filter(function (t) { return !t.parentId; });
    var ids = {}; list.forEach(function (t) { ids[t.id] = 1; });
    var orphans = list.filter(function (t) { return t.parentId && !ids[t.parentId]; });
    return mains.concat(orphans).map(function (m) { return { t: m, subs: list.filter(function (s) { return s.parentId === m.id; }) }; });
  }
  function dueBadge(t) { if (!t.due) return ''; var late = t.status !== 'done' && t.due < today; return '<span class="pill ' + (late ? 'bad' : '') + '">' + (late ? 'Overdue ' : 'Due ') + fmt(t.due) + '</span>'; }
  function viewMyTasks() {
    return api('GET', '/api/tasks').then(function (r) {
      var tree = taskTree(r.tasks);
      view.innerHTML = '<div class="card"><h3>My tasks</h3><p class="muted">' + r.tasks.filter(function (t) { return t.status !== 'done'; }).length + ' open. Tasks and sub-tasks are set by the admin.</p></div>' +
        (tree.map(function (n) { return '<div class="card">' + taskRow(n.t, false) + n.subs.map(function (s) { return '<div class="sub">' + taskRow(s, false) + '</div>'; }).join('') + '</div>'; }).join('') || '<div class="card muted">No tasks for you right now.</div>');
    });
  }
  function taskRow(t, admin) {
    var status = '<select data-tstatus="' + t.id + '">' + ['todo', 'doing', 'done'].map(function (s) { return '<option value="' + s + '"' + (t.status === s ? ' selected' : '') + '>' + { todo: 'To do', doing: 'In progress', done: 'Done' }[s] + '</option>'; }).join('') + '</select>';
    return '<div class="item"><div class="head"><b' + (t.status === 'done' ? ' style="text-decoration:line-through;color:#64748b"' : '') + '>' + esc(t.title) + '</b><span class="chips"><span class="pill ' + t.priority + '">' + t.priority + '</span>' + dueBadge(t) + (admin ? '<span class="pill">' + esc(userName(t.assigneeId)) + '</span>' : '') + '</span></div>' +
      (t.description ? '<div class="muted">' + esc(t.description) + '</div>' : '') +
      '<div class="row"><label>Status' + status + '</label><label style="flex:3 1 200px">Note<input data-tnote="' + t.id + '" value="' + esc(t.note) + '" maxlength="1000" placeholder="Add a note and press Enter"></label></div></div>';
  }
  view.addEventListener('change', function (e) {
    var s = e.target.closest('[data-tstatus]');
    if (s) api('PATCH', '/api/tasks/' + s.dataset.tstatus, { status: s.value }).then(function () { toast('Updated'); if (me.role === 'admin') go('atasks'); else go('tasks'); }).catch(fail);
    var f = e.target.closest('#recFilter'); if (f) loadRecords();
  });
  view.addEventListener('keydown', function (e) {
    var n = e.target.closest('[data-tnote]');
    if (n && e.key === 'Enter') { e.preventDefault(); api('PATCH', '/api/tasks/' + n.dataset.tnote, { note: n.value }).then(function () { toast('Note saved'); }).catch(fail); }
  });

  // ---------------- employee: office (transactions) ----------------
  var editingTx = '';
  var TX_LABEL = { expense: 'Expense', income: 'Money received', purchase: 'Purchase', other: 'Other' };
  function viewOffice() {
    return api('GET', '/api/transactions').then(function (r) {
      view.innerHTML = '<div class="card"><h3>Office: send a transaction for approval</h3><form id="txForm" class="row"><label>Date<input type="date" name="date" value="' + today + '" max="' + today + '" required></label><label>Type<select name="type">' + Object.keys(TX_LABEL).map(function (k) { return '<option value="' + k + '">' + TX_LABEL[k] + '</option>'; }).join('') + '</select></label><label>Amount (₹)<input name="amount" type="number" step="0.01" min="0.01" required></label><label>Paid to / received from<input name="party" maxlength="100" required></label><label style="flex:3 1 260px">What was it for<input name="description" maxlength="1000"></label><button class="btn fit" type="submit">' + 'Send for approval</button><button class="btn ghost fit" type="button" id="txCancel" hidden>Cancel edit</button></form></div>' +
        '<div class="card"><h3>Your transactions</h3><div class="list">' + (r.transactions.map(function (t) {
          return '<div class="item"><div class="head"><b>' + money(t.amount) + ' <span class="muted">' + esc(TX_LABEL[t.type] || t.type) + '</span></b><span class="pill ' + t.status + '">' + t.status + '</span></div><div>' + esc(t.party) + ' <span class="muted">' + fmt(t.date) + '</span></div>' + (t.description ? '<div class="muted">' + esc(t.description) + '</div>' : '') + (t.remark ? '<div><b>Admin:</b> ' + esc(t.remark) + '</div>' : '') +
            (t.status === 'pending' ? '<div class="row"><button class="btn ghost sm fit" data-edittx=\'' + esc(JSON.stringify(t)) + '\' type="button">Edit</button><button class="btn ghost sm fit" data-deltx="' + t.id + '" type="button">Remove</button></div>' : '') + '</div>';
        }).join('') || '<p class="muted">Nothing sent yet.</p>') + '</div></div>';
    });
  }
  function saveTx(f) {
    var body = { date: f.date.value, type: f.type.value, amount: f.amount.value, party: f.party.value, description: f.description.value };
    api(editingTx ? 'PUT' : 'POST', '/api/transactions' + (editingTx ? '/' + editingTx : ''), body).then(function () { toast(editingTx ? 'Updated' : 'Sent for approval'); editingTx = ''; go('office'); }).catch(fail);
  }
  view.addEventListener('click', function (e) {
    var ed = e.target.closest('[data-edittx]');
    if (ed) { var t = JSON.parse(ed.dataset.edittx), f = $('txForm'); editingTx = t.id; f.date.value = t.date; f.type.value = t.type; f.amount.value = t.amount; f.party.value = t.party; f.description.value = t.description; $('txCancel').hidden = false; window.scrollTo(0, 0); return; }
    if (e.target.id === 'txCancel') { editingTx = ''; go('office'); return; }
    var dl = e.target.closest('[data-deltx]');
    if (dl) api('DELETE', '/api/transactions/' + dl.dataset.deltx).then(function () { toast('Removed'); go('office'); }).catch(fail);
  });

  // ---------------- admin: overview ----------------
  function viewOverview() {
    var date = openDate || today; openDate = '';
    return api('GET', '/api/overview?date=' + date).then(function (o) {
      pendingCount = o.pendingApprovals; drawTabs();
      view.innerHTML = '<div class="card"><div class="row"><label>Day<input type="date" id="ovDate" value="' + o.date + '" max="' + today + '"></label><div><h3>' + (o.pendingApprovals ? o.pendingApprovals + ' transaction' + (o.pendingApprovals === 1 ? '' : 's') + ' waiting for your approval' : 'Nothing waiting for approval') + '</h3></div>' + (o.pendingApprovals ? '<button class="btn fit" data-t="approvals" type="button">Review</button>' : '') + '</div></div>' +
        (o.employees.map(function (e) {
          return '<div class="card"><div class="head row"><h3>' + esc(e.user.name) + '</h3><span class="chips fit"><span class="pill ' + (e.overdueTasks ? 'bad' : '') + '">' + e.openTasks + ' open tasks' + (e.overdueTasks ? ', ' + e.overdueTasks + ' overdue' : '') + '</span>' + (e.pendingTransactions ? '<span class="pill pending">' + e.pendingTransactions + ' to approve</span>' : '') + '</span></div>' +
            e.items.map(function (i) { return '<div><div class="head" style="display:flex;justify-content:space-between"><span>' + esc(i.name) + '</span><span class="muted">' + i.count + ' / ' + i.target + '</span></div>' + bar(i.count, i.target) + '</div>'; }).join('') + '</div>';
        }).join('') || '<div class="card muted">No employees yet. Add them in the Team tab.</div>');
      var d = $('ovDate'); if (d) d.addEventListener('change', function () { if (d.value) go('overview', d.value); });
    });
  }
  view.addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (b && view.contains(b)) go(b.dataset.t); });

  // ---------------- admin: tasks ----------------
  var taskFilter = '';
  function viewAdminTasks() {
    return Promise.all([api('GET', '/api/users'), api('GET', '/api/tasks')]).then(function (r) {
      users = r[0].users;
      var list = r[1].tasks.filter(function (t) { return !taskFilter || t.assigneeId === taskFilter; });
      var tree = taskTree(list);
      view.innerHTML = '<div class="card"><h3>New task</h3><form id="newTask" class="row"><label style="flex:3 1 240px">Title<input name="title" required maxlength="120"></label><label>Assign to<select name="assigneeId">' + empOptions('') + '</select></label><label>Due<input type="date" name="due"></label><label>Priority<select name="priority"><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select></label><label style="flex:4 1 300px">Details<input name="description" maxlength="2000"></label><button class="btn fit" type="submit">Add task</button></form></div>' +
        '<div class="card"><div class="row"><label>Show tasks of<select id="tfilter"><option value="">Everyone</option>' + empOptions(taskFilter) + '</select></label></div></div>' +
        (tree.map(function (n) {
          return '<div class="card">' + taskRow(n.t, true) + '<div class="row"><button class="btn ghost sm fit" data-edit="' + n.t.id + '" type="button">Edit</button><button class="btn ghost sm fit" data-deltask="' + n.t.id + '" type="button">Delete</button></div>' +
            n.subs.map(function (s) { return '<div class="sub">' + taskRow(s, true) + '<div class="row"><button class="btn ghost sm fit" data-edit="' + s.id + '" type="button">Edit</button><button class="btn ghost sm fit" data-deltask="' + s.id + '" type="button">Delete</button></div></div>'; }).join('') +
            '<form class="row" data-sub="' + n.t.id + '"><label style="flex:3 1 220px">Add a sub-task<input name="title" maxlength="120" required placeholder="Sub-task title"></label><label>Assign to<select name="assigneeId">' + empOptions(n.t.assigneeId) + '</select></label><label>Due<input type="date" name="due"></label><button class="btn sm fit" type="submit">Add sub-task</button></form></div>';
        }).join('') || '<div class="card muted">No tasks yet.</div>');
      window.__tasks = r[1].tasks;
      var f = $('tfilter'); f.addEventListener('change', function () { taskFilter = f.value; go('atasks'); });
    });
  }
  function addTask(f) { api('POST', '/api/tasks', { title: f.title.value, assigneeId: f.assigneeId.value, due: f.due.value, priority: f.priority.value, description: f.description.value }).then(function () { toast('Task added'); go('atasks'); }).catch(fail); }
  function addSub(f) { api('POST', '/api/tasks', { title: f.title.value, parentId: f.dataset.sub, assigneeId: f.assigneeId.value, due: f.due.value }).then(function () { toast('Sub-task added'); go('atasks'); }).catch(fail); }
  view.addEventListener('click', function (e) {
    var d = e.target.closest('[data-deltask]');
    if (d) { if (d.dataset.armed !== '1') { d.dataset.armed = '1'; d.textContent = 'Tap again to delete'; setTimeout(function () { d.dataset.armed = ''; d.textContent = 'Delete'; }, 3000); return; } api('DELETE', '/api/tasks/' + d.dataset.deltask).then(function () { toast('Deleted'); go('atasks'); }).catch(fail); return; }
    var ed = e.target.closest('[data-edit]');
    if (ed) {
      var t = (window.__tasks || []).filter(function (x) { return x.id === ed.dataset.edit; })[0]; if (!t) return;
      var card = ed.closest('.item') ? ed.closest('.item').parentNode : ed.parentNode;
      var box = document.createElement('form'); box.className = 'row'; box.innerHTML = '<label style="flex:3 1 220px">Title<input name="title" value="' + esc(t.title) + '" maxlength="120"></label><label>Assign to<select name="assigneeId">' + empOptions(t.assigneeId) + '</select></label><label>Due<input type="date" name="due" value="' + esc(t.due) + '"></label><label>Priority<select name="priority">' + ['low', 'normal', 'high'].map(function (p) { return '<option' + (t.priority === p ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select></label><label style="flex:4 1 300px">Details<input name="description" value="' + esc(t.description) + '" maxlength="2000"></label><button class="btn sm fit" type="submit">Save</button>';
      box.addEventListener('submit', function (ev) { ev.preventDefault(); ev.stopPropagation(); api('PATCH', '/api/tasks/' + t.id, { title: box.title.value, assigneeId: box.assigneeId.value, due: box.due.value, priority: box.priority.value, description: box.description.value }).then(function () { toast('Saved'); go('atasks'); }).catch(fail); });
      ed.parentNode.replaceWith(box);
    }
  });

  // ---------------- admin: approvals ----------------
  var apFilter = 'pending';
  function viewApprovals() {
    return Promise.all([api('GET', '/api/users'), api('GET', '/api/transactions' + (apFilter ? '?status=' + apFilter : ''))]).then(function (r) {
      users = r[0].users;
      view.innerHTML = '<div class="card"><h3>Transactions for approval</h3><div class="chips">' + [['pending', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['', 'All']].map(function (f) { return '<button class="btn ' + (apFilter === f[0] ? '' : 'ghost') + ' sm" data-apf="' + f[0] + '" type="button">' + f[1] + '</button>'; }).join('') + '</div></div>' +
        (r[1].transactions.map(function (t) {
          return '<div class="card"><div class="head row"><div><b>' + money(t.amount) + '</b> <span class="muted">' + esc(TX_LABEL[t.type] || t.type) + ' &middot; ' + esc(t.party) + '</span></div><span class="pill ' + t.status + ' fit">' + t.status + '</span></div><div class="muted">' + esc(t.userName) + ' &middot; ' + fmt(t.date) + (t.description ? ' &middot; ' + esc(t.description) : '') + '</div>' +
            (t.status === 'pending' ? '<div class="row"><label style="flex:3 1 220px">Remark (optional)<input data-remark="' + t.id + '" maxlength="500"></label><button class="btn fit" data-decide="approved" data-id="' + t.id + '" type="button">Approve</button><button class="btn bad fit" data-decide="rejected" data-id="' + t.id + '" type="button">Reject</button></div>' : (t.remark ? '<div><b>Remark:</b> ' + esc(t.remark) + ' <span class="muted">' + fmtTime(t.decidedAt) + '</span></div>' : '')) + '</div>';
        }).join('') || '<div class="card muted">Nothing here.</div>');
    });
  }
  view.addEventListener('click', function (e) {
    var f = e.target.closest('[data-apf]'); if (f) { apFilter = f.dataset.apf; go('approvals'); return; }
    var d = e.target.closest('[data-decide]');
    if (d) { var rm = view.querySelector('[data-remark="' + d.dataset.id + '"]'); api('POST', '/api/transactions/' + d.dataset.id + '/decision', { status: d.dataset.decide, remark: rm ? rm.value : '' }).then(function () { toast(d.dataset.decide === 'approved' ? 'Approved' : 'Rejected'); go('approvals'); }).catch(fail); }
  });

  // ---------------- admin: records of an employee ----------------
  var recUser = '';
  function viewRecords() {
    return api('GET', '/api/users').then(function (r) {
      users = r.users; if (!recUser) recUser = (users.filter(function (u) { return u.active; })[0] || {}).id || '';
      view.innerHTML = '<div class="card"><div class="row"><label>Employee<select id="recFilter">' + empOptions(recUser) + '</select></label></div></div><div id="recList"></div>';
      loadRecords();
    });
  }
  function loadRecords() {
    var sel = $('recFilter'); recUser = sel ? sel.value : recUser; if (!recUser) { $('recList').innerHTML = '<div class="card muted">No employees yet.</div>'; return; }
    api('GET', '/api/history?days=30&userId=' + recUser).then(function (h) {
      $('recList').innerHTML = h.days.filter(function (d) { return d.active; }).map(function (d) {
        return '<div class="card"><div class="row"><b>' + fmt(d.date) + '</b><button class="btn ghost sm fit" data-recopen="' + d.date + '" type="button">Details</button></div><div class="chips">' + d.items.map(function (i) { return '<span class="chip ' + (i.done ? 'ok' : (i.count ? '' : 'no')) + '">' + esc(i.name) + ' ' + i.count + '/' + i.target + '</span>'; }).join('') + '</div><div id="rd-' + d.date + '"></div></div>';
      }).join('') || '<div class="card muted">No records in the last 30 days.</div>';
    }).catch(fail);
  }
  view.addEventListener('click', function (e) {
    var o = e.target.closest('[data-recopen]'); if (!o) return;
    var box = $('rd-' + o.dataset.recopen); if (box.innerHTML) { box.innerHTML = ''; return; }
    api('GET', '/api/daily?userId=' + recUser + '&date=' + o.dataset.recopen).then(function (rec) {
      box.innerHTML = '<div class="list">' + rec.items.map(function (i) { return i.type === 'calls' ? '<div class="item"><b>' + esc(i.name) + ' (' + i.count + ')</b>' + rec.calls.map(function (c) { return '<div>' + esc(c.person) + (c.phone ? ' <span class="muted">' + esc(c.phone) + '</span>' : '') + ' <span class="pill">' + esc(c.outcome) + '</span>' + (c.note ? ' <span class="muted">' + esc(c.note) + '</span>' : '') + '</div>'; }).join('') + '</div>' : (i.notes ? '<div class="item"><b>' + esc(i.name) + '</b><div class="muted">' + esc(i.notes) + '</div></div>' : ''); }).join('') + '</div>';
    }).catch(fail);
  });

  // ---------------- admin: team ----------------
  function viewTeam() {
    return api('GET', '/api/users').then(function (r) {
      users = r.users;
      view.innerHTML = '<div class="card"><h3>Add an employee</h3><form id="newUser" class="row"><label>Name<input name="name" required maxlength="60"></label><label>Username<input name="username" required maxlength="30" autocapitalize="none"></label><label>Password (8+ characters)<input name="password" type="text" minlength="8" required autocomplete="off"></label><button class="btn fit" type="submit">Add</button></form><p class="muted">Share the username and password with them directly. They sign in at this address.</p></div>' +
        '<div class="card"><h3>Team</h3><div class="list">' + (users.map(function (u) { return '<div class="item"><div class="head"><b>' + esc(u.name) + ' <span class="muted">@' + esc(u.username) + '</span></b><span class="pill ' + (u.active ? 'ok' : '') + '">' + (u.active ? 'Active' : 'Switched off') + '</span></div><div class="row"><button class="btn ghost sm fit" data-toggle="' + u.id + '" data-active="' + (u.active ? 1 : 0) + '" type="button">' + (u.active ? 'Switch off' : 'Switch on') + '</button><button class="btn ghost sm fit" data-reset="' + u.id + '" type="button">Set a new password</button></div></div>'; }).join('') || '<p class="muted">No employees yet.</p>') + '</div></div>';
    });
  }
  function addUser(f) { api('POST', '/api/users', { name: f.name.value, username: f.username.value, password: f.password.value }).then(function () { toast('Employee added'); go('team'); }).catch(fail); }
  view.addEventListener('click', function (e) {
    var t = e.target.closest('[data-toggle]');
    if (t) { api('PATCH', '/api/users/' + t.dataset.toggle, { active: t.dataset.active !== '1' }).then(function () { go('team'); }).catch(fail); return; }
    var r = e.target.closest('[data-reset]');
    if (r) { var pw = window.prompt('New password (at least 8 characters)'); if (pw) api('PATCH', '/api/users/' + r.dataset.reset, { password: pw }).then(function () { toast('Password changed'); }).catch(fail); }
  });

  // ---------------- admin: daily jobs and targets ----------------
  function viewRoutine() {
    return api('GET', '/api/routine').then(function (r) {
      view.innerHTML = '<div class="card"><h3>Daily jobs</h3><p class="muted">What each employee does every day, and the target. The calls job always stays.</p><form id="routineForm" class="list">' +
        r.items.map(function (i) { return '<div class="row" data-rid="' + esc(i.id) + '"><label style="flex:3 1 200px">Job<input name="name" value="' + esc(i.name) + '" maxlength="60"></label><label>Target per day<input name="target" type="number" min="0" max="10000" value="' + i.target + '"></label><label>Unit<input name="unit" value="' + esc(i.unit) + '" maxlength="20"></label></div>'; }).join('') +
        '<div class="row"><button class="btn ghost fit" type="button" id="addJob">Add a job</button><button class="btn fit" type="submit">Save</button></div></form></div>';
      $('addJob').addEventListener('click', function () { var d = document.createElement('div'); d.className = 'row'; d.dataset.rid = ''; d.innerHTML = '<label style="flex:3 1 200px">Job<input name="name" maxlength="60" placeholder="New job"></label><label>Target per day<input name="target" type="number" min="0" value="1"></label><label>Unit<input name="unit" value="done" maxlength="20"></label>'; $('addJob').parentNode.before(d); });
    });
  }
  function saveRoutine(f) {
    var items = [].slice.call(f.querySelectorAll('[data-rid]')).map(function (r) { return { id: r.dataset.rid || undefined, name: r.querySelector('[name=name]').value, target: r.querySelector('[name=target]').value, unit: r.querySelector('[name=unit]').value }; }).filter(function (i) { return i.name.trim() || i.id; });
    api('PUT', '/api/routine', { items: items }).then(function () { toast('Saved'); go('routine'); }).catch(fail);
  }

  // ---------------- start ----------------
  api('GET', '/api/me').then(function (r) {
    me = r.user; today = r.today; windowDays = r.editWindowDays;
    $('who').textContent = me.name;
    var p = me.role === 'admin' ? api('GET', '/api/users').then(function (u) { users = u.users; }) : Promise.resolve();
    return p.then(function () { go(me.role === 'admin' ? 'overview' : 'today'); });
  }).catch(fail);
})();
