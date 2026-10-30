// The customer master list, built from two kinds of input:
//   Zoho Books    contacts, estimates (quotes), invoices, bills, sales orders with their item lines, and the items with their categories
//   Team work     rows from "Call 10 people" and "Find 4 customers", and customers logged by hand in Customer requests
// A person is recognised by mobile number (the last 10 digits). Someone the team logged who is not in Zoho is a LEAD. When a paid
// invoice for the same mobile number appears in Zoho (dated after the first contact) the lead is CONVERTED to a customer, with credit
// to whoever found them. A mobile number that was already a paying customer before the first contact is only linked, never a lead.
// People logged without a mobile number cannot be matched: they stay as unmatched leads. Pure functions, no web code.
'use strict';
const { istDate } = require('./util');

const phoneKey = (s) => { const d = String(s == null ? '' : s).replace(/\D/g, ''); return d.length >= 7 ? d.slice(-10) : ''; };
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const uniq = (a) => [...new Set(a.filter(Boolean))];
const isPaid = (i) => i.status === 'paid' || (i.total > 0 && i.balance === 0 && !['void', 'draft'].includes(i.status));

// rows of a "fill in rows" task (the Call 10 / Find 4 kind), flattened into one record per row that has anything written in it
function taskRows(instances, nameTest, type) {
  const out = [];
  for (const inst of instances) {
    if (inst.kind !== 'rows' || !nameTest.test(inst.name || '')) continue;
    const cols = inst.columns || [];
    const phoneCol = cols.find((c) => c.type === 'phone');
    const nameCol = cols.find((c) => /^name$/i.test(c.label)) || cols.find((c) => c.type === 'text' && c.required);
    const companyCol = cols.find((c) => /company/i.test(c.label));
    const categoryCol = cols.find((c) => /categor/i.test(c.label));
    const talkCol = cols.find((c) => /talk|discuss|note|remark|where/i.test(c.label));
    const fuCol = cols.find((c) => c.followUp);
    (inst.rows || []).forEach((row, i) => {
      const v = row.values || {};
      if (!Object.values(v).some((x) => String(x || '').trim())) return;
      const get = (c) => (c ? String(v[c.key] || '') : '');
      out.push({
        id: inst.id + ':' + i, type, taskId: inst.id, rowIndex: i, date: inst.date, userId: inst.userId,
        name: get(nameCol), phone: get(phoneCol), phoneKey: phoneKey(get(phoneCol)), company: get(companyCol), category: get(categoryCol), talk: get(talkCol), followUp: get(fuCol),
        fields: cols.map((c) => ({ label: c.label, value: String(v[c.key] || '') })), history: row.history || [], updatedAt: row.updatedAt || '', updatedByName: row.updatedByName || '',
      });
    });
  }
  return out;
}

// customers logged by hand in Customer requests (website orders come from Zoho, so they are left out)
function requestRows(requests) {
  return requests.filter((r) => r.source !== 'Website').map((r) => ({
    id: r.id, type: 'request', name: r.customerName, phone: r.phone || '', phoneKey: phoneKey(r.phone), company: r.company || '', request: r.request || '', source: r.source, amount: r.amount || 0,
    userId: r.ownerId || '', date: istDate(r.createdAt), createdAt: r.createdAt, steps: Object.keys(r.steps || {}), delivered: Boolean(r.steps && r.steps.done), notes: r.notes || [],
  }));
}

function buildMaster({ contacts = [], invoices = [], estimates = [], bills = [], orders = [], lines = {}, items = [], sources = [], userName = () => '' }) {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const records = [];
  const byPhone = new Map();

  for (const c of contacts) {
    const myInv = invoices.filter((i) => i.customerId === c.id);
    const myOrders = orders.filter((o) => o.customerId === c.id).map((o) => ({
      id: o.id, number: o.number, date: o.date, total: o.total, status: o.status, paid: o.paid, shipped: o.shipped,
      items: (lines[o.id] || []).map((l) => ({ ...l, category: (itemById.get(l.itemId) || {}).category || '' })),
    }));
    const paid = myInv.filter(isPaid).sort((a, b) => a.date.localeCompare(b.date));
    const rec = {
      id: 'z:' + c.id, stage: 'customer', zohoId: c.id, name: c.name, company: c.company, phone: c.phone, phones: uniq((c.phones || [c.phone]).map(phoneKey)), email: c.email,
      outstanding: c.outstanding || 0, createdTime: c.createdTime || '',
      quotes: estimates.filter((e) => e.customerId === c.id).map((e) => ({ id: e.id, number: e.number, date: e.date, status: e.status, total: e.total })),
      invoices: myInv.map((i) => ({ id: i.id, number: i.number, date: i.date, dueDate: i.dueDate, total: i.total, balance: i.balance, status: i.status })),
      bills: bills.filter((b) => b.vendorId === c.id).map((b) => ({ id: b.id, number: b.number, date: b.date, total: b.total, balance: b.balance, status: b.status })),
      orders: myOrders, categories: uniq(myOrders.flatMap((o) => o.items.map((l) => l.category))),
      totals: { billed: Math.round(myInv.filter((i) => !['void', 'draft'].includes(i.status)).reduce((s, i) => s + i.total, 0)), paidInvoices: paid.length, firstPaidOn: paid.length ? paid[0].date : '' },
      lead: null,
    };
    records.push(rec);
    for (const k of rec.phones) if (!byPhone.has(k)) byPhone.set(k, rec);
  }

  // people the team logged, grouped by mobile number (or by name and company when there is none)
  const groups = new Map();
  for (const s of sources) {
    const key = s.phoneKey ? 'p' + s.phoneKey : (norm(s.name) ? 'n' + norm(s.name) + '|' + norm(s.company) : 'x' + s.id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  for (const [key, list] of groups) {
    list.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const first = list[0], last = list[list.length - 1];
    const info = {
      sources: list.map((s) => ({ type: s.type, refId: s.id, date: s.date, userId: s.userId, userName: userName(s.userId), category: s.category || '', note: s.talk || s.request || '', followUp: s.followUp || '' })),
      ownerId: first.userId, ownerName: userName(first.userId), firstContactOn: first.date, lastContactOn: last.date,
      nextFollowUp: list.map((s) => s.followUp).filter(Boolean).sort().pop() || '', categories: uniq(list.map((s) => s.category)), converted: false, convertedOn: '', linkedOnly: false,
    };
    const match = first.phoneKey ? byPhone.get(first.phoneKey) : null;
    if (match) {
      const paid = match.invoices.filter(isPaid).sort((a, b) => a.date.localeCompare(b.date));
      const before = paid.find((i) => i.date < info.firstContactOn);
      const after = paid.find((i) => i.date >= info.firstContactOn);
      if (before) { info.linkedOnly = true; }
      else if (after) { info.converted = true; info.convertedOn = after.date; }
      else match.stage = 'lead';
      match.lead = info;
    } else {
      const best = list.find((s) => s.name) || first;
      records.push({
        id: 'lead:' + key, stage: 'lead', zohoId: '', name: best.name || '(no name)', company: list.map((s) => s.company).find(Boolean) || '', phone: list.map((s) => s.phone).find(Boolean) || '',
        phones: first.phoneKey ? [first.phoneKey] : [], email: '', unmatched: !first.phoneKey, outstanding: 0, createdTime: '',
        quotes: [], invoices: [], bills: [], orders: [], categories: [], totals: { billed: 0, paidInvoices: 0, firstPaidOn: '' }, lead: info,
      });
    }
  }
  records.sort((a, b) => (a.stage === b.stage ? a.name.localeCompare(b.name) : a.stage === 'lead' ? -1 : 1));
  return records;
}

const summary = (records) => ({
  customers: records.filter((r) => r.stage === 'customer').length,
  leads: records.filter((r) => r.stage === 'lead').length,
  unmatchedLeads: records.filter((r) => r.stage === 'lead' && r.unmatched).length,
  converted: records.filter((r) => r.lead && r.lead.converted).length,
  linkedOnly: records.filter((r) => r.lead && r.lead.linkedOnly).length,
});

module.exports = { phoneKey, taskRows, requestRows, buildMaster, summary };
