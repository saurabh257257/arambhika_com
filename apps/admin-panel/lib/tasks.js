// Task designs ("templates") and the work generated from them. Pure functions, no web code.
//
// Three kinds of task, enough to cover the daily work without being complicated:
//   rows       "Call 10 people": the owner picks how many; that many blank rows appear, each with the columns the
//              owner chose (name, phone, result, note ...). A row counts as done when its required columns are filled.
//   checklist  a list of steps to tick off (also how you give someone a task with sub-tasks)
//   count      "Post 2 Instagram photos": a target number, how many were done, and a note or link
'use strict';
const { str, text, uid, nowISO, isDate, slug, PHONE_RE } = require('./util');

const KINDS = ['rows', 'checklist', 'count'];
const COL_TYPES = ['text', 'phone', 'choice', 'date', 'number'];
const DEFAULT_COLUMNS = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'phone', label: 'Phone', type: 'phone', required: false },
  { key: 'result', label: 'Result', type: 'choice', options: ['Spoke', 'No answer', 'Interested', 'Call back later', 'Not interested', 'Wrong number'], required: false },
  { key: 'note', label: 'Note', type: 'text', required: false },
];

// Returns { value } or { error } for a template coming from the designer screen.
function validateTemplate(body, employeeIds) {
  const name = str(body.name, 80);
  if (!name) return { error: 'Give the task a name' };
  const kind = KINDS.includes(body.kind) ? body.kind : null;
  if (!kind) return { error: 'Choose the kind of task' };
  const schedule = body.schedule === 'once' ? 'once' : 'daily';
  const dueDate = body.dueDate ? String(body.dueDate) : '';
  if (dueDate && !isDate(dueDate)) return { error: 'Bad due date' };
  const assignees = [...new Set(Array.isArray(body.assignees) ? body.assignees.map(String) : [])];
  if (!assignees.length) return { error: 'Choose who does this task' };
  if (assignees.some((a) => !employeeIds.includes(a))) return { error: 'Choose active team members only' };
  const t = { name, kind, schedule, dueDate: schedule === 'once' ? dueDate : '', assignees, instructions: text(body.instructions, 1000), active: body.active !== false };
  if (kind === 'rows') {
    const count = Math.round(Number(body.rowCount));
    if (!Number.isFinite(count) || count < 1 || count > 200) return { error: 'How many rows? A number from 1 to 200' };
    t.rowCount = count;
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
      t.columns.push(col);
    }
    if (!t.columns.some((c) => c.required)) t.columns[0].required = true;
  } else if (kind === 'checklist') {
    const steps = (Array.isArray(body.steps) ? body.steps : String(body.steps || '').split('\n')).map((s) => str(s, 120)).filter(Boolean);
    if (!steps.length || steps.length > 30) return { error: 'Add 1 to 30 steps' };
    t.steps = steps;
  } else {
    const target = Math.round(Number(body.target));
    if (!Number.isFinite(target) || target < 1 || target > 10000) return { error: 'Target: a number from 1 to 10000' };
    t.target = target; t.unit = str(body.unit, 20) || 'done';
  }
  return { value: t };
}

// A copy of the design, for one person on one day. The copy keeps its own settings, so changing the design later
// never rewrites work somebody already started.
function makeInstance(template, userId, date) {
  const inst = { id: uid(), templateId: template.id, userId, date, name: template.name, kind: template.kind, schedule: template.schedule, dueDate: template.dueDate || '', instructions: template.instructions || '', createdAt: nowISO(), updatedAt: '', updatedByName: '', completedAt: '' };
  if (template.kind === 'rows') {
    inst.columns = JSON.parse(JSON.stringify(template.columns));
    inst.rows = Array.from({ length: template.rowCount }, () => ({ values: {}, updatedAt: '', updatedByName: '' }));
  } else if (template.kind === 'checklist') {
    inst.steps = template.steps.map((s) => ({ text: s, done: false, doneAt: '' }));
  } else {
    inst.target = template.target; inst.unit = template.unit; inst.count = 0; inst.notes = '';
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

module.exports = { KINDS, DEFAULT_COLUMNS, validateTemplate, makeInstance, rowDone, units, readCell };
