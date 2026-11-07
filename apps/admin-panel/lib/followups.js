// Follow-up rules shared by customers and invoices. After every follow-up the employee picks what happened
// (the outcome); the outcome decides when the next follow-up is due. The owner edits these days in Settings.
'use strict';
const { addDays, nowISO, str, text, isDate, uid, istDate } = require('./util');

// days: how many days until the next follow-up. null = no further follow-up. askDate: the employee must pick the date.
const DEFAULT_CADENCE = {
  customer: [
    { key: 'interested', label: 'Interested, will order', days: 3 },
    { key: 'callback', label: 'Asked to call back', days: 2 },
    { key: 'noanswer', label: 'No answer', days: 1 },
    { key: 'quote', label: 'Quotation sent', days: 3 },
    { key: 'ordered', label: 'Order placed', days: 30 },
    { key: 'notinterested', label: 'Not interested now', days: 90 },
    { key: 'wrongnumber', label: 'Wrong number', days: null },
  ],
  invoice: [
    { key: 'reminded', label: 'Reminder sent', days: 2 },
    { key: 'promised', label: 'Promised to pay (pick the date)', days: null, askDate: true },
    { key: 'noanswer', label: 'No answer', days: 1 },
    { key: 'dispute', label: 'Query or dispute', days: 3 },
    { key: 'paid', label: 'Customer says paid', days: 2 },
  ],
};

const KINDS = Object.keys(DEFAULT_CADENCE);

function mergeCadence(saved) {
  const out = {};
  for (const kind of KINDS) {
    const mine = saved && Array.isArray(saved[kind]) ? saved[kind] : [];
    out[kind] = DEFAULT_CADENCE[kind].map((d) => {
      const s = mine.find((x) => x.key === d.key);
      return s && (s.days === null || Number.isInteger(s.days)) ? { ...d, days: s.days } : { ...d };
    });
  }
  return out;
}

function followStatus(nextDate, today) {
  if (!nextDate) return 'none';
  if (nextDate < today) return 'overdue';
  if (nextDate === today) return 'due';
  return 'ok';
}

// Writes the follow-up onto `state` (the record that carries lastAt/nextDate/...) and returns the log entry.
// Throws an Error with a plain message when the input is not acceptable.
function applyFollowup(state, { user, kind, label, refId, outcome, note, nextDate, cadence, today }) {
  const rule = cadence[kind].find((r) => r.key === outcome);
  if (!rule) throw new Error('Choose what happened');
  let next = '';
  if (nextDate) {
    if (!isDate(nextDate)) throw new Error('Bad next follow-up date');
    if (nextDate < today) throw new Error('The next follow-up cannot be in the past');
    next = nextDate;
  } else if (rule.askDate) {
    throw new Error('Pick the date they promised');
  } else if (Number.isInteger(rule.days)) {
    next = addDays(today, rule.days);
  }
  const at = nowISO();
  state.lastAt = at; state.lastBy = user.id; state.lastByName = user.name; state.lastOutcome = outcome; state.lastNote = text(note, 1000);
  state.nextDate = next; state.updatedAt = at;
  if (rule.status) state.status = rule.status;
  return { id: uid(), at, kind, refId, label: str(label, 120), byId: user.id, byName: user.name, outcome, outcomeLabel: rule.label, note: text(note, 1000), nextDate: next };
}

// the date the follow-up was last done (India date), '' if never
const lastDate = (state) => istDate(state && state.lastAt);

module.exports = { DEFAULT_CADENCE, KINDS, mergeCadence, followStatus, applyFollowup, lastDate };
