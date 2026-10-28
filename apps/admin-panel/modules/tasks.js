// Task designer (owner) and the daily / weekly / one-time work it creates (team). See lib/tasks.js for the kinds of task.
//
// How work appears: the first time somebody opens the panel on a working day, that day's work is created for them.
// What was missed carries forward (8 of 10 calls today -> 12 tomorrow, up to the limit the owner set), a weekly task is one
// card per week, and a call row whose follow-up date has come reappears in "Follow-ups due" until it is logged.
'use strict';
const T = require('../lib/tasks');
const { uid, nowISO, istDate, addDays, diffDays, weekStart, dayOfWeek, isDate, text, str } = require('../lib/util');

const EDIT_WINDOW_DAYS = 7;
const BACKFILL_DAYS = 7;   // working days nobody opened the panel are filled in this far back, so the shortfall chains correctly
const FOLLOWUP_LOOKBACK = 90;
const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5, 6]; // Monday to Saturday

module.exports = function tasks(app, ctx) {
  const templates = () => ctx.col('templates');
  const instances = () => ctx.col('tasks');
  const employeeIds = () => ctx.employees().map((u) => u.id);
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

  function add(template, userId, date, carried) {
    const inst = T.makeInstance(template, userId, date, carried);
    instances().push(inst); ctx.save('tasks');
    return inst;
  }

  // make sure the work for `date` exists for this person; returns it (or null on a day off / not assigned)
  function ensureFor(template, userId, date) {
    if (!template.active || !template.assignees.includes(userId)) return null;
    const mine = mineOf(template, userId);
    if (template.schedule === 'once') return mine[0] || add(template, userId, date, 0);

    if (template.schedule === 'weekly') {
      const monday = weekStart(date);
      const found = mine.find((i) => i.date === monday);
      if (found) return found;
      const prev = mine.filter((i) => i.date < monday).sort((a, b) => b.date.localeCompare(a.date))[0];
      return add(template, userId, monday, carryFrom(template, prev));
    }

    // daily
    const found = mine.find((i) => i.date === date);
    if (found) return found;
    if (!isWorkDay(date)) return null;
    let prev = mine.filter((i) => i.date < date).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (prev) { // fill in the working days in between that nobody opened, so a miss is not forgotten
      let d = addDays(prev.date, 1);
      const earliest = addDays(date, -BACKFILL_DAYS);
      if (d < earliest) d = earliest;
      for (; d < date; d = addDays(d, 1)) {
        if (isWorkDay(d) && !mine.some((i) => i.date === d)) { prev = add(template, userId, d, carryFrom(template, prev)); mine.push(prev); }
      }
    }
    return add(template, userId, date, carryFrom(template, prev));
  }
  function ensureToday(userId) {
    const today = ctx.todayIST();
    for (const t of templates()) ensureFor(t, userId, today);
  }

  // the work one person sees for a day: that day's daily tasks, this week's weekly tasks, and one-time tasks still open
  function forUser(userId, date) {
    if (date === ctx.todayIST()) ensureToday(userId);
    const monday = weekStart(date);
    return instances().filter((i) => i.userId === userId && (i.schedule === 'once' ? (!i.completedAt || istDate(i.completedAt) === date) : i.schedule === 'weekly' ? i.date === monday : i.date === date));
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
  app.get('/api/templates', ctx.requireAdmin, (req, res) => res.json({ templates: templates(), defaultColumns: T.DEFAULT_COLUMNS, presets: T.PRESETS }));

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
    Object.assign(t, r.value); ctx.save('templates');
    for (const id of t.assignees) ensureFor(t, id, ctx.todayIST());
    ctx.log(req.user, 'Changed the task "' + t.name + '"' + (t.active ? '' : ' (switched off)'));
    res.json({ template: t });
  });

  app.delete('/api/templates/:id', ctx.requireAdmin, (req, res) => {
    const t = templates().find((x) => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    t.active = false; ctx.save('templates'); // switched off, not erased: the work already done stays on record
    ctx.log(req.user, 'Switched off the task "' + t.name + '"');
    res.json({ ok: true });
  });

  // ---- the work itself ----
  app.get('/api/tasks', (req, res) => {
    const date = req.query.date && isDate(req.query.date) ? req.query.date : ctx.todayIST();
    let userId = req.user.id;
    if (req.user.role === 'admin') {
      userId = String(req.query.userId || '');
      if (!userId) return res.status(400).json({ error: 'Choose a team member' });
    }
    res.json({ date, tasks: forUser(userId, date).map(view), workDay: isWorkDay(date) });
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
    if (inst.schedule === 'daily' && (inst.date > today || inst.date < addDays(today, -EDIT_WINDOW_DAYS))) { res.status(400).json({ error: 'That day is too old to change' }); return null; }
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
