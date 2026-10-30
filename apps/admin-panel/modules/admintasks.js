// Admin tasks: the owner's own to-do list, including jobs that come back (follow up with Vikas every day, a weekly invoice update).
// A repeating task has one "next due" date; ticking it done writes the date it was done and moves next due to the next occurrence.
'use strict';
const { str, text, uid, nowISO, isDate, addDays, dayOfWeek, diffDays } = require('../lib/util');

const REPEATS = ['once', 'daily', 'weekly', 'monthly'];
const STARTER = [
  { title: 'Follow up with Vikas', notes: 'Ask what is pending and what he needs from me', repeat: 'daily' },
  { title: 'Follow up with Lokesh', notes: 'Ask what is pending and what he needs from me', repeat: 'daily' },
  { title: 'Inventory sync up', notes: 'Match the stock in Zoho with what is on the shelf', repeat: 'weekly', days: [5] },
  { title: 'Weekly invoice update', notes: 'Check unpaid and overdue invoices and chase them', repeat: 'weekly', days: [6] },
];

// the first date after `from` on which the task comes round again (null for a one-time task)
function nextAfter(t, from) {
  if (t.repeat === 'daily') return addDays(from, 1);
  if (t.repeat === 'weekly') {
    for (let i = 1; i <= 7; i++) { const d = addDays(from, i); if (t.days.includes(dayOfWeek(d))) return d; }
  }
  if (t.repeat === 'monthly') {
    const [y, m] = from.split('-').map(Number);
    for (let k = 1; k <= 2; k++) {
      const first = new Date(Date.UTC(y, m - 1 + k, 1));
      const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
      const d = first.toISOString().slice(0, 8) + String(Math.min(t.dayOfMonth, last)).padStart(2, '0');
      if (d > from) return d;
    }
  }
  return null;
}
// the first date on or after `from` the task falls on (used when it is created or its repeat is changed)
const firstOn = (t, from) => (t.repeat === 'once' ? from : (t.repeat === 'daily' || (t.repeat === 'weekly' && t.days.includes(dayOfWeek(from))) || (t.repeat === 'monthly' && nextAfter(t, addDays(from, -1)) === from)) ? from : nextAfter(t, from));

module.exports = function adminTasks(app, ctx) {
  const list = () => ctx.col('admintasks');
  const only = ctx.requireAdmin;

  function read(body) {
    const title = str(body.title, 120);
    if (!title) return { error: 'Give the task a name' };
    const repeat = REPEATS.includes(body.repeat) ? body.repeat : 'once';
    const v = { title, notes: text(body.notes, 1000), repeat, days: [], dayOfMonth: 1 };
    if (repeat === 'weekly') {
      v.days = [...new Set((Array.isArray(body.days) ? body.days : []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort();
      if (!v.days.length) return { error: 'Pick at least one day of the week' };
    }
    if (repeat === 'monthly') {
      v.dayOfMonth = Math.round(Number(body.dayOfMonth));
      if (!(v.dayOfMonth >= 1 && v.dayOfMonth <= 31)) return { error: 'Pick a day of the month (1 to 31)' };
    }
    if (body.dueDate && !isDate(body.dueDate)) return { error: 'Bad date' };
    return { value: v, dueDate: body.dueDate || '' };
  }
  const view = (t) => {
    const today = ctx.todayIST();
    const state = !t.active ? 'done' : t.nextDue < today ? 'overdue' : t.nextDue === today ? 'today' : 'upcoming';
    return { ...t, state, daysLate: state === 'overdue' ? diffDays(today, t.nextDue) : 0 };
  };
  const order = { overdue: 0, today: 1, upcoming: 2, done: 3 };

  app.get('/api/admin-tasks', only, (req, res) => {
    const tasks = list().map(view).sort((a, b) => order[a.state] - order[b.state] || a.nextDue.localeCompare(b.nextDue) || a.title.localeCompare(b.title));
    res.json({ tasks, due: tasks.filter((t) => t.state === 'overdue' || t.state === 'today').length });
  });

  app.post('/api/admin-tasks', only, (req, res) => {
    const r = read(req.body || {}); if (r.error) return res.status(400).json({ error: r.error });
    const t = { id: uid(), ...r.value, active: true, nextDue: '', lastDone: '', log: [], createdAt: nowISO() };
    t.nextDue = r.dueDate || firstOn(t, ctx.todayIST());
    list().push(t); ctx.save('admintasks');
    res.json({ task: view(t) });
  });

  // the four jobs the owner named; a title that already exists is skipped, so pressing it twice adds nothing
  app.post('/api/admin-tasks/starter', only, (req, res) => {
    const have = new Set(list().map((t) => t.title.toLowerCase()));
    let added = 0;
    for (const s of STARTER) {
      if (have.has(s.title.toLowerCase())) continue;
      const t = { id: uid(), title: s.title, notes: s.notes, repeat: s.repeat, days: s.days || [], dayOfMonth: 1, active: true, nextDue: '', lastDone: '', log: [], createdAt: nowISO() };
      t.nextDue = firstOn(t, ctx.todayIST()); list().push(t); added++;
    }
    if (added) ctx.save('admintasks');
    res.json({ added });
  });

  app.put('/api/admin-tasks/:id', only, (req, res) => {
    const t = list().find((x) => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    const r = read(req.body || {}); if (r.error) return res.status(400).json({ error: r.error });
    const changed = r.value.repeat !== t.repeat || r.value.days.join() !== t.days.join() || r.value.dayOfMonth !== t.dayOfMonth;
    Object.assign(t, r.value);
    if (r.dueDate) { t.nextDue = r.dueDate; t.active = true; }
    else if (changed || !t.active) { t.nextDue = firstOn(t, ctx.todayIST()); t.active = true; }
    ctx.save('admintasks');
    res.json({ task: view(t) });
  });

  app.delete('/api/admin-tasks/:id', only, (req, res) => {
    const l = list(); const at = l.findIndex((x) => x.id === req.params.id);
    if (at < 0) return res.status(404).json({ error: 'Not found' });
    l.splice(at, 1); ctx.save('admintasks');
    res.json({ ok: true });
  });

  app.post('/api/admin-tasks/:id/done', only, (req, res) => {
    const t = list().find((x) => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    if (!t.active) return res.status(400).json({ error: 'Already done' });
    const today = ctx.todayIST();
    t.lastDone = today; t.log.push({ at: nowISO(), date: today, dueWas: t.nextDue, note: text(req.body && req.body.note, 500) });
    if (t.log.length > 60) t.log.splice(0, t.log.length - 60);
    const next = nextAfter(t, t.nextDue > today ? t.nextDue : today);
    if (next) t.nextDue = next; else t.active = false;
    ctx.save('admintasks');
    ctx.log(req.user, 'Admin task done: ' + t.title);
    res.json({ task: view(t) });
  });

  app.post('/api/admin-tasks/:id/snooze', only, (req, res) => {
    const t = list().find((x) => x.id === req.params.id);
    if (!t || !t.active) return res.status(404).json({ error: 'Not found' });
    const d = req.body && req.body.date;
    if (!isDate(d) || d <= ctx.todayIST()) return res.status(400).json({ error: 'Pick a date after today' });
    t.nextDue = d; ctx.save('admintasks');
    res.json({ task: view(t) });
  });
};
