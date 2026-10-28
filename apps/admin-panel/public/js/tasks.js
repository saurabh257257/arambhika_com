(function () {
  'use strict';
  var P = window.Panel, esc = P.esc;
  var KIND = { rows: 'Fill in rows', checklist: 'Checklist', count: 'Counter' };
  var SCHED = { daily: 'Every day', weekly: 'Every week', once: 'One time' };

  // ---------------- one task, drawn the same way for the team member and for the owner ----------------
  function cellInput(col, value, editable) {
    var dis = editable ? '' : ' disabled', v = esc(value || '');
    if (col.type === 'choice') return '<select name="' + col.key + '"' + dis + '><option value="">' + esc(col.label) + '</option>' + col.options.map(function (o) { return '<option' + (o === value ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
    var type = { phone: 'tel', date: 'date', number: 'number' }[col.type] || 'text';
    return '<input name="' + col.key + '" type="' + type + '" value="' + v + '" placeholder="' + esc(col.label) + (col.required ? ' *' : '') + '" maxlength="200"' + dis + (col.followUp ? ' min="' + P.addDays(P.today, 1) + '"' : '') + '>';
  }
  function carryNote(t) {
    if (!t.carried) return '';
    return P.pill('+' + t.carried + ' carried over from ' + (t.schedule === 'weekly' ? 'last week' : 'earlier'), 'doing');
  }
  // which task cards are open: each starts closed except the first one still to be finished; a click toggles it and the choice is remembered
  var openIds = {}, seeded = false;
  function seedOpen(tasks) { if (seeded) return; seeded = true; var first = tasks.filter(function (t) { return !(t.completedAt || (t.progress.total && t.progress.done >= t.progress.total)); })[0]; if (first) openIds[first.id] = true; }
  function isOpen(t) { return Boolean(openIds[t.id]); }
  function taskCard(t, editable) {
    var pr = t.progress, hasFu = t.kind === 'rows' && t.columns.some(function (c) { return c.followUp; });
    var when = t.schedule === 'weekly' ? P.pill('This week, from ' + P.fmtDate(t.date)) : t.schedule === 'once' ? P.pill(t.dueDate ? 'Due ' + P.fmtDate(t.dueDate) : 'One-time', t.dueDate && t.dueDate < P.today && !t.completedAt ? 'overdue' : '') : P.pill('Daily');
    var head = '<div class="th"><div class="between"><span class="chips">' + P.pill(KIND[t.kind]) + when + carryNote(t) + (t.completedAt ? P.pill('Complete', 'ok') : '') + '</span></div>' +
      (t.instructions ? '<div class="muted">' + esc(t.instructions) + '</div>' : '') +
      (t.carried ? '<div class="muted small">Target today: ' + t.base + ' + ' + t.carried + ' left over from before = ' + (t.base + t.carried) + '</div>' : '') +
      (hasFu ? '<div class="muted small">Set a follow-up date on a call and it comes back by itself on that day.</div>' : '') +
      '<div class="between"><b>' + pr.done + ' of ' + pr.total + ' done (' + pr.percent + '%)</b><span class="stamp">' + (t.updatedAt ? 'Last updated ' + P.stamp(t.updatedAt, t.updatedByName) : 'Not started') + '</span></div>' + P.bar(pr.done, pr.total) + '</div>';
    var body = '';
    if (t.kind === 'rows') {
      var cols = t.columns, n = cols.length;
      body = '<div class="cells" style="--cols:' + n + '"><div class="cellrow head"><span></span>' + cols.map(function (c) { return '<span>' + esc(c.label) + (c.required ? ' *' : '') + '</span>'; }).join('') + '<span></span></div>' +
        t.rows.map(function (r, i) {
          var last = (r.history || [])[(r.history || []).length - 1];
          return '<div class="cellrow ' + (t.rowsDone[i] ? 'done' : '') + '" data-task="' + t.id + '" data-i="' + i + '"><span class="no">' + (t.rowsDone[i] ? '&#10003;' : (i + 1)) + '</span>' +
            cols.map(function (c) { return '<span class="cell">' + cellInput(c, (r.values || {})[c.key], editable) + '</span>'; }).join('') +
            (editable ? '<span class="go"><button class="btn sm" type="button" data-save-row>Save</button></span>' : '<span></span>') +
            ((r.updatedAt || last) ? '<div class="stampcol stamp">' + (r.updatedAt ? 'Updated ' + P.stamp(r.updatedAt, r.updatedByName) : '') + (last ? ' &middot; Follow-up call ' + P.fmtTime(last.at) + ': ' + esc(last.notes) : '') + '</div>' : '') + '</div>';
        }).join('') + '</div>';
    } else if (t.kind === 'checklist') {
      body = '<div class="steps">' + t.steps.map(function (s, i) {
        return '<label class="step check ' + (s.done ? 'on' : '') + '"><input type="checkbox" data-step="' + i + '" data-task="' + t.id + '"' + (s.done ? ' checked' : '') + (editable ? '' : ' disabled') + '><span class="t">' + esc(s.text) + '</span>' + (s.doneAt ? '<span class="stamp">' + P.fmtTime(s.doneAt) + '</span>' : '') + '</label>';
      }).join('') + '</div>';
    } else {
      body = '<form class="row" style="padding:12px 14px" data-count="' + t.id + '"><label>How many ' + esc(t.unit) + ' (target ' + t.target + ')<input type="number" name="count" min="0" value="' + t.count + '"' + (editable ? '' : ' disabled') + '></label>' +
        '<label style="flex:3 1 240px">Notes or link<input name="notes" maxlength="2000" value="' + esc(t.notes) + '" placeholder="e.g. link of the Instagram post"' + (editable ? '' : ' disabled') + '></label>' + (editable ? '<button class="btn fit" type="submit">Save</button>' : '') + '</form>';
    }
    var open = isOpen(t);
    var sum = '<div class="tsum" data-toggle="' + t.id + '" role="button" tabindex="0"><span class="caret">' + (open ? '&#9662;' : '&#9656;') + '</span><b class="tname">' + esc(t.name) + '</b><span class="tprog' + (t.completedAt || (pr.total && pr.done >= pr.total) ? ' ok' : '') + '">' + pr.done + '/' + pr.total + '</span><span class="tbar">' + P.bar(pr.done, pr.total) + '</span></div>';
    return '<div class="task' + (open ? ' open' : '') + '" data-card="' + t.id + '">' + sum + '<div class="tbody">' + head + body + '</div></div>';
  }

  function wireTasks(el, editable, tasks, reload) {
    function replace(task) { var old = el.querySelector('[data-card="' + task.id + '"]'); var tmp = document.createElement('div'); tmp.innerHTML = taskCard(task, editable); if (old) old.replaceWith(tmp.firstChild); }
    function toggle(e) {
      var h = e.target.closest('[data-toggle]'); if (!h) return;
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      var card = h.closest('.task'), id = h.dataset.toggle; openIds[id] = !openIds[id];
      card.classList.toggle('open', openIds[id]); h.querySelector('.caret').innerHTML = openIds[id] ? '&#9662;' : '&#9656;';
    }
    el.addEventListener('click', toggle); el.addEventListener('keydown', toggle);
    if (!editable) return;
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-save-row]'); if (!b) return;
      var row = b.closest('.cellrow'), values = {};
      [].forEach.call(row.querySelectorAll('input,select'), function (i) { values[i.name] = i.value; });
      b.disabled = true;
      P.api('PUT', '/api/tasks/' + row.dataset.task + '/rows/' + row.dataset.i, { values: values }).then(function (r) { replace(r.task); P.toast('Saved ' + P.fmtTime(r.task.updatedAt)); if (reload) reload(true); }).catch(function (err) { b.disabled = false; P.fail(err); });
    });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.closest('.cellrow') && e.target.tagName === 'INPUT') { e.preventDefault(); e.target.closest('.cellrow').querySelector('[data-save-row]').click(); } });
    el.addEventListener('change', function (e) {
      var c = e.target.closest('[data-step]'); if (!c) return;
      P.api('PUT', '/api/tasks/' + c.dataset.task + '/steps/' + c.dataset.step, { done: c.checked }).then(function (r) { replace(r.task); if (reload) reload(true); }).catch(function (err) { c.checked = !c.checked; P.fail(err); });
    });
    el.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-count]'); if (!f) return; e.preventDefault();
      P.api('PUT', '/api/tasks/' + f.dataset.count + '/count', { count: f.count.value, notes: f.notes.value }).then(function (r) { replace(r.task); P.toast('Saved ' + P.fmtTime(r.task.updatedAt)); if (reload) reload(true); }).catch(P.fail);
    });
  }

  // a short list of the customer requests still open, with a way into the Customer requests tab where they are worked on
  function requestsCard(list) {
    if (!list.length) return '';
    var late = list.filter(function (r) { return r.needsAttention || r.followUpDue; }).length, shown = list.slice(0, 5);
    return '<div class="card" id="reqCard"><div class="between"><div><h3>Customer requests open (' + list.length + ')</h3><div class="muted small">' + (late ? late + ' need attention today. ' : '') + 'Open the tab to tick the steps, add notes and upload screenshots.</div></div><button class="btn sm" data-goreq type="button">Open customer requests</button></div><div class="list">' + shown.map(function (r) {
      return '<div class="item ' + (r.needsAttention ? 'hot' : r.followUpDue ? 'warn' : '') + '" data-goreq style="cursor:pointer"><div class="between"><b>' + esc(r.customerName) + (r.request ? ' <span class="muted">' + esc(r.request.slice(0, 60)) + '</span>' : '') + '</b><span class="chips">' + P.pill(r.progress.done + ' of ' + r.progress.total + ' steps') + (r.needsAttention ? P.pill('Not touched for ' + r.daysSinceTouched + ' day' + (r.daysSinceTouched === 1 ? '' : 's'), 'overdue') : '') + (r.followUpDue ? P.pill('Follow up today', 'due') : '') + '</span></div><div class="meta"><span>Next: <b>' + esc(r.nextStep) + '</b></span></div></div>';
    }).join('') + '</div>' + (list.length > shown.length ? '<div class="muted small">and ' + (list.length - shown.length) + ' more in the tab</div>' : '') + '</div>';
  }

  // calls whose follow-up date has come: what was said before, and a form for this call
  function followupsCard(list) {
    if (!list.length) return '';
    return '<div class="card" id="fuCard"><div class="between"><h3>Follow-up calls due (' + list.length + ')</h3><span class="muted small">They stay here until you log the call.</span></div><div class="list">' + list.map(function (f, n) {
      return '<div class="item ' + (f.daysLate > 0 ? 'hot' : 'warn') + '" data-fu="' + n + '"><div class="between"><b>' + esc((f.details[0] || {}).value || 'Call') + '</b><span class="chips">' + P.pill(f.daysLate > 0 ? f.daysLate + ' day' + (f.daysLate === 1 ? '' : 's') + ' late' : 'Follow up today', f.daysLate > 0 ? 'overdue' : 'due') + '</span></div>' +
        '<div class="meta">' + f.details.slice(1).map(function (x) { return '<span>' + esc(x.label) + ': <b>' + esc(x.value) + '</b></span>'; }).join('') + '<span>First called ' + P.fmtDate(f.calledOn) + '</span></div>' +
        (f.history.length ? '<div class="hist">' + f.history.map(function (h) { return '<div><b>' + P.fmtTime(h.at) + '</b> ' + esc(h.notes) + '</div>'; }).join('') + '</div>' : '') +
        '<form class="fu" data-fuform><label>What did you talk about this time<textarea name="notes" required minlength="2" maxlength="1000" style="min-height:56px"></textarea></label>' +
        '<div class="row"><label>Next follow-up date<input type="date" name="nextDate" min="' + P.addDays(P.today, 1) + '"></label><div class="small muted" style="align-self:center">Leave it empty if there is nothing more to follow up.</div></div>' +
        '<div class="actions"><button class="btn sm" type="submit">Save follow-up call</button></div></form></div>';
    }).join('') + '</div></div>';
  }
  // ---------------- the week at a glance (Monday to Sunday) ----------------
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function shortDate(d) { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
  function weekStrip(w, selected, isOwner) {
    return '<div class="card" id="weekCard"><div class="between"><button class="btn ghost sm" data-wk="-7" type="button">&lsaquo; Previous week</button>' +
      '<div style="text-align:center"><b>' + shortDate(w.weekStart) + ' to ' + shortDate(w.weekEnd) + '</b><div class="muted small">This week: ' + w.totals.done + ' of ' + w.totals.total + ' done</div></div>' +
      '<button class="btn ghost sm" data-wk="7" type="button">Next week &rsaquo;</button></div>' +
      '<div class="weekbar">' + w.days.map(function (d) {
        var open = isOwner || d.editable || !d.isFuture;
        var cls = (d.date === selected ? ' sel' : '') + (d.isToday ? ' today' : '') + (d.isFuture ? ' future' : '') + (!d.isWorkDay ? ' off' : '');
        return '<button type="button" class="wk-day' + cls + '" data-day="' + d.date + '"' + (open ? '' : ' disabled') + '><span class="wk-n">' + DOW[d.dow] + '</span><span class="wk-d">' + Number(d.date.slice(8)) + '</span>' +
          (d.isToday ? '<span class="wk-tag">Today</span>' : d.isFuture ? '<span class="wk-tag ahead">Ahead</span>' : '<span class="wk-tag">&nbsp;</span>') +
          (d.isWorkDay ? P.bar(d.done, d.total) + '<span class="wk-t">' + (d.planned ? d.total + ' planned' : d.done + ' of ' + d.total) + '</span>' : '<span class="wk-t">Day off</span>') + '</button>';
      }).join('') + '</div>' +
      (w.weekly.length ? '<div class="muted small">This week:</div><div class="chips">' + w.weekly.map(function (x) { return '<span class="chip">' + esc(x.name) + ': <b>' + x.done + ' of ' + x.total + '</b>' + (x.carried ? ' (+' + x.carried + ' carried)' : '') + (x.planned ? ' planned' : '') + '</span>'; }).join('') + '</div>' : '') +
      '<div class="muted small">Tap a day to see it. You can fill in later days too (up to a week ahead) if you have time: what is left over from earlier days is added on top when that day comes, and what you wrote is kept.</div></div>';
  }
  function daySummary(r, date) {
    var done = r.tasks.reduce(function (s, t) { return s + t.progress.done; }, 0), total = r.tasks.reduce(function (s, t) { return s + t.progress.total; }, 0);
    var title = date === P.today ? 'Today' : DOW[new Date(date + 'T00:00:00').getDay()] + ' ' + shortDate(date);
    return '<div class="card" id="daySummary"><div><h3>' + title + (r.ahead ? ' (working ahead)' : '') + (r.workDay ? '' : ' (day off)') + '</h3><div class="muted">' + done + ' of ' + total + ' done &middot; ' + (total - done) + ' left</div></div>' + (total ? P.bar(done, total) : '') +
      (r.ahead ? '<div class="banner info">You are working ahead on this day. Whatever is left over from the days before is added on top when this day comes, and everything you write now is kept.</div>' : '') + '</div>';
  }
  // the week strip and its buttons, shared by the team member and the owner. load(date, anchor) is called with the new choice.
  function wireWeek(el, state, limits, load) {
    el.addEventListener('click', function (e) {
      var d = e.target.closest('[data-day]'); if (d && !d.disabled) { state.date = d.dataset.day; load(); return; }
      var w = e.target.closest('[data-wk]'); if (!w) return;
      var step = Number(w.dataset.wk), next = P.addDays(state.date, step);
      if (limits.max && next > limits.max) next = limits.max;
      if (limits.min && next < limits.min) next = limits.min;
      state.date = next; load();
    });
  }

  // ---------------- the team member's tasks ----------------
  P.register({ id: 'tasks', label: 'Tasks', roles: ['employee'], order: 1, render: function (el) {
    var state = { date: P.today }, wired = false, limits = {};
    // after each save, the week strip and the day's totals are brought up to date without redrawing the rows being typed in
    function refreshTop() {
      var date = state.date;
      return Promise.all([P.api('GET', '/api/tasks?date=' + date), P.api('GET', '/api/week?date=' + date)]).then(function (res) {
        var sum = el.querySelector('#daySummary'), wk = el.querySelector('#weekCard');
        var t1 = document.createElement('div'); t1.innerHTML = daySummary(res[0], date); if (sum) sum.replaceWith(t1.firstChild);
        var t2 = document.createElement('div'); t2.innerHTML = weekStrip(res[1], date, false); if (wk) wk.replaceWith(t2.firstChild);
      }).catch(function () { /* the numbers catch up on the next reload */ });
    }
    function load() {
      var date = state.date;
      return Promise.all([P.api('GET', '/api/tasks?date=' + date), P.api('GET', '/api/week?date=' + date), date === P.today ? P.api('GET', '/api/followups-due') : Promise.resolve({ followups: [] }), date === P.today ? P.api('GET', '/api/requests?filter=mine').catch(function () { return { requests: [] }; }) : Promise.resolve({ requests: [] })]).then(function (res) {
        var r = res[0], w = res[1], fu = res[2].followups, rq = res[3].requests.filter(function (x) { return !x.complete; }); limits = { min: w.minDate, max: w.maxDate };
        seedOpen(r.tasks);
        el.innerHTML = weekStrip(w, date, false) + daySummary(r, date) +
          requestsCard(rq) + followupsCard(fu) +
          (r.tasks.length ? r.tasks.map(function (t) { return taskCard(t, true); }).join('') : P.empty(r.workDay ? 'No tasks for this day.' : 'It is a day off. Nothing is expected.'));
        el.__fu = fu;
        if (!wired) { wired = true; wireTasks(el, true, r.tasks, refreshTop); wireWeek(el, state, { get min() { return limits.min; }, get max() { return limits.max; } }, function () { load().catch(P.fail); }); }
      });
    }
    el.addEventListener('click', function (e) { if (e.target.closest('[data-goreq]')) P.go('requests'); });
    // the follow-up list changes after each save, so the handler reads the latest list from the element
    el.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-fuform]'); if (!f) return; e.preventDefault();
      var item = (el.__fu || [])[Number(f.closest('[data-fu]').dataset.fu)]; if (!item) return;
      P.api('POST', '/api/tasks/' + item.taskId + '/rows/' + item.rowIndex + '/followup', { notes: f.notes.value, nextDate: f.nextDate.value }).then(function (r) { P.toast(r.nextDate ? 'Saved. Next follow-up on ' + P.fmtDate(r.nextDate) : 'Saved. No more follow-up needed.'); return load(); }).catch(P.fail);
    });
    return load();
  } });

  // ---------------- the owner looks at somebody's work ----------------
  P.register({ id: 'work', label: 'Team work', roles: ['admin'], order: 2, render: function (el) {
    var state = { date: P.today }, wired = false;
    function load() {
      var who = P.viewAs || (P.users.filter(function (u) { return u.active; })[0] || {}).id || '';
      if (!who) { el.innerHTML = P.empty('Add team members first.'); return Promise.resolve(); }
      var date = state.date;
      return Promise.all([P.api('GET', '/api/tasks?userId=' + who + '&date=' + date), P.api('GET', '/api/week?userId=' + who + '&date=' + date), P.api('GET', '/api/followups-due?userId=' + who)]).then(function (res) {
        var r = res[0], w = res[1], fu = res[2].followups;
        seedOpen(r.tasks);
        el.innerHTML = '<div class="card"><div class="row"><label>Team member<select id="wu">' + P.userOptions(who) + '</select></label></div></div>' + weekStrip(w, date, true) +
          (fu.length ? '<div class="card"><h3>Follow-up calls due (' + fu.length + ')</h3><div class="list">' + fu.map(function (f) { return '<div class="item ' + (f.daysLate > 0 ? 'hot' : 'warn') + '"><div class="between"><b>' + esc((f.details[0] || {}).value || 'Call') + '</b>' + P.pill(f.daysLate > 0 ? f.daysLate + ' days late' : 'Today', f.daysLate > 0 ? 'overdue' : 'due') + '</div><div class="meta">' + f.details.slice(1).map(function (x) { return '<span>' + esc(x.label) + ': <b>' + esc(x.value) + '</b></span>'; }).join('') + '</div></div>'; }).join('') + '</div></div>' : '') +
          (r.tasks.length ? r.tasks.map(function (t) { return taskCard(t, false); }).join('') : P.empty('No tasks for them on this day.'));
        el.querySelector('#wu').addEventListener('change', function (e) { P.viewAs = e.target.value; load().catch(P.fail); });
        if (!wired) { wired = true; wireTasks(el, false, [], null); wireWeek(el, state, {}, function () { load().catch(P.fail); }); }
      });
    }
    return load();
  } });

  // ---------------- the task designer (owner) ----------------
  function colRow(c) {
    return '<div class="col-edit" data-col><label>Column name<input name="label" value="' + esc(c.label || '') + '" maxlength="30"></label><label>Type<select name="type">' + ['text', 'phone', 'choice', 'date', 'number'].map(function (t) { return '<option' + (c.type === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></label>' +
      '<label>Choices (comma separated)<input name="options" value="' + esc((c.options || []).join(', ')) + '" placeholder="only for type choice"></label><div class="chips"><label class="check"><input type="checkbox" name="required"' + (c.required ? ' checked' : '') + '> must fill</label><label class="check" data-fu-box><input type="checkbox" name="followUp"' + (c.followUp ? ' checked' : '') + '> this is the follow-up date</label></div><button class="btn ghost sm" type="button" data-del-col>Remove</button></div>';
  }
  function designForm(t, defaults) {
    t = t || { kind: 'rows', schedule: 'daily', assignees: [], active: true, rowCount: 10, columns: defaults, steps: [], target: 1, unit: 'done', carry: true };
    return '<form class="card" id="design"><div class="between"><h3>' + (t.id ? 'Change this task' : 'Design a new task') + '</h3>' + (t.id ? '<button class="btn ghost sm" type="button" data-cancel>Cancel</button>' : '') + '</div>' +
      '<div class="row"><label style="flex:3 1 240px">Task name<input name="name" value="' + esc(t.name || '') + '" maxlength="80" required placeholder="e.g. Call 10 people"></label>' +
      '<label>What kind of task<select name="kind"><option value="rows"' + (t.kind === 'rows' ? ' selected' : '') + '>Fill in rows (calls, visits, entries)</option><option value="checklist"' + (t.kind === 'checklist' ? ' selected' : '') + '>Checklist (steps to tick)</option><option value="count"' + (t.kind === 'count' ? ' selected' : '') + '>Counter (a number and a note)</option></select></label>' +
      '<label>How often<select name="schedule">' + Object.keys(SCHED).map(function (k) { return '<option value="' + k + '"' + (t.schedule === k ? ' selected' : '') + '>' + SCHED[k] + (k === 'daily' ? ' (working days)' : k === 'once' ? ' (stays until done)' : ' (Monday to Sunday)') + '</option>'; }).join('') + '</select></label>' +
      '<label data-due>Due date<input type="date" name="dueDate" value="' + esc(t.dueDate || '') + '"></label></div>' +
      '<div data-kind="rows"><div class="row"><label>How many rows<input type="number" name="rowCount" min="1" max="200" value="' + (t.rowCount || 10) + '"></label></div>' +
      '<div class="muted small" style="margin:6px 0">Each row gets these columns. A row counts as done when the columns marked "must fill" are filled. One date column can be the follow-up date: the call comes back by itself on that day.</div><div class="list" id="cols">' + (t.columns || defaults).map(colRow).join('') + '</div><div style="margin-top:8px"><button class="btn ghost sm" type="button" data-add-col>+ Add a column</button></div></div>' +
      '<div data-kind="checklist"><label>Steps (one per line)<textarea name="steps" placeholder="Check stock&#10;Update the sheet&#10;Send the report">' + esc((t.steps || []).join('\n')) + '</textarea></label></div>' +
      '<div data-kind="count"><div class="row"><label>Target number<input type="number" name="target" min="1" value="' + (t.target || 1) + '"></label><label>Unit<input name="unit" maxlength="20" value="' + esc(t.unit || 'done') + '" placeholder="photos, posts, calls"></label></div></div>' +
      '<div data-carry class="row"><label class="check"><input type="checkbox" name="carry"' + (t.carry !== false ? ' checked' : '') + '> Carry forward what was missed (8 of 10 done means 12 next time)</label><label>Most that can carry over each time<input type="number" name="maxCarry" min="0" max="1000" value="' + (t.maxCarry === undefined ? '' : t.maxCarry) + '" placeholder="same as the target"></label></div>' +
      '<label>Instructions for the team (optional)<textarea name="instructions" maxlength="1000">' + esc(t.instructions || '') + '</textarea></label>' +
      '<div><div class="muted small" style="margin-bottom:6px">Who does this task</div><div class="chips">' + P.users.filter(function (u) { return u.active; }).map(function (u) { return '<label class="check"><input type="checkbox" name="assignee" value="' + esc(u.id) + '"' + ((t.assignees || []).indexOf(u.id) >= 0 ? ' checked' : '') + '> ' + esc(u.name) + '</label>'; }).join('') + '</div></div>' +
      '<div class="actions"><button class="btn" type="submit">' + (t.id ? 'Save changes' : 'Create task') + '</button></div></form>';
  }
  function readDesign(f) {
    var cols = [].map.call(f.querySelectorAll('[data-col]'), function (r) { return { label: r.querySelector('[name=label]').value, type: r.querySelector('[name=type]').value, options: r.querySelector('[name=options]').value, required: r.querySelector('[name=required]').checked, followUp: r.querySelector('[name=followUp]').checked }; }).filter(function (c) { return c.label.trim(); });
    return { name: f.name.value, kind: f.kind.value, schedule: f.schedule.value, dueDate: f.dueDate.value, rowCount: f.rowCount.value, columns: cols, steps: f.steps.value, target: f.target.value, unit: f.unit.value, instructions: f.instructions.value, carry: f.carry.checked, maxCarry: f.maxCarry.value,
      assignees: [].filter.call(f.querySelectorAll('[name=assignee]'), function (c) { return c.checked; }).map(function (c) { return c.value; }) };
  }
  function syncKind(f) {
    [].forEach.call(f.querySelectorAll('[data-kind]'), function (b) { b.hidden = b.dataset.kind !== f.kind.value; });
    f.querySelector('[data-due]').hidden = f.schedule.value !== 'once';
    f.querySelector('[data-carry]').hidden = f.schedule.value === 'once' || f.kind.value === 'checklist';
    [].forEach.call(f.querySelectorAll('[data-col]'), function (r) { r.querySelector('[data-fu-box]').hidden = r.querySelector('[name=type]').value !== 'date'; });
  }
  function memberChecks(name, pre) {
    return P.users.filter(function (u) { return u.active; }).map(function (u) { return '<label class="check"><input type="checkbox" name="' + name + '" value="' + esc(u.id) + '"' + (pre(u) ? ' checked' : '') + '> ' + esc(u.name) + '</label>'; }).join('');
  }
  function templateItem(t) {
    var names = t.assignees.map(function (id) { return esc((P.users.filter(function (u) { return u.id === id; })[0] || {}).name || '?'); }).join(', ') || 'nobody';
    return '<div class="item ' + (t.active ? '' : 'warn') + '"><div class="between"><b>' + esc(t.name) + '</b><span class="chips">' + P.pill(KIND[t.kind]) + P.pill(SCHED[t.schedule]) + (t.carry ? P.pill('carries over') : '') + (t.active ? '' : P.pill('Switched off', 'overdue')) + '</span></div>' +
      '<div class="meta"><span>' + (t.kind === 'rows' ? t.rowCount + ' rows: ' + t.columns.map(function (c) { return esc(c.label); }).join(', ') : t.kind === 'checklist' ? t.steps.length + ' steps' : 'target ' + t.target + ' ' + esc(t.unit)) + '</span><span>For: <b>' + names + '</b></span>' + (t.dueDate ? '<span>Due ' + P.fmtDate(t.dueDate) + '</span>' : '') + '</div>' +
      '<div class="actions">' + (t.adhoc ? '' : '<button class="btn ghost sm" data-edit="' + t.id + '" type="button">Change</button>') + (t.active ? '<button class="btn ghost sm" data-off="' + t.id + '" type="button">Switch off</button>' : '<button class="btn ghost sm" data-on="' + t.id + '" type="button">Switch on</button>') + '<button class="btn ghost sm" style="color:#b91c1c" data-delete="' + t.id + '" data-name="' + esc(t.name) + '" type="button">Delete</button></div></div>';
  }

  P.register({ id: 'designer', label: 'Task designer', roles: ['admin'], order: 1, render: function (el) {
    var editing = null, state = { list: [], presets: [] };
    function load() {
      return Promise.all([P.api('GET', '/api/templates'), P.api('GET', '/api/users')]).then(function (r) {
        P.users = r[1].users;
        var list = r[0].templates, defaults = r[0].defaultColumns; state.list = list; state.presets = r[0].presets;
        var designed = list.filter(function (t) { return !t.adhoc; }), oneTime = list.filter(function (t) { return t.adhoc && t.active; });
        el.innerHTML =
          '<div class="card"><h3>Give a quick task to your team</h3><div class="muted small">For something that comes up today: a one-time task that stays on their list until it is done.</div>' +
          '<form id="quick" class="list"><div class="row"><label style="flex:3 1 240px">What needs to be done<input name="title" required maxlength="80" placeholder="e.g. Send the new price list to dealers"></label><label>Due date<input type="date" name="due" min="' + P.today + '"></label></div>' +
          '<label>Steps (optional, one per line)<textarea name="steps" style="min-height:56px" placeholder="Prepare the PDF&#10;Send on WhatsApp"></textarea></label>' +
          '<div class="chips">' + memberChecks('qassignee', function () { return true; }) + '</div><div class="actions"><button class="btn" type="submit">Give this task</button></div></form></div>' +
          '<div class="card"><h3>Quick start: the usual tasks</h3><div class="muted small">One click creates the task for the people you tick. You can change it afterwards.</div><div class="list">' + state.presets.map(function (p) {
            var made = list.some(function (t) { return t.name === p.name && t.active; });
            return '<form class="item" data-preset="' + p.id + '"><div class="between"><b>' + esc(p.name) + '</b><span class="chips">' + P.pill(SCHED[p.schedule]) + (made ? P.pill('already created', 'ok') : '') + '</span></div><div class="muted small">' + esc(p.instructions) + '</div><div class="chips">' + memberChecks('passignee', function (u) { return p.for === 'both' || u.name.toLowerCase().indexOf(String(p.for).toLowerCase()) === 0; }) + '<button class="btn sm" type="submit">Create</button></div></form>';
          }).join('') + '</div></div>' +
          designForm(editing, defaults) +
          '<div class="card"><h3>Your designed tasks</h3>' + (designed.length ? '<div class="list">' + designed.map(templateItem).join('') + '</div>' : '<div class="muted">Nothing designed yet. Use Quick start above, or design your own.</div>') + '<div class="muted small">A change applies from the next day or week. Work people already started keeps its old shape.</div></div>' +
          (oneTime.length ? '<div class="card"><h3>Quick tasks still open</h3><div class="list">' + oneTime.map(templateItem).join('') + '</div></div>' : '');
        var f = el.querySelector('#design'); syncKind(f);
        f.kind.addEventListener('change', function () { syncKind(f); }); f.schedule.addEventListener('change', function () { syncKind(f); });
        f.addEventListener('change', function (e) { if (e.target.name === 'type') syncKind(f); });
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          P.api(editing ? 'PUT' : 'POST', '/api/templates' + (editing ? '/' + editing.id : ''), readDesign(f)).then(function () { P.toast(editing ? 'Saved' : 'Task created and given to the team'); editing = null; return load(); }).catch(P.fail);
        });
        el.querySelector('#quick').addEventListener('submit', function (e) {
          e.preventDefault(); var q = e.target;
          var steps = q.steps.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
          P.api('POST', '/api/templates', { name: q.title.value, kind: 'checklist', steps: steps.length ? steps : [q.title.value], schedule: 'once', dueDate: q.due.value, adhoc: true, assignees: [].filter.call(q.querySelectorAll('[name=qassignee]'), function (c) { return c.checked; }).map(function (c) { return c.value; }) })
            .then(function () { P.toast('Task given. It is on their list now.'); return load(); }).catch(P.fail);
        });
        [].forEach.call(el.querySelectorAll('[data-preset]'), function (form) {
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            var p = state.presets.filter(function (x) { return x.id === form.dataset.preset; })[0];
            var body = JSON.parse(JSON.stringify(p)); delete body.id; delete body.for;
            body.assignees = [].filter.call(form.querySelectorAll('[name=passignee]'), function (c) { return c.checked; }).map(function (c) { return c.value; });
            P.api('POST', '/api/templates', body).then(function () { P.toast('"' + p.name + '" created and given to the team'); return load(); }).catch(P.fail);
          });
        });
        if (el.__wired) return; el.__wired = true; // the click handler is attached once, however often the screen is redrawn
        el.addEventListener('click', function (e) {
          var t = e.target, ff = el.querySelector('#design');
          if (t.closest('[data-add-col]')) { var d = document.createElement('div'); d.innerHTML = colRow({ type: 'text' }); ff.querySelector('#cols').appendChild(d.firstChild); syncKind(ff); return; }
          var dc = t.closest('[data-del-col]'); if (dc) { dc.closest('[data-col]').remove(); return; }
          if (t.closest('[data-cancel]')) { editing = null; load().catch(P.fail); return; }
          var ed = t.closest('[data-edit]'); if (ed) { editing = state.list.filter(function (x) { return x.id === ed.dataset.edit; })[0]; load().then(function () { window.scrollTo(0, 0); }).catch(P.fail); return; }
          var del = t.closest('[data-delete]');
          if (del) {
            if (!window.confirm('Delete "' + del.dataset.name + '" for good?\n\nThis also erases all the work your team has done under it (every day, for everybody) and cannot be undone.\n\nTo keep the history and just stop it, use "Switch off" instead.')) return;
            P.api('DELETE', '/api/templates/' + del.dataset.delete + '?permanent=1').then(function (r) { P.toast('Deleted' + (r.removedWork ? ' with ' + r.removedWork + ' day' + (r.removedWork === 1 ? '' : 's') + ' of work' : '')); return load(); }).catch(P.fail);
            return;
          }
          var off = t.closest('[data-off]'); if (off) { P.api('DELETE', '/api/templates/' + off.dataset.off).then(function () { P.toast('Switched off'); return load(); }).catch(P.fail); return; }
          var on = t.closest('[data-on]'); if (on) { P.api('PUT', '/api/templates/' + on.dataset.on, { active: true }).then(function () { P.toast('Switched on'); return load(); }).catch(P.fail); }
        });
      });
    }
    return load();
  } });
})();
