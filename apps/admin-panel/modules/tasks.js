// Task designer (owner) and the daily / weekly / one-time work it creates (team). See lib/tasks.js for the kinds of task.
//
// How work appears: the first time somebody opens the panel on a working day, that day's work is created for them.
// What was missed carries forward (8 of 10 calls today -> 12 tomorrow, up to the limit the owner set), a weekly task is one
// card per week, and a call row whose follow-up date has come reappears in "Follow-ups due" until it is logged.
'use strict';
const T = require('../lib/tasks');
const { uid, nowISO, istDate, addDays, diffDays, weekStart, dayOfWeek, isDate, text, str } = require('../lib/util');

const EDIT_WINDOW_DAYS = 7;
const FUTURE_DAYS = 7;    // a person may work up to a week ahead
const BACKFILL_DAYS = 7;   // working days nobody opened the panel are filled in this far back, so the shortfall chains correctly
const FOLLOWUP_LOOKBACK = 90;
const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5, 6]; // Monday to Saturday

module.exports = function tasks(app, ctx) {
  const templates = () => ctx.col('templates');
  const instances = () => ctx.col('tasks');
  const employeeIds = () => ['admin', ...ctx.employees().map((u) => u.id)]; // the owner can give tasks to themselves too
  const workDays = () => { const w = ctx.settings().workDays; return Array.isArray(w) && w.length ? w : DEFAULT_WORK_DAYS; };
  const isWorkDay = (date) => workDays().includes(dayOfWeek(date));
  const mineOf = (template, userId) => instances().filter((i) => i.templateId === template.id && i.userId === userId);
  const shortfall = (inst) => { const u = T.units(inst); return Math.max(0, u.total - u.done); };
  // tasks created before carry-over existed have no setting: daily and weekly ones carry forward by default, up to their own target
  const carryFrom = (template, prev) => {
    const on = template.carry === undefined ? template.schedule !== 'once' : template.carry;
    if (!on || !prev || template.kind === 'checklist') return 0;
    const cap = template.maxCarry === undefined ? (template.rowCount || template.target || 1000) : template.maxCarry;
    return Math.min(cap, shortfall(prev));
  };

  function add(template, userId, date, carried, ahead = false) {
    const inst = T.makeInstance(template, userId, date, carried);
    if (ahead) inst.ahead = true; // started before its day: the carry-over is added when the day arrives
    instances().push(inst); ctx.save('tasks');
    return inst;
  }

  // make sure the work for `date` exists for this person; returns it (or null on a day off / not assigned)
  function ensureFor(template, userId, date) {
    if (!template.active || !template.assignees.includes(userId)) return null;
    const mine = mineOf(template, userId);
    const today = ctx.todayIST();
    const byDate = (x, y) => x.date.localeCompare(y.date);
    if (template.schedule === 'once') return mine[0] || add(template, userId, date, 0);

    if (template.schedule === 'weekly') {
      const monday = weekStart(date);
      const found = mine.find((i) => i.date === monday);
      if (monday > weekStart(today)) return found || add(template, userId, monday, 0, true); // next week, started early
      const prev = mine.filter((i) => i.date < monday).sort(byDate).pop();
      if (found) { if (found.ahead) { T.topUp(found, carryFrom(template, prev)); ctx.save('tasks'); } return found; }
      return add(template, userId, monday, carryFrom(template, prev));
    }

    // daily, in the future: a person working ahead gets the sheet without any carry-over (it is added when that day comes)
    if (date > today) {
      const f = mine.find((i) => i.date === date);
      if (f || !isWorkDay(date)) return f || null;
      return add(template, userId, date, 0, true);
    }

    // daily, today: every working day from the last one up to today exists and is settled, so a miss is carried and
    // work that was started ahead gets its carry-over now. Working days nobody opened are filled in (up to a week back).
    const earliest = addDays(date, -BACKFILL_DAYS);
    const sorted = mine.slice().sort(byDate);
    let prev = sorted.filter((i) => i.date < earliest).pop();
    const first = sorted.find((i) => i.date >= earliest && i.date <= date);
    let d = prev ? earliest : (first ? first.date : date);
    for (; d <= date; d = addDays(d, 1)) {
      if (!isWorkDay(d)) continue;
      let inst = mine.find((i) => i.date === d);
      if (!inst) { inst = add(template, userId, d, carryFrom(template, prev)); mine.push(inst); }
      else if (inst.ahead) { T.topUp(inst, carryFrom(template, prev)); ctx.save('tasks'); }
      prev = inst;
    }
    return mine.find((i) => i.date === date) || null;
  }
  function ensureToday(userId) {
    const today = ctx.todayIST();
    for (const t of templates()) ensureFor(t, userId, today);
  }

  // the work one person sees for a day: that day's daily tasks, this week's weekly tasks, and one-time tasks still open
  function forUser(userId, date) {
    const today = ctx.todayIST();
    if (date === today) ensureToday(userId);
    else if (date > today && date <= addDays(today, FUTURE_DAYS)) for (const t of templates()) ensureFor(t, userId, date); // working ahead
    const monday = weekStart(date);
    const stale = (i) => { const t = templates().find((x) => x.id === i.templateId); return Boolean(t) && t.schedule !== i.schedule && !i.updatedAt && T.units(i).done === 0; };
    return instances().filter((i) => i.userId === userId && !stale(i) && (i.schedule === 'once' ? (!i.completedAt || istDate(i.completedAt) === date) : i.schedule === 'weekly' ? i.date === monday : i.date === date));
  }
  const view = (i) => { const u = T.units(i); return { ...i, progress: { done: u.done, total: u.total, percent: u.total ? Math.round(u.done / u.total * 100) : 100 }, rowsDone: i.kind === 'rows' ? i.rows.map((r) => T.rowDone(i, r)) : undefined }; };

  // ---- follow-ups: call rows whose follow-up date has come (or passed) and are not closed yet ----
  function followupsDue(userId) {
    const today = ctx.todayIST(); const out = [];
    for (const inst of instances()) {
      if (inst.userId !== userId || inst.kind !== 'rows') continue;
      const key = T.followUpKey(inst.columns); if (!key) continue;
      if (inst.date < addDays(today, -FOLLOWUP_LOOKBACK)) continue;
      inst.rows.forEach((row, index) => {
        const due = (row.values || {})[key];
        if (!due || due > today) return;
        out.push({ taskId: inst.id, taskName: inst.name, rowIndex: index, dueDate: due, daysLate: diffDays(today, due),
          details: inst.columns.filter((c) => c.key !== key).map((c) => ({ label: c.label, value: (row.values || {})[c.key] || '' })).filter((d) => d.value),
          calledOn: inst.date, history: row.history || [] });
      });
    }
    return out.sort((a, b) => b.daysLate - a.daysLate);
  }
  // how many follow-ups this person logged today (they count as done work)
  function followupsDoneToday(userId) {
    const today = ctx.todayIST(); let n = 0;
    for (const inst of instances()) {
      if (inst.userId !== userId || inst.kind !== 'rows' || !T.followUpKey(inst.columns)) continue;
      for (const row of inst.rows) if ((row.history || []).some((h) => istDate(h.at) === today)) n += 1;
    }
    return n;
  }
  ctx.tasks = { forUser, units: T.units, followupsDue, followupsDoneToday, isWorkDay, workDays };

  // ---- the designer (owner only) ----
  app.get('/api/templates', ctx.requireAdmin, (req, res) => res.json({ templates: templates(), defaultColumns: T.DESIGNER_COLUMNS, presets: T.PRESETS }));

  app.post('/api/templates', ctx.requireAdmin, (req, res) => {
    const r = T.validateTemplate(req.body || {}, employeeIds());
    if (r.error) return res.status(400).json({ error: r.error });
    const t = { id: uid(), ...r.value, createdAt: nowISO() };
    templates().push(t); ctx.save('templates');
    for (const id of t.assignees) ensureFor(t, id, ctx.todayIST());
    ctx.log(req.user, (t.adhoc ? 'Gave a one-time task "' : 'Designed the task "') + t.name + '" to ' + t.assignees.map(ctx.userName).join(', '));
    res.json({ template: t });
  });

  app.put('/api/templates/:id', ctx.requireAdmin, (req, res) => {
    const t = templates().find((x) => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    const r = T.validateTemplate({ ...t, ...(req.body || {}) }, employeeIds());
    if (r.error) return res.status(400).json({ error: r.error });
    const oldSchedule = t.schedule;
    Object.assign(t, r.value); ctx.save('templates');
    if (oldSchedule !== t.schedule) { // copies of the old kind that nobody started are removed, so the task is not listed twice
      const all = instances();
      for (let n = all.length - 1; n >= 0; n -= 1) if (all[n].templateId === t.id && all[n].schedule === oldSchedule && !all[n].updatedAt && T.units(all[n]).done === 0) all.splice(n, 1);
      ctx.save('tasks');
    }
    for (const id of t.assignees) ensureFor(t, id, ctx.todayIST());
    ctx.log(req.user, 'Changed the task "' + t.name + '"' + (t.active ? '' : ' (switched off)'));
    res.json({ template: t });
  });

  // Without ?permanent=1 the task is only switched off (the work already done stays on record).
  // With ?permanent=1 the task is deleted for good, together with all the work done under it, for every person.
  app.delete('/api/templates/:id', ctx.requireAdmin, (req, res) => {
    const list = templates(); const at = list.findIndex((x) => x.id === req.params.id);
    if (at < 0) return res.status(404).json({ error: 'Not found' });
    const t = list[at];
    if (req.query.permanent === '1') {
      const all = instances(); let removed = 0;
      for (let i = all.length - 1; i >= 0; i -= 1) if (all[i].templateId === t.id) { all.splice(i, 1); removed += 1; }
      list.splice(at, 1); ctx.save('templates'); ctx.save('tasks');
      ctx.log(req.user, 'Deleted the task "' + t.name + '"' + (removed ? ' and ' + removed + ' day' + (removed === 1 ? '' : 's') + ' of work under it' : ''));
      return res.json({ ok: true, deleted: true, removedWork: removed });
    }
    t.active = false; ctx.save('templates'); // switched off, not erased: the work already done stays on record
    ctx.log(req.user, 'Switched off the task "' + t.name + '"');
    res.json({ ok: true });
  });

  // ---- the work itself ----
  app.get('/api/tasks', (req, res) => {
    const date = req.query.date && isDate(req.query.date) ? req.query.date : ctx.todayIST();
    let userId = req.user.id;
    if (req.user.role === 'admin') {
      userId = String(req.query.userId || 'admin'); // no person chosen: the owner's own tasks
    }
    if (req.user.role !== 'admin' && date > addDays(ctx.todayIST(), FUTURE_DAYS)) return res.status(400).json({ error: 'You can work up to a week ahead, no further' });
    res.json({ date, tasks: forUser(userId, date).map(view), workDay: isWorkDay(date), ahead: date > ctx.todayIST() });
  });

  // the week at a glance (Monday to Sunday): each day's progress, and this week's weekly tasks. Days ahead show what is planned.
  app.get('/api/week', (req, res) => {
    let userId = req.user.id;
    if (req.user.role === 'admin') userId = String(req.query.userId || 'admin');
    const today = ctx.todayIST();
    const monday = weekStart(req.query.date && isDate(req.query.date) ? req.query.date : today);
    if (monday <= today && addDays(monday, 6) >= today) ensureToday(userId);
    const mineT = templates().filter((t) => t.active && t.assignees.includes(userId));
    const baseOf = (t) => (t.kind === 'rows' ? t.rowCount : t.kind === 'count' ? t.target : 0);
    const summary = (list) => list.map((i) => { const u = T.units(i); return { name: i.name, done: u.done, total: u.total, carried: i.carried || 0, ahead: Boolean(i.ahead) }; });
    const days = [];
    for (let n = 0; n < 7; n += 1) {
      const d = addDays(monday, n);
      const insts = instances().filter((i) => i.userId === userId && i.schedule === 'daily' && i.date === d);
      let tasksOf = summary(insts); let planned = false;
      if (!insts.length && d > today && isWorkDay(d)) { tasksOf = mineT.filter((t) => t.schedule === 'daily' && baseOf(t)).map((t) => ({ name: t.name, done: 0, total: baseOf(t), carried: 0, ahead: false })); planned = true; }
      const done = tasksOf.reduce((s, x) => s + x.done, 0); const total = tasksOf.reduce((s, x) => s + x.total, 0);
      days.push({ date: d, dow: dayOfWeek(d), isToday: d === today, isFuture: d > today, isWorkDay: isWorkDay(d), tasks: tasksOf, done, total, percent: total ? Math.round(done / total * 100) : null, planned,
        editable: d >= addDays(today, -EDIT_WINDOW_DAYS) && d <= addDays(today, FUTURE_DAYS) });
    }
    let weekly = summary(instances().filter((i) => i.userId === userId && i.schedule === 'weekly' && i.date === monday));
    if (!weekly.length && monday > weekStart(today)) weekly = mineT.filter((t) => t.schedule === 'weekly' && baseOf(t)).map((t) => ({ name: t.name, done: 0, total: baseOf(t), carried: 0, ahead: false, planned: true }));
    const sum = days.reduce((s, x) => ({ done: s.done + x.done, total: s.total + x.total }), { done: 0, total: 0 });
    res.json({ weekStart: monday, weekEnd: addDays(monday, 6), today, days, weekly, totals: sum, minDate: addDays(today, -EDIT_WINDOW_DAYS), maxDate: addDays(today, FUTURE_DAYS) });
  });

  app.get('/api/followups-due', (req, res) => {
    if (req.user.role === 'admin') {
      const who = req.query.userId ? [req.query.userId] : ctx.employees().map((u) => u.id);
      return res.json({ followups: who.flatMap((id) => followupsDue(id).map((f) => ({ ...f, userId: id, userName: ctx.userName(id) }))) });
    }
    ensureToday(req.user.id);
    res.json({ followups: followupsDue(req.user.id) });
  });

  function mine(req, res) {
    const inst = instances().find((i) => i.id === req.params.id && i.userId === req.user.id);
    if (!inst) { res.status(404).json({ error: 'Task not found' }); return null; }
    const today = ctx.todayIST();
    if (inst.schedule === 'daily' && inst.date > addDays(today, FUTURE_DAYS)) { res.status(400).json({ error: 'You can work up to a week ahead, no further' }); return null; }
    if (inst.schedule === 'daily' && inst.date < addDays(today, -EDIT_WINDOW_DAYS)) { res.status(400).json({ error: 'That day is too old to change' }); return null; }
    return inst;
  }
  function touched(inst, user, what) {
    const at = nowISO();
    inst.updatedAt = at; inst.updatedByName = user.name;
    const u = T.units(inst);
    if (u.total && u.done >= u.total) { if (!inst.completedAt) inst.completedAt = at; } else inst.completedAt = '';
    ctx.save('tasks');
    ctx.log(user, 'Updated "' + inst.name + '": ' + what + ' (' + u.done + '/' + u.total + ')');
    return at;
  }

  app.put('/api/tasks/:id/rows/:index', (req, res) => {
    const inst = mine(req, res); if (!inst) return;
    if (inst.kind !== 'rows') return res.status(400).json({ error: 'This task has no rows' });
    const row = inst.rows[Number(req.params.index)];
    if (!row) return res.status(404).json({ error: 'No such row' });
    const values = {};
    for (const col of inst.columns) {
      const r = T.readCell(col, (req.body.values || {})[col.key]);
      if (r.error) return res.status(400).json({ error: r.error });
      values[col.key] = r.value;
    }
    const key = T.followUpKey(inst.columns);
    if (key && values[key] && values[key] <= ctx.todayIST() && !(row.values && row.values[key] === values[key])) return res.status(400).json({ error: 'The follow-up date must be after today' });
    row.values = values;
    const at = touched(inst, req.user, 'row ' + (Number(req.params.index) + 1));
    row.updatedAt = at; row.updatedByName = req.user.name; ctx.save('tasks');
    res.json({ task: view(inst) });
  });

  // log a follow-up call on a row: what was said, and when to follow up next (empty = no more follow-up)
  app.post('/api/tasks/:id/rows/:index/followup', (req, res) => {
    const inst = instances().find((i) => i.id === req.params.id && i.userId === req.user.id);
    if (!inst || inst.kind !== 'rows') return res.status(404).json({ error: 'Task not found' });
    const key = T.followUpKey(inst.columns);
    const row = inst.rows[Number(req.params.index)];
    if (!key || !row) return res.status(404).json({ error: 'No such call' });
    const notes = text(req.body.notes, 1000);
    if (notes.length < 2) return res.status(400).json({ error: 'Write what you talked about' });
    const next = req.body.nextDate ? String(req.body.nextDate) : '';
    if (next && (!isDate(next) || next <= ctx.todayIST())) return res.status(400).json({ error: 'The next follow-up must be a date after today (or leave it empty if there is nothing more to do)' });
    const at = nowISO();
    row.history = row.history || [];
    row.history.push({ at, byName: req.user.name, notes, nextDate: next });
    row.values[key] = next;
    ctx.save('tasks');
    ctx.log(req.user, 'Follow-up call on "' + inst.name + '" row ' + (Number(req.params.index) + 1) + (next ? ', next on ' + next : ', closed'));
    res.json({ ok: true, nextDate: next, followups: followupsDue(req.user.id) });
  });

  app.put('/api/tasks/:id/steps/:index', (req, res) => {
    const inst = mine(req, res); if (!inst) return;
    if (inst.kind !== 'checklist') return res.status(400).json({ error: 'This task has no steps' });
    const step = inst.steps[Number(req.params.index)];
    if (!step) return res.status(404).json({ error: 'No such step' });
    step.done = Boolean(req.body.done); step.doneAt = step.done ? nowISO() : '';
    touched(inst, req.user, (step.done ? 'ticked ' : 'unticked ') + '"' + step.text + '"');
    res.json({ task: view(inst) });
  });

  app.put('/api/tasks/:id/count', (req, res) => {
    const inst = mine(req, res); if (!inst) return;
    if (inst.kind !== 'count') return res.status(400).json({ error: 'This task is not a counter' });
    const count = Math.round(Number(req.body.count));
    if (!Number.isFinite(count) || count < 0 || count > 100000) return res.status(400).json({ error: 'Enter a number' });
    inst.count = count; inst.notes = text(req.body.notes, 2000);
    touched(inst, req.user, 'now ' + count + ' ' + inst.unit);
    res.json({ task: view(inst) });
  });
};
