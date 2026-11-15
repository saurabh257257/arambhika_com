// What Zoho Books knows about a customer, found by their mobile number: quotes, orders, invoices, the items they bought, and for
// each document the next step to take ("order placed: move it to invoicing", "not delivered yet", "overdue: call for payment").
// Read-only. The numbers on the right of the match are compared, so +91, spaces and a leading 0 do not matter.
'use strict';

const last10 = (v) => String(v || '').replace(/\D/g, '').slice(-10);
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

// the customer's Zoho contacts (by mobile), then everything under them
async function forCustomer(zoho, mobile, today = new Date().toISOString().slice(0, 10), opts = {}) {
  if (!zoho || !zoho.configured) return { connected: false, note: 'Zoho Books is not connected to the portal yet.' };
  const key = last10(mobile);
  try {
    const customers = await zoho.customers(opts);
    const contacts = customers.list.filter((c) => (c.phones || [c.phone]).some((p) => last10(p) === key));
    if (!contacts.length) return { connected: true, found: false, note: 'No customer in Zoho Books has this mobile number yet.', source: customers.source };
    const ids = new Set(contacts.map((c) => c.id));
    const [invoices, orders, quotes] = await Promise.all([zoho.invoices(opts), zoho.salesOrders(opts), zoho.estimates(opts).catch(() => [])]);
    const mine = (l) => l.filter((x) => ids.has(x.customerId));
    const inv = mine(invoices).map((i) => ({ ...i, next: invoiceAction(i, today) }));
    const ord = mine(orders).map((o) => ({ ...o, next: orderAction(o, today) }));
    const qts = mine(quotes).map((q) => ({ ...q, next: quoteAction(q, today) }));
    // what they bought: the lines of their latest invoices and orders
    const bought = new Map();
    const take = async (list, fn) => { for (const d of list.slice(0, 8)) { try { for (const l of await fn(d.id)) { const k = l.itemId || l.name; const b = bought.get(k) || { itemId: l.itemId, name: l.name, quantity: 0, value: 0, last: '' }; b.quantity += l.quantity; b.value += l.total; if (!b.last || d.date > b.last) b.last = d.date; bought.set(k, b); } } catch (e) { /* skip a document Zoho will not give */ } } };
    await take(inv.filter((i) => i.status !== 'void' && i.status !== 'draft'), zoho.invoiceLines);
    const attach = async (list, fn) => { for (const d of list.slice(0, 5)) { try { d.lines = await fn(d.id); } catch (e) { d.lines = []; } } };
    await Promise.all([attach(ord, zoho.orderLines), attach(inv, zoho.invoiceLines)]);
    const live = inv.filter((i) => i.status !== 'void' && i.status !== 'draft');
    const tagged = [...ord.map((d) => ['order', d]), ...inv.map((d) => ['invoice', d]), ...qts.map((d) => ['quote', d])];
    const actions = tagged.filter(([, d]) => d.next.tone === 'bad' || d.next.tone === 'warn').map(([kind, d]) => ({ kind, number: d.number, ...d.next }));
    return {
      connected: true, found: true, contacts: contacts.map((c) => ({ id: c.id, name: c.name, company: c.company })),
      summary: { invoices: live.length, billed: live.reduce((s, i) => s + i.total, 0), outstanding: live.reduce((s, i) => s + (i.balance || 0), 0), firstPurchase: live.length ? live.map((i) => i.date).sort()[0] : '', lastPurchase: live.length ? live.map((i) => i.date).sort().slice(-1)[0] : '', openActions: actions.length },
      actions, invoices: inv, orders: ord, quotes: qts, bought: [...bought.values()].sort((a, b) => b.value - a.value),
    };
  } catch (e) { return { connected: true, found: false, error: e.message, note: 'Zoho Books could not be read just now: ' + e.message }; }
}

module.exports = { forCustomer, quoteAction, orderAction, invoiceAction, last10 };
