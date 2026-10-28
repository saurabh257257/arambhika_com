(function () {
  'use strict';
  var P = window.Panel, esc = P.esc;
  var KIND = { rows: 'Fill in rows', checklist: 'Checklist', count: 'Counter' };

  // ---------------- one task, drawn the same way for the team member and for the owner ----------------
  function cellInput(col, value, editable) {
    var dis = editable ? '' : ' disabled', v = esc(value || '');
    if (col.type === 'choice') return '<select name="' + col.key + '"' + dis + '><option value="">' + esc(col.label) + '</option>' + col.options.map(function (o) { return '<option' + (o === value ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
    var type = { phone: 'tel', date: 'date', number: 'number' }[col.type] || 'text';
    return '<input name="' + col.key + '" type="' + type + '" value="' + v + '" placeholder="' + esc(col.label) + (col.required ? ' *' : '') + '" maxlength="200"' + dis + '>';
  }
  function taskCard(t, editable) {
    var pr = t.progress;
    var head = '<div class="th"><div class="between"><h3>' + esc(t.name) + '</h3><span class="chips">' + P.pill(KIND[t.kind]) + (t.schedule === 'once' ? P.pill(t.dueDate ? 'Due ' + P.fmtDate(t.dueDate) : 'One-time', t.dueDate && t.dueDate < P.today && !t.completedAt ? 'overdue' : '') : P.pill('Daily')) + (t.completedAt ? P.pill('Complete', 'ok') : '') + '</span></div>' +
      (t.instructions ? '<div class="muted">' + esc(t.instructions) + '</div>' : '') +
      '<div class="between"><b>' + pr.done + ' of ' + pr.total + ' done (' + pr.percent + '%)</b><span class="stamp">' + (t.updatedAt ? 'Last updated ' + P.stamp(t.updatedAt, t.updatedByName) : 'Not started') + '</span></div>' + P.bar(pr.done, pr.total) + '</div>';
    var body = '';
    if (t.kind === 'rows') {
      var cols = t.columns, n = cols.length;
      body = '<div class="cells" style="--cols:' + n + '"><div class="cellrow head"><span></span>' + cols.map(function (c) { return '<span>' + esc(c.label) + (c.required ? ' *' : '') + '</span>'; }).join('') + '<span></span></div>' +
        t.rows.map(function (r, i) {
          return '<div class="cellrow ' + (t.rowsDone[i] ? 'done' : '') + '" data-task="' + t.id + '" data-i="' + i + '"><span class="no">' + (t.rowsDone[i] ? '&#10003;' : (i + 1)) + '</span>' +
            cols.map(function (c) { return '<span class="cell">' + cellInput(c, (r.values || {})[c.key], editable) + '</span>'; }).join('') +
            (editable ? '<span class="go"><button class="btn sm" type="button" data-save-row>Save</button></span>' : '<span></span>') +
            (r.updatedAt ? '<div class="stampcol stamp">Updated ' + P.stamp(r.updatedAt, r.updatedByName) + '</div>' : '') + '</div>';
        }).join('') + '</div>';
    } else if (t.kind === 'checklist') {
      body = '<div class="steps">' + t.steps.map(function (s, i) {
        return '<label class="step check ' + (s.done ? 'on' : '') + '"><input type="checkbox" data-step="' + i + '" data-task="' + t.id + '"' + (s.done ? ' checked' : '') + (editable ? '' : ' disabled') + '><span class="t">' + esc(s.text) + '</span>' + (s.doneAt ? '<span class="stamp">' + P.fmtTime(s.doneAt) + '</span>' : '') + '</label>';
      }).join('') + '</div>';
    } else {
      body = '<form class="row" style="padding:12px 14px" data-count="' + t.id + '"><label>How many ' + esc(t.unit) + ' (target ' + t.target + ')<input type="number" name="count" min="0" value="' + t.count + '"' + (editable ? '' : ' disabled') + '></label>' +
        '<label style="flex:3 1 240px">Notes or link<input name="notes" maxlength="2000" value="' + esc(t.notes) + '" placeholder="e.g. link of the Instagram post"' + (editable ? '' : ' disabled') + '></label>' + (editable ? '<button class="btn fit" type="submit">Save</button>' : '') + '</form>';
    }
    return '<div class="task" data-card="' + t.id + '">' + head + body + '</div>';
  }

  function wireTasks(el, editable, tasks) {
    var byId = {}; tasks.forEach(function (t) { byId[t.id] = t; });
    function replace(task) { byId[task.id] = task; var old = el.querySelector('[data-card="' + task.id + '"]'); var tmp = document.createElement('div'); tmp.innerHTML = taskCard(task, editable); if (old) old.replaceWith(tmp.firstChild); }
    if (!editable) return;
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-save-row]'); if (!b) return;
      var row = b.closest('.cellrow'), values = {};
      [].forEach.call(row.querySelectorAll('input,select'), function (i) { values[i.name] = i.value; });
      b.disabled = true;
      P.api('PUT', '/api/tasks/' + row.dataset.task + '/rows/' + row.dataset.i, { values: values }).then(function (r) { replace(r.task); P.toast('Saved ' + P.fmtTime(r.task.updatedAt)); }).catch(function (err) { b.disabled = false; P.fail(err); });
    });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.closest('.cellrow') && e.target.tagName === 'INPUT') { e.preventDefault(); e.target.closest('.cellrow').querySelector('[data-save-row]').click(); } });
    el.addEventListener('change', function (e) {
      var c = e.target.closest('[data-step]'); if (!c) return;
      P.api('PUT', '/api/tasks/' + c.dataset.task + '/steps/' + c.dataset.step, { done: c.checked }).then(function (r) { replace(r.task); }).catch(function (err) { c.checked = !c.checked; P.fail(err); });
    });
    el.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-count]'); if (!f) return; e.preventDefault();
      P.api('PUT', '/api/tasks/' + f.dataset.count + '/count', { count: f.count.value, notes: f.notes.value }).then(function (r) { replace(r.task); P.toast('Saved ' + P.fmtTime(r.task.updatedAt)); }).catch(P.fail);
    });
  }

  // ---------------- the team member's tasks ----------------
  P.register({ id: 'tasks', label: 'Tasks', roles: ['employee'], order: 1, render: function (el) {
    var date = P.today;
    function load() {
      return P.api('GET', '/api/tasks?date=' + date).then(function (r) {
        var done = r.tasks.reduce(function (s, t) { return s + t.progress.done; }, 0), total = r.tasks.reduce(function (s, t) { return s + t.progress.total; }, 0);
        el.innerHTML = '<div class="card"><div class="row"><label>Day<input type="date" id="td" value="' + date + '" max="' + P.today + '" min="' + P.addDays(P.today, -7) + '"></label><div><h3>' + (date === P.today ? 'Today' : P.fmtDate(date)) + '</h3><div class="muted">' + done + ' of ' + total + ' done &middot; ' + (total - done) + ' left</div></div></div>' + (total ? P.bar(done, total) : '') + '</div>' +
          (r.tasks.length ? r.tasks.map(function (t) { return taskCard(t, true); }).join('') : P.empty('No tasks for this day.'));
        el.querySelector('#td').addEventListener('change', function (e) { if (e.target.value) { date = e.target.value; load().catch(P.fail); } });
        wireTasks(el, true, r.tasks);
      });
    }
    return load();
  } });

  // ---------------- the owner looks at somebody's work ----------------
  P.register({ id: 'work', label: 'Team work', roles: ['admin'], order: 2, render: function (el) {
    var date = P.today;
    function load() {
      var who = P.viewAs || (P.users.filter(function (u) { return u.active; })[0] || {}).id || '';
      if (!who) { el.innerHTML = P.empty('Add team members first.'); return Promise.resolve(); }
      return P.api('GET', '/api/tasks?userId=' + who + '&date=' + date).then(function (r) {
        el.innerHTML = '<div class="card"><div class="row"><label>Team member<select id="wu">' + P.userOptions(who) + '</select></label><label>Day<input type="date" id="wd" value="' + date + '" max="' + P.today + '"></label></div></div>' +
          (r.tasks.length ? r.tasks.map(function (t) { return taskCard(t, false); }).join('') : P.empty('No tasks for them on this day.'));
        el.querySelector('#wu').addEventListener('change', function (e) { P.viewAs = e.target.value; load().catch(P.fail); });
        el.querySelector('#wd').addEventListener('change', function (e) { if (e.target.value) { date = e.target.value; load().catch(P.fail); } });
      });
    }
    return load();
  } });

  // ---------------- the task designer (owner) ----------------
  function colRow(c) {
    return '<div class="col-edit" data-col><label>Column name<input name="label" value="' + esc(c.label || '') + '" maxlength="30"></label><label>Type<select name="type">' + ['text', 'phone', 'choice', 'date', 'number'].map(function (t) { return '<option' + (c.type === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></label>' +
      '<label>Choices (comma separated)<input name="options" value="' + esc((c.options || []).join(', ')) + '" placeholder="only for type choice"></label><label class="check"><input type="checkbox" name="required"' + (c.required ? ' checked' : '') + '> must fill</label><button class="btn ghost sm" type="button" data-del-col>Remove</button></div>';
  }
  function designForm(t, defaults) {
    t = t || { kind: 'rows', schedule: 'daily', assignees: [], active: true, rowCount: 10, columns: defaults, steps: [], target: 1, unit: 'done' };
    return '<form class="card" id="design"><div class="between"><h3>' + (t.id ? 'Change this task' : 'Design a new task') + '</h3>' + (t.id ? '<button class="btn ghost sm" type="button" data-cancel>Cancel</button>' : '') + '</div>' +
      '<div class="row"><label style="flex:3 1 240px">Task name<input name="name" value="' + esc(t.name || '') + '" maxlength="80" required placeholder="e.g. Call 10 people"></label>' +
      '<label>What kind of task<select name="kind"><option value="rows"' + (t.kind === 'rows' ? ' selected' : '') + '>Fill in rows (calls, visits, entries)</option><option value="checklist"' + (t.kind === 'checklist' ? ' selected' : '') + '>Checklist (steps to tick)</option><option value="count"' + (t.kind === 'count' ? ' selected' : '') + '>Counter (a number and a note)</option></select></label>' +
      '<label>How often<select name="schedule"><option value="daily"' + (t.schedule === 'daily' ? ' selected' : '') + '>Every day</option><option value="once"' + (t.schedule === 'once' ? ' selected' : '') + '>One time (stays until done)</option></select></label>' +
      '<label data-due>Due date<input type="date" name="dueDate" value="' + esc(t.dueDate || '') + '"></label></div>' +
      '<div data-kind="rows"><div class="row"><label>How many rows<input type="number" name="rowCount" min="1" max="200" value="' + (t.rowCount || 10) + '"></label></div>' +
      '<div class="muted small" style="margin:6px 0">Each row gets these columns. A row counts as done when the columns marked "must fill" are filled.</div><div class="list" id="cols">' + (t.columns || defaults).map(colRow).join('') + '</div><div style="margin-top:8px"><button class="btn ghost sm" type="button" data-add-col>+ Add a column</button></div></div>' +
      '<div data-kind="checklist"><label>Steps (one per line)<textarea name="steps" placeholder="Check stock&#10;Update the sheet&#10;Send the report">' + esc((t.steps || []).join('\n')) + '</textarea></label></div>' +
      '<div data-kind="count"><div class="row"><label>Target number<input type="number" name="target" min="1" value="' + (t.target || 1) + '"></label><label>Unit<input name="unit" maxlength="20" value="' + esc(t.unit || 'done') + '" placeholder="photos, posts, calls"></label></div></div>' +
      '<label>Instructions for the team (optional)<textarea name="instructions" maxlength="1000">' + esc(t.instructions || '') + '</textarea></label>' +
      '<div><div class="muted small" style="margin-bottom:6px">Who does this task</div><div class="chips">' + P.users.filter(function (u) { return u.active; }).map(function (u) { return '<label class="check"><input type="checkbox" name="assignee" value="' + esc(u.id) + '"' + ((t.assignees || []).indexOf(u.id) >= 0 ? ' checked' : '') + '> ' + esc(u.name) + '</label>'; }).join('') + '</div></div>' +
      '<div class="actions"><button class="btn" type="submit">' + (t.id ? 'Save changes' : 'Create task') + '</button></div></form>';
  }
  function readDesign(f) {
    var cols = [].map.call(f.querySelectorAll('[data-col]'), function (r) { return { label: r.querySelector('[name=label]').value, type: r.querySelector('[name=type]').value, options: r.querySelector('[name=options]').value, required: r.querySelector('[name=required]').checked }; }).filter(function (c) { return c.label.trim(); });
    return { name: f.name.value, kind: f.kind.value, schedule: f.schedule.value, dueDate: f.dueDate.value, rowCount: f.rowCount.value, columns: cols, steps: f.steps.value, target: f.target.value, unit: f.unit.value, instructions: f.instructions.value,
      assignees: [].filter.call(f.querySelectorAll('[name=assignee]'), function (c) { return c.checked; }).map(function (c) { return c.value; }) };
  }
  function syncKind(f) {
    [].forEach.call(f.querySelectorAll('[data-kind]'), function (b) { b.hidden = b.dataset.kind !== f.kind.value; });
    f.querySelector('[data-due]').hidden = f.schedule.value !== 'once';
  }

  P.register({ id: 'designer', label: 'Task designer', roles: ['admin'], order: 1, render: function (el) {
    var editing = null, state = { list: [] };
    function load() {
      return Promise.all([P.api('GET', '/api/templates'), P.api('GET', '/api/users')]).then(function (r) {
        P.users = r[1].users;
        var list = r[0].templates, defaults = r[0].defaultColumns; state.list = list;
        el.innerHTML = designForm(editing, defaults) +
          '<div class="card"><h3>Your tasks</h3>' + (list.length ? '<div class="list">' + list.map(function (t) {
            return '<div class="item ' + (t.active ? '' : 'warn') + '"><div class="between"><b>' + esc(t.name) + '</b><span class="chips">' + P.pill(KIND[t.kind]) + P.pill(t.schedule === 'once' ? 'One time' : 'Daily') + (t.active ? '' : P.pill('Switched off', 'overdue')) + '</span></div>' +
              '<div class="meta"><span>' + (t.kind === 'rows' ? t.rowCount + ' rows: ' + t.columns.map(function (c) { return esc(c.label); }).join(', ') : t.kind === 'checklist' ? t.steps.length + ' steps' : 'target ' + t.target + ' ' + esc(t.unit)) + '</span><span>For: <b>' + (t.assignees.map(function (id) { return esc((P.users.filter(function (u) { return u.id === id; })[0] || {}).name || '?'); }).join(', ') || 'nobody') + '</b></span></div>' +
              '<div class="actions"><button class="btn ghost sm" data-edit="' + t.id + '" type="button">Change</button>' + (t.active ? '<button class="btn ghost sm" data-off="' + t.id + '" type="button">Switch off</button>' : '<button class="btn ghost sm" data-on="' + t.id + '" type="button">Switch on</button>') + '</div></div>';
          }).join('') + '</div>' : '<div class="muted">No tasks designed yet. Create the first one above, for example "Call 10 people".</div>') + '<div class="muted small">A change to a task applies from the next day. Work people already started keeps its old shape.</div></div>';
        var f = el.querySelector('#design'); syncKind(f);
        f.kind.addEventListener('change', function () { syncKind(f); }); f.schedule.addEventListener('change', function () { syncKind(f); });
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          var body = readDesign(f);
          P.api(editing ? 'PUT' : 'POST', '/api/templates' + (editing ? '/' + editing.id : ''), body).then(function () { P.toast(editing ? 'Saved' : 'Task created and given to the team'); editing = null; return load(); }).catch(P.fail);
        });
        if (el.__wired) return; el.__wired = true; // the click handler is attached once, however often the screen is redrawn
        el.addEventListener('click', function (e) {
          var t = e.target, f = el.querySelector('#design');
          if (t.closest('[data-add-col]')) { var d = document.createElement('div'); d.innerHTML = colRow({ type: 'text' }); f.querySelector('#cols').appendChild(d.firstChild); return; }
          var dc = t.closest('[data-del-col]'); if (dc) { dc.closest('[data-col]').remove(); return; }
          if (t.closest('[data-cancel]')) { editing = null; load().catch(P.fail); return; }
          var ed = t.closest('[data-edit]'); if (ed) { editing = state.list.filter(function (x) { return x.id === ed.dataset.edit; })[0]; load().then(function () { window.scrollTo(0, 0); }).catch(P.fail); return; }
          var off = t.closest('[data-off]'); if (off) { P.api('DELETE', '/api/templates/' + off.dataset.off).then(function () { P.toast('Switched off'); return load(); }).catch(P.fail); return; }
          var on = t.closest('[data-on]'); if (on) { P.api('PUT', '/api/templates/' + on.dataset.on, { active: true }).then(function () { P.toast('Switched on'); return load(); }).catch(P.fail); }
        });
      });
    }
    return load();
  } });
})();
