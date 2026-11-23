// What Zoho Books says about a customer, as saved into the portal by a team member's Claude (which has Zoho connected with that
// person's own Zoho login). The portal never talks to Zoho Books itself. From the saved invoices, orders and quotes it shows what the
// customer bought and works out the next step for each one ("order placed: move it to invoicing", "not delivered yet",
// "overdue: call for payment"). The next steps are worked out when the page is opened, so they stay true as days pass.
'use strict';

const days = (from, to) => Math.floor((Date.parse(to) - Date.parse(from)) / 86400000);
const fmtDate = (d) => String(d || '').slice(0, 10).split('-').reverse().join('-');
const rupees = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const A = (tone, label, action) => ({ tone, label, action });

// ---- the next step for each kind of document (pure, so it can be tested on its own) ----
function quoteAction(q, today) {
  const age = q.date ? days(q.date, today) : 0;
  switch (q.status) {
    case 'draft': return A('warn', 'Quote not sent', 'This quote is still a draft. Send it to the customer.');
    case 'sent': case 'viewed': return q.expiry && q.expiry < today ? A('warn', 'Quote expired', 'The quote expired on ' + fmtDate(q.expiry) + ' without an answer. Offer again or close it.')
      : A('info', 'Quote sent', 'Quote sent ' + age + ' day' + (age === 1 ? '' : 's') + ' ago. Follow up with the customer for a decision.');
    case 'accepted': return A('bad', 'Quote accepted', 'The customer accepted this quote. Convert it to a sales order.');
    case 'declined': return A('info', 'Quote declined', 'The customer declined. Ask what was wrong (price, delivery, quality) and note it.');
    case 'expired': return A('warn', 'Quote expired', 'This quote has expired. Offer again if the customer is still interested.');
    case 'invoiced': return A('ok', 'Quote invoiced', 'Already turned into an invoice.');
    default: return A('info', q.status || 'Quote', '');
  }
}
function orderAction(o, today) {
  const age = o.date ? days(o.date, today) : 0, st = o.status, shipped = o.shipped || '', invoiced = o.invoiced || '';
  const isShipped = /ship|deliver|fulfil/.test(shipped) && !/not|part/.test(shipped), partShip = /part/.test(shipped);
  const isInvoiced = invoiced === 'invoiced', partInv = /part/.test(invoiced);
  if (st === 'void') return A('info', 'Order cancelled', 'This order was voided.');
  if (st === 'draft' || st === 'pending_approval') return A('warn', 'Draft order', 'The order is still a draft. Confirm it with the customer, then confirm it in Zoho.');
  if (isInvoiced && isShipped) return A('ok', 'Delivered and invoiced', 'Nothing to do on the order. Check the invoice for payment.');
  if (isShipped && !isInvoiced) return A('bad', 'Delivered, not invoiced', 'The material has gone out but there is no invoice yet. Raise the invoice now.');
  if (isInvoiced && !isShipped) return A('warn', 'Invoiced, not delivered', 'Invoiced ' + (partShip ? 'but only partly delivered' : 'but not delivered yet') + '. Dispatch and confirm delivery' + (age > 3 ? ' (order is ' + age + ' days old)' : '') + '.');
  if (partShip) return A('warn', 'Partly delivered', 'Part of the order has gone out. Dispatch the rest' + (partInv ? ' and invoice what is delivered' : '') + '.');
  if (partInv) return A('warn', 'Partly invoiced', 'Part of the order is invoiced. Invoice the rest when it is delivered.');
  return age > 3 ? A('bad', 'Placed, not delivered', 'Order placed ' + age + ' days ago and not delivered yet. Check dispatch, then move it to invoicing.')
    : A('info', 'Order placed', 'Order placed' + (age ? ' ' + age + ' day' + (age === 1 ? '' : 's') + ' ago' : ' today') + '. Prepare the material and dispatch, then move it to invoicing.');
}
function invoiceAction(i, today) {
  const bal = i.balance || 0, late = i.dueDate && i.dueDate < today ? days(i.dueDate, today) : 0;
  if (i.status === 'void') return A('info', 'Invoice void', 'This invoice was voided.');
  if (i.status === 'draft') return A('warn', 'Invoice draft', 'The invoice is a draft. Send it to the customer.');
  if (bal <= 0 || i.status === 'paid') return A('ok', 'Paid', 'Paid in full.');
  if (late > 0) return A('bad', 'Overdue ' + late + ' day' + (late === 1 ? '' : 's'), rupees(bal) + ' was due on ' + fmtDate(i.dueDate) + '. Call for the payment' + (i.paymentExpected ? ' (they promised ' + fmtDate(i.paymentExpected) + ')' : '') + '.');
  return A('info', i.status === 'partially_paid' ? 'Part paid' : 'Payment due', rupees(bal) + ' is due' + (i.dueDate ? ' on ' + fmtDate(i.dueDate) : '') + '.');
}

// everything saved for one customer, with the next step on each document and a summary
function forCustomer(repo, mobile, today = new Date().toISOString().slice(0, 10)) {
  const d = repo.booksDocs(mobile);
  if (!d.count) return { synced: false, note: 'Nothing from Zoho Books has been saved for this customer yet. Ask Claude: "Sync this customer from Zoho Books".' };
  const inv = d.invoices.map((i) => ({ ...i, next: invoiceAction(i, today) }));
  const ord = d.orders.map((o) => ({ ...o, next: orderAction(o, today) }));
  const qts = d.quotes.map((q) => ({ ...q, next: quoteAction(q, today) }));
  const live = inv.filter((i) => i.status !== 'void' && i.status !== 'draft');
  const bought = new Map();
  for (const i of live) for (const l of i.lines || []) { const k = String(l.name).trim().toLowerCase(); const b = bought.get(k) || { name: l.name, quantity: 0, value: 0, last: '', times: 0 }; b.quantity += l.quantity; b.value += l.total; b.times += 1; if (!b.last || i.date > b.last) b.last = i.date; bought.set(k, b); }
  // grouped by our item categories (nickel strip, BMS, cells...), biggest first; an item we cannot place goes under "Other"
  const groups = new Map();
  for (const b of bought.values()) { const cat = repo.categoryOfName(b.name); const g = groups.get(cat) || { category: cat, value: 0, quantity: 0, items: [] }; g.value += b.value; g.quantity += b.quantity; g.items.push(b); groups.set(cat, g); }
  const boughtByCategory = [...groups.values()].map((g) => ({ ...g, items: g.items.sort((x, y) => y.value - x.value) })).sort((x, y) => (x.category === 'Other') - (y.category === 'Other') || y.value - x.value);
  // quotes still waiting for an answer, or accepted and not yet turned into an order
  const pendingQuotes = qts.filter((q) => ['draft', 'sent', 'viewed', 'accepted'].includes(q.status));
  const tagged = [...ord.map((x) => ['order', x]), ...inv.map((x) => ['invoice', x]), ...qts.map((x) => ['quote', x])];
  const actions = tagged.filter(([, x]) => x.next.tone === 'bad' || x.next.tone === 'warn').map(([kind, x]) => ({ kind, number: x.number, ...x.next }));
  const dates = live.map((i) => i.date).filter(Boolean).sort();
  return {
    synced: true, syncedAt: d.syncedAt, syncedBy: d.syncedBy,
    summary: { orders: ord.filter((o) => o.status !== 'void').length, pendingQuotes: pendingQuotes.length, pendingQuotesValue: pendingQuotes.reduce((s, q) => s + q.total, 0), collected: live.reduce((s, i) => s + (i.total - (i.balance || 0)), 0), invoices: live.length, billed: live.reduce((s, i) => s + i.total, 0), outstanding: live.reduce((s, i) => s + (i.balance || 0), 0), firstPurchase: dates[0] || '', lastPurchase: dates[dates.length - 1] || '', openActions: actions.length },
    actions, invoices: inv, orders: ord, quotes: qts, pendingQuotes, boughtByCategory, bought: [...bought.values()].sort((a, b) => b.value - a.value),
  };
}

// short "needs attention" chips for the list: an overdue follow-up, a quote waiting, a payment late, an order to deliver, no contact for a month
function attention(repo, c, today = new Date().toISOString().slice(0, 10)) {
  const out = [];
  if (c.latest_next && c.latest_next < today) out.push({ tone: 'bad', label: 'Follow-up ' + days(c.latest_next, today) + 'd late' });
  else if (c.latest_next === today) out.push({ tone: 'warn', label: 'Follow up today' });
  const b = forCustomer(repo, c.mobile, today);
  if (b.synced) {
    const late = b.invoices.find((i) => i.next.tone === 'bad' && /^Overdue/.test(i.next.label));
    if (late) out.push({ tone: 'bad', label: rupees(b.summary.outstanding) + ' overdue' });
    if (b.orders.some((o) => o.next.tone === 'bad' && /Placed, not delivered/.test(o.next.label))) out.push({ tone: 'bad', label: 'Order not delivered' });
    if (b.orders.some((o) => /Delivered, not invoiced/.test(o.next.label))) out.push({ tone: 'bad', label: 'To invoice' });
    if (b.quotes.some((q) => q.status === 'accepted')) out.push({ tone: 'bad', label: 'Quote accepted' });
    const waiting = b.quotes.filter((q) => ['draft', 'sent', 'viewed'].includes(q.status)).length;
    if (waiting) out.push({ tone: 'info', label: waiting + ' quote' + (waiting === 1 ? '' : 's') + ' pending' });
  }
  if (!out.length && c.last_at && days(c.last_at, today) >= 30) out.push({ tone: 'warn', label: 'No contact ' + days(c.last_at, today) + 'd' });
  const rank = { bad: 0, warn: 1, info: 2 };
  return out.sort((a, b2) => rank[a.tone] - rank[b2.tone]).slice(0, 3);
}

module.exports = { attention, forCustomer, quoteAction, orderAction, invoiceAction };
