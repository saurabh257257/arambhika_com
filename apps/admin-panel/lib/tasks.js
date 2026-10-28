// Task designs ("templates") and the work generated from them. Pure functions, no web code.
//
// Three kinds of task:
//   rows       "Call 10 people": the owner picks how many; that many blank rows appear, each with the columns the owner chose.
//              A row counts as done when its required columns are filled. One date column can be the "follow-up date":
//              when that day comes, the row comes back by itself as a follow-up (see modules/tasks.js).
//   checklist  a list of steps to tick off (also how you give someone a task with sub-tasks)
//   count      "Post 2 photos": a target number, how many were done, and a note or link
// Three schedules: daily (every working day), weekly (one per week, Monday to Sunday), once (stays until it is done).
// Daily and weekly work can carry forward what was missed: 8 of 10 calls today means 12 tomorrow.
'use strict';
const { str, text, uid, nowISO, isDate, slug, PHONE_RE } = require('./util');

const KINDS = ['rows', 'checklist', 'count'];
const SCHEDULES = ['daily', 'weekly', 'once'];
const COL_TYPES = ['text', 'phone', 'choice', 'date', 'number'];

const DEFAULT_COLUMNS = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'phone', label: 'Phone', type: 'phone', required: false },
  { key: 'result', label: 'Result', type: 'choice', options: ['Spoke', 'No answer', 'Interested', 'Call back later', 'Not interested', 'Wrong number'], required: false },
  { key: 'note', label: 'Note', type: 'text', required: false },
];

// The tasks the owner asked for, ready to create with one click.
const PRESETS = [
  { id: 'calls', for: 'both', name: 'Call 10 people', kind: 'rows', schedule: 'daily', rowCount: 10, carry: true,
    instructions: 'Call 10 new people. Write down who you spoke to, what you talked about, and when to follow up. On that date the call comes back by itself.',
    columns: [
      { label: 'Name', type: 'text', required: true }, { label: 'Phone', type: 'phone', required: true }, { label: 'Company', type: 'text' },
      { label: 'What did you talk about', type: 'text', required: true }, { label: 'Follow-up date', type: 'date', followUp: true },
    ] },
  { id: 'find', for: 'both', name: 'Find 4 customers', kind: 'rows', schedule: 'daily', rowCount: 4, carry: true,
    instructions: 'Search for 4 new customers and note where you found them.',
    columns: [
      { label: 'Name', type: 'text', required: true }, { label: 'Company', type: 'text' }, { label: 'Phone', type: 'phone' }, { label: 'Where found', type: 'text' },
    ] },
  { id: 'instagram', for: 'Lokesh', name: 'Schedule 8 Instagram posts', kind: 'rows', schedule: 'weekly', rowCount: 8, carry: true,
    instructions: 'Schedule 8 Instagram posts this week (Monday to Sunday).',
    columns: [{ label: 'Post topic', type: 'text', required: true }, { label: 'Scheduled for', type: 'date' }, { label: 'Link', type: 'text' }] },
];

// Returns { value } or { error } for a template coming from the designer screen.
function validateTemplate(body, employeeIds) {
  const name = str(body.name, 80);
  if (!name) return { error: 'Give the task a name' };
  const kind = KINDS.includes(body.kind) ? body.kind : null;
  if (!kind) return { error: 'Choose the kind of task' };
  const schedule = SCHEDULES.includes(body.schedule) ? body.schedule : 'daily';
  const dueDate = body.dueDate ? String(body.dueDate) : '';
  if (dueDate && !isDate(dueDate)) return { error: 'Bad due date' };
  const assignees = [...new Set(Array.isArray(body.assignees) ? body.assignees.map(String) : [])];
  if (!assignees.length) return { error: 'Choose who does this task' };
  if (assignees.some((a) => !employeeIds.includes(a))) return { error: 'Choose active team members only' };
  const t = { name, kind, schedule, dueDate: schedule === 'once' ? dueDate : '', assignees, instructions: text(body.instructions, 1000), active: body.active !== false, adhoc: Boolean(body.adhoc) };
  let base = 0;
  if (kind === 'rows') {
    const count = Math.round(Number(body.rowCount));
    if (!Number.isFinite(count) || count < 1 || count > 200) return { error: 'How many rows? A number from 1 to 200' };
    t.rowCount = count; base = count;
    const raw = Array.isArray(body.columns) && body.columns.length ? body.columns : DEFAULT_COLUMNS;
    if (raw.length > 8) return { error: 'At most 8 columns' };
    const seen = new Set(); t.columns = [];
    for (const c of raw) {
      const label = str(c.label, 30); if (!label) return { error: 'Every column needs a name' };
      let key = slug(label); while (seen.has(key)) key += '_'; seen.add(key);
      const type = COL_TYPES.includes(c.type) ? c.type : 'text';
      const col = { key, label, type, required: Boolean(c.required) };
      if (type === 'choice') {
        col.options = (Array.isArray(c.options) ? c.options : String(c.options || '').split(',')).map((o) => str(o, 40)).filter(Boolean).slice(0, 12);
        if (!col.options.length) return { error: 'Column "' + label + '" needs its choices' };
      }
      if (type === 'date' && c.followUp) col.followUp = true;
      t.columns.push(col);
    }
    if (t.columns.filter((c) => c.followUp).length > 1) return { error: 'Only one date column can be the follow-up date' };
    if (!t.columns.some((c) => c.required)) t.columns[0].required = true;
  } else if (kind === 'checklist') {
    const steps = (Array.isArray(body.steps) ? body.steps : String(body.steps || '').split('\n')).map((s) => str(s, 120)).filter(Boolean);
    if (!steps.length || steps.length > 30) return { error: 'Add 1 to 30 steps' };
    t.steps = steps;
  } else {
    const target = Math.round(Number(body.target));
    if (!Number.isFinite(target) || target < 1 || target > 10000) return { error: 'Target: a number from 1 to 10000' };
    t.target = target; t.unit = str(body.unit, 20) || 'done'; base = target;
  }
  // carry what was missed into the next day / week (not for one-time tasks or checklists, which stay until done anyway)
  t.carry = schedule !== 'once' && kind !== 'checklist' && body.carry !== false;
  if (t.carry) {
    const max = body.maxCarry === undefined || body.maxCarry === '' || body.maxCarry === null ? base : Math.round(Number(body.maxCarry));
    if (!Number.isFinite(max) || max < 0 || max > 1000) return { error: 'The most that can carry over: a number from 0 to 1000' };
    t.maxCarry = max;
  }
  return { value: t };
}

const followUpKey = (columns) => { const c = (columns || []).find((x) => x.followUp); return c ? c.key : ''; };

// A copy of the design, for one person on one day (or week). The copy keeps its own settings, so changing the design later
// never rewrites work somebody already started. `carried` is what was missed last time and is added on top of the base.
function makeInstance(template, userId, date, carried = 0) {
  const inst = { id: uid(), templateId: template.id, userId, date, name: template.name, kind: template.kind, schedule: template.schedule, dueDate: template.dueDate || '', instructions: template.instructions || '', adhoc: Boolean(template.adhoc), base: 0, carried: 0, createdAt: nowISO(), updatedAt: '', updatedByName: '', completedAt: '' };
  if (template.kind === 'rows') {
    inst.base = template.rowCount; inst.carried = carried;
    inst.columns = JSON.parse(JSON.stringify(template.columns));
    inst.rows = Array.from({ length: inst.base + carried }, () => ({ values: {}, updatedAt: '', updatedByName: '', history: [] }));
  } else if (template.kind === 'checklist') {
    inst.steps = template.steps.map((s) => ({ text: s, done: false, doneAt: '' }));
  } else {
    inst.base = template.target; inst.carried = carried;
    inst.target = inst.base + carried; inst.unit = template.unit; inst.count = 0; inst.notes = '';
  }
  return inst;
}

function rowDone(inst, row) {
  const req = inst.columns.filter((c) => c.required);
  return req.every((c) => String((row.values || {})[c.key] || '').trim() !== '');
}

// how much of this task is done: { done, total }
function units(inst) {
  if (inst.kind === 'rows') return { done: inst.rows.filter((r) => rowDone(inst, r)).length, total: inst.rows.length };
  if (inst.kind === 'checklist') return { done: inst.steps.filter((s) => s.done).length, total: inst.steps.length };
  return { done: Math.min(inst.count || 0, inst.target), total: inst.target };
}

function readCell(col, value) {
  const v = str(value, 200);
  if (!v) return { value: '' };
  if (col.type === 'phone' && !PHONE_RE.test(v)) return { error: col.label + ' does not look like a phone number' };
  if (col.type === 'date' && !isDate(v)) return { error: col.label + ' must be a date' };
  if (col.type === 'number' && !Number.isFinite(Number(v))) return { error: col.label + ' must be a number' };
  if (col.type === 'choice' && !col.options.includes(v)) return { error: 'Pick one of the choices for ' + col.label };
  return { value: v };
}

module.exports = { KINDS, SCHEDULES, DEFAULT_COLUMNS, PRESETS, validateTemplate, makeInstance, rowDone, units, readCell, followUpKey };
