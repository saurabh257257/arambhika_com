(function () {
  'use strict';
  var P = window.Panel, esc = P.esc;
  var DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];
  var DAYNAME = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
  var QUICK = ['Follow up with Vikas', 'Follow up with Lokesh', 'Inventory sync up', 'Weekly invoice update'];

  function repeatText(t) {
    if (t.repeat === 'daily') return 'Every day';
    if (t.repeat === 'weekly') return 'Every ' + t.days.map(function (d) { return DAYNAME[d]; }).join(', ');
    if (t.repeat === 'monthly') return 'Monthly, on day ' + t.dayOfMonth;
    return 'One time';
  }
  function whenPill(t) {
    if (t.state === 'overdue') return P.pill(t.daysLate + ' day' + (t.daysLate === 1 ? '' : 's') + ' late', 'overdue');
    if (t.state === 'today') return P.pill('Due today', 'due');
    if (t.state === 'upcoming') return P.pill('Next: ' + P.fmtDate(t.nextDue), 'new');
    return P.pill('Done', 'done');
  }
  function form(t) {
    t = t || { repeat: 'daily', days: [1, 2, 3, 4, 5, 6], dayOfMonth: 1 };
    return '<form class="atform" data-atform>' +
      '<div class="row"><label style="flex:3 1 260px">Task<input name="title" maxlength="120" required value="' + esc(t.title || '') + '"></label>' +
      '<label>Repeats<select name="repeat">' + [['once', 'One time'], ['daily', 'Every day'], ['weekly', 'Every week'], ['monthly', 'Every month']].map(function (o) { return '<option value="' + o[0] + '"' + (t.repeat === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
      '<label data-for="once">Due date<input type="date" name="dueDate" value="' + (t.repeat === 'once' ? esc(t.nextDue || P.today) : P.today) + '"></label>' +
      '<label data-for="monthly">Day of month<input type="number" name="dayOfMonth" min="1" max="31" value="' + t.dayOfMonth + '"></label></div>' +
      '<div class="chips" data-for="weekly"><span class="muted small">On:</span>' + DAYS.map(function (d) { return '<label class="chip daychip"><input type="checkbox" name="day" value="' + d[0] + '"' + (t.days.indexOf(d[0]) >= 0 ? ' checked' : '') + '> ' + d[1] + '</label>'; }).join('') + '</div>' +
      '<label>Notes (optional)<input name="notes" maxlength="1000" value="' + esc(t.notes || '') + '"></label>' +
      '<div class="actions"><button class="btn sm" type="submit">' + (t.id ? 'Save changes' : 'Add task') + '</button><button class="btn ghost sm" type="button" data-cancel>Cancel</button></div></form>';
  }
  function showFor(f) {
    var r = f.repeat.value;
    [].forEach.call(f.querySelectorAll('[data-for]'), function (x) { x.hidden = x.dataset.for !== r; });
  }
  function readForm(f) {
    return { title: f.title.value, notes: f.notes.value, repeat: f.repeat.value, dueDate: f.repeat.value === 'once' ? f.dueDate.value : '', dayOfMonth: f.dayOfMonth.value,
      days: [].map.call(f.querySelectorAll('[name=day]:checked'), function (c) { return Number(c.value); }) };
  }
  function wire(f, submit, cancel) {
    showFor(f);
    f.repeat.addEventListener('change', function () { showFor(f); });
    f.addEventListener('submit', function (e) { e.preventDefault(); submit(readForm(f)); });
    f.querySelector('[data-cancel]').addEventListener('click', cancel);
  }

  P.register({ id: 'admintasks', label: 'Admin tasks', roles: ['admin'], order: 0.5, render: function (el) {
    var adding = false, editing = '', showDone = false, tasks = [];

    function card(t) {
      if (editing === t.id) return '<div class="card tight" data-id="' + t.id + '">' + form(t) + '</div>';
      var last = t.lastDone ? '<span class="muted small">Last done ' + P.fmtDate(t.lastDone) + '</span>' : '';
      return '<div class="card tight atcard ' + t.state + '" data-id="' + t.id + '"><div class="between"><b>' + esc(t.title) + '</b><span class="chips">' + whenPill(t) + '</span></div>' +
        (t.notes ? '<div class="muted">' + esc(t.notes) + '</div>' : '') +
        '<div class="muted small">' + repeatText(t) + ' ' + last + '</div>' +
        '<div class="actions">' + (t.state === 'done' ? '' : '<button class="btn sm" type="button" data-done>Mark done</button><button class="btn ghost sm" type="button" data-snooze>Not today</button>') + '<button class="btn ghost sm" type="button" data-edit>Edit</button><button class="btn ghost sm" type="button" data-del>Remove</button></div></div>';
    }
    function section(title, list, hint) {
      return list.length ? '<h3 class="wkhead">' + title + ' <span class="muted small">' + (hint || '') + '</span></h3>' + list.map(card).join('') : '';
    }
    function draw() {
      var by = function (s) { return tasks.filter(function (t) { return t.state === s; }); };
      var due = by('overdue').length + by('today').length;
      P.setBadge('admintasks', due);
      el.innerHTML = '<div class="card"><div class="between"><div><h3>Admin tasks</h3><div class="muted small">Your own jobs: follow-ups with the team, weekly checks. A repeating task comes back by itself after you mark it done.</div></div>' +
        '<div class="actions">' + (adding ? '' : '<button class="btn sm" type="button" data-add>+ Add task</button>') + '</div></div>' +
        (adding ? form() + '<div class="chips"><span class="muted small">Quick pick:</span>' + QUICK.map(function (q) { return '<button class="chip" type="button" data-quick="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') + '</div>' : '') +
        (!tasks.length && !adding ? '<div class="empty-start"><div class="muted">Nothing here yet. Start with the usual four: follow up with Vikas and Lokesh (daily), inventory sync up (Fridays), weekly invoice update (Saturdays). You can change any of them after.</div><div class="actions"><button class="btn sm" type="button" data-starter>Add these four</button></div></div>' : '') +
        (tasks.length ? '<div class="muted small"><b>' + due + '</b> to do now &middot; ' + by('upcoming').length + ' coming up</div>' : '') + '</div>' +
        section('Late', by('overdue'), 'not done on the day it was due') + section('Today', by('today')) + section('Coming up', by('upcoming')) +
        (by('done').length ? '<div class="actions"><button class="btn ghost sm" type="button" data-showdone>' + (showDone ? 'Hide' : 'Show') + ' ' + by('done').length + ' finished one-time task' + (by('done').length === 1 ? '' : 's') + '</button></div>' + (showDone ? by('done').map(card).join('') : '') : '');
      var f = el.querySelector('[data-atform]');
      if (f) {
        var id = editing;
        wire(f, function (v) { var p = id ? P.api('PUT', '/api/admin-tasks/' + id, v) : P.api('POST', '/api/admin-tasks', v); p.then(function () { P.toast(id ? 'Saved' : 'Task added'); adding = false; editing = ''; return load(); }).catch(P.fail); },
          function () { adding = false; editing = ''; draw(); });
        if (!id) f.title.focus();
      }
    }
    function load() { return P.api('GET', '/api/admin-tasks').then(function (r) { tasks = r.tasks; draw(); }); }

    el.addEventListener('click', function (e) {
      var q = e.target.closest('[data-quick]'); if (q) { var f = el.querySelector('[data-atform]'); f.title.value = q.dataset.quick; f.title.focus(); return; }
      if (e.target.closest('[data-add]')) { adding = true; editing = ''; draw(); return; }
      if (e.target.closest('[data-showdone]')) { showDone = !showDone; draw(); return; }
      if (e.target.closest('[data-starter]')) { P.api('POST', '/api/admin-tasks/starter', {}).then(function (r) { P.toast(r.added + ' tasks added'); return load(); }).catch(P.fail); return; }
      var item = e.target.closest('[data-id]'); if (!item) return;
      var id = item.dataset.id;
      if (e.target.closest('[data-done]')) { P.api('POST', '/api/admin-tasks/' + id + '/done', {}).then(function (r) { P.toast(r.task.state === 'done' ? 'Done' : 'Done. Next: ' + P.fmtDate(r.task.nextDue)); return load(); }).catch(P.fail); return; }
      if (e.target.closest('[data-snooze]')) {
        var d = prompt('Move it to which date? (YYYY-MM-DD)', P.addDays(P.today, 1)); if (!d) return;
        P.api('POST', '/api/admin-tasks/' + id + '/snooze', { date: d.trim() }).then(function () { P.toast('Moved'); return load(); }).catch(P.fail); return;
      }
      if (e.target.closest('[data-edit]')) { editing = id; adding = false; draw(); return; }
      if (e.target.closest('[data-del]')) {
        if (!confirm('Remove this task and its history?')) return;
        P.api('DELETE', '/api/admin-tasks/' + id).then(function () { P.toast('Removed'); return load(); }).catch(P.fail);
      }
    });
    return load();
  } });
})();
