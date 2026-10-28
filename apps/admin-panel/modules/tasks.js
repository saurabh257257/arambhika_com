// Task designer (owner) and the daily work it creates (team). See lib/tasks.js for the three kinds of task.
'use strict';
const T = require('../lib/tasks');
const { uid, nowISO, istDate, addDays } = require('../lib/util');

const EDIT_WINDOW_DAYS = 7;

module.exports = function tasks(app, ctx) {
  const templates = () => ctx.col('templates');
  const instances = () => ctx.col('tasks');
  const employeeIds = () => ctx.employees().map((u) => u.id);

  // a daily task appears for each assigned person every day; a one-time task appears once and stays until it is done
  function ensureFor(template, userId, date) {
    if (!template.active || !template.assignees.includes(userId)) return null;
    const list = instances();
    const found = list.find((i) => i.templateId === template.id && i.userId === userId && (template.schedule === 'once' || i.date === date));
    if (found) return found;
    const inst = T.makeInstance(template, userId, date);
    list.push(inst); ctx.save('tasks');
    return inst;
  }
  function ensureToday(userId) {
    const today = ctx.todayIST();
    for (const t of templates()) ensureFor(t, userId, today);
  }

  // the work one person sees for a day: that day's daily tasks, and one-time tasks that are still open
  function forUser(userId, date) {
    const today = ctx.todayIST();
    if (date === today) ensureToday(userId);
    return instances().filter((i) => i.userId === userId && (i.schedule === 'once' ? (!i.completedAt || istDate(i.completedAt) === date) : i.date === date));
  }
  const view = (i) => { const u = T.units(i); return { ...i, progress: { done: u.done, total: u.total, percent: u.total ? Math.round(u.done / u.total * 100) : 100 }, rowsDone: i.kind === 'rows' ? i.rows.map((r) => T.rowDone(i, r)) : undefined }; };
  ctx.tasks = { forUser, units: T.units };

  // ---- the designer (owner only) ----
  app.get('/api/templates', ctx.requireAdmin, (req, res) => res.json({ templates: templates(), defaultColumns: T.DEFAULT_COLUMNS }));

  app.post('/api/templates', ctx.requireAdmin, (req, res) => {
    const r = T.validateTemplate(req.body || {}, employeeIds());
    if (r.error) return res.status(400).json({ error: r.error });
    const t = { id: uid(), ...r.value, createdAt: nowISO() };
    templates().push(t); ctx.save('templates');
    for (const id of t.assignees) ensureFor(t, id, ctx.todayIST());
    ctx.log(req.user, 'Designed the task "' + t.name + '" for ' + t.assignees.map(ctx.userName).join(', '));
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
    const date = req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : ctx.todayIST();
    let userId = req.user.id;
    if (req.user.role === 'admin') {
      userId = String(req.query.userId || '');
      if (!userId) return res.status(400).json({ error: 'Choose a team member' });
    }
    res.json({ date, tasks: forUser(userId, date).map(view) });
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
    row.values = values;
    const at = touched(inst, req.user, 'row ' + (Number(req.params.index) + 1));
    row.updatedAt = at; row.updatedByName = req.user.name; ctx.save('tasks');
    res.json({ task: view(inst) });
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
    inst.count = count; inst.notes = String(req.body.notes == null ? '' : req.body.notes).replace(/\r/g, '').trim().slice(0, 2000);
    touched(inst, req.user, 'now ' + count + ' ' + inst.unit);
    res.json({ task: view(inst) });
  });
};
