// The MCP server: lets a team member's Claude read and update the portal's data. It speaks plain JSON-RPC over HTTP POST
// (the "streamable HTTP" transport, answering with JSON). Every call is made as one signed-in member, so every write is
// stamped with their name. There is deliberately no tool that deletes anything. A customer or vendor is identified by
// their mobile number, which is their key: a second one with the same number is refused.
'use strict';
const { ENUMS } = require('./data');
const books = require('./books');

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const MAX_FILE = 5 * 1024 * 1024;
const today = () => new Date().toISOString().slice(0, 10);
const text = (v) => ({ content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 2) }] });
const fail = (msg) => ({ isError: true, content: [{ type: 'text', text: msg }] });
const str = (s) => ({ type: 'string', description: s });
const en = (list, s) => ({ type: 'string', enum: list, description: s });

const MOBILE = str('Mobile number, 10 digits (+91 and spaces are fine). It is the unique key: one customer per number.');
const PROFILE_PROPS = {
  name: str('Contact person name'), company: str('Company or shop name'), email: str('Email'), city: str('City'), state: str('State'), pincode: str('6-digit pincode'), gstin: str('GST number, 15 characters'),
  source: en(ENUMS.SOURCES, 'Where this customer came from'), source_detail: str('More about where from: which email, which ad, who referred them'),
  buyer_type: en(ENUMS.BUYER_TYPES, 'trader = buys to resell; oem = makes its own products with what it buys'),
  address: str('Full street address'), about: str('What the company does, in a sentence or two'),
  business: en(ENUMS.BUSINESSES, 'What kind of business they are'),
  looking_for: str('What they are looking for: products, sizes, grades'), application: str('What they will use it for: e-bike, solar storage, power tool...'),
  cell_format: str('Cell type or size: 18650, 21700, 32650, LiFePO4...'), monthly_volume: str('How much they need and how often'), urgency: en(ENUMS.URGENCY, 'How soon they need it'),
};

const customerOut = (c) => ({
  mobile: c.mobile, zoho_directory: c.zoho_status === 'created' ? 'created' : c.zoho_status === 'not_created' ? 'not created' : 'not checked', name: c.name, company: c.company, about: c.about, email: c.email, address: c.address, city: c.city, state: c.state, pincode: c.pincode, gstin: c.gstin, source: c.source, source_detail: c.source_detail,
  buyer_type: c.buyer_type, business: c.business, looking_for: c.looking_for, application: c.application, cell_format: c.cell_format, monthly_volume: c.monthly_volume, urgency: c.urgency, basket: c.owner_name || 'unassigned', created_by: c.created_by_name,
});
const ownerOf = (repo, a) => { if (!a.owner_username) return { id: null }; if (String(a.owner_username).toLowerCase() === 'unassigned') return { id: 'none' }; const o = repo.memberByUsername(a.owner_username); return o ? { id: o.id } : { error: 'No active team member with that username' }; };
const fill = (r) => (r.missing && r.missing.length ? { still_unknown: r.missing.map((m) => m.field), ask_the_user: r.missing.slice(0, 6).map((m) => m.ask) } : { still_unknown: [] });

const TOOLS = [
  { name: 'who_am_i', description: 'Shows which team member you are signed in as. Everything you save is recorded under this name.', inputSchema: { type: 'object', properties: {} },
    run: (c, me) => text({ name: me.name, username: me.username, today: today() }) },
  { name: 'list_team', description: 'Lists the active team members (names and usernames), for choosing an owner.', inputSchema: { type: 'object', properties: {} },
    run: (c) => text(c.repo.members().filter((m) => m.active).map((m) => ({ name: m.name, username: m.username }))) },

  // ---------- customers ----------
  { name: 'search_customers', description: 'Finds customers by name, company, mobile number, city, what they want, or any words from their history. Leave the query empty for the most recently active. Returns up to 25.',
    inputSchema: { type: 'object', properties: { query: str('Words or a mobile number'), owner_username: str('Only customers assigned to this team member, or "unassigned" for those with nobody'), state: str('Only customers in this state'), buyer_type: en(ENUMS.BUYER_TYPES, 'Only traders or only OEMs'), business: en(ENUMS.BUSINESSES, 'Only this kind of business') } },
    run: (c, me, a) => { const o = ownerOf(c.repo, a); if (o.error) return fail(o.error);
      return text(c.repo.customers({ q: a.query, owner: o.id || '', buyer: a.buyer_type, business: a.business, state: a.state }).slice(0, 25).map((x) => ({ ...customerOut(x), last_interaction: x.last_at, interactions: x.interactions, next_follow_up: x.next_follow_up }))); } },
  { name: 'get_customer', description: 'Shows one customer by mobile number: their profile, which details are still unknown (with the question to ask), and their full history (newest first) and files.',
    inputSchema: { type: 'object', properties: { mobile: MOBILE }, required: ['mobile'] },
    run: (c, me, a) => { const x = c.repo.customer(a.mobile); if (!x) return fail('No customer with that mobile number');
      return text({ ...customerOut(x), ...fill(x), contacts: x.contacts.map((k) => ({ name: k.name, role: k.role, mobile: k.mobile, email: k.email })), interactions: x.interactions.slice(0, 50).map((i) => ({ id: i.id, type: i.type, summary: i.summary, amount: i.amount, next_date: i.next_date, by: i.by_name, at: i.at })), files: x.files.map((f) => ({ id: f.id, name: f.name, size: f.size, by: f.by_name, at: f.at })) }); } },
  { name: 'add_customer', description: 'Adds a new customer. It is created with no basket (the admin assigns baskets in the portal) and shows you as its creator. The mobile number is required and must not already belong to a customer (search first; if it exists, use update_customer). Fill in every detail you can find in what the user gave you (an email, a chat, a call note): company, city, where they came from, trader or not, what they are looking for. Then ask the user for the details that are still unknown.',
    inputSchema: { type: 'object', properties: { mobile: MOBILE, ...PROFILE_PROPS }, required: ['mobile', 'name'] },
    run: async (c, me, a) => {
      const r = c.repo.addCustomer({ ...a, ownerId: null }, me.id); if (r.error) return fail(r.error); // always created into nobody's basket: the admin assigns it
      const now = c.repo.customer(r.customer.mobile);
      return text({ saved: true, ...customerOut(now), ...fill(now), next: now.missing.length ? 'Now call complete_profile and follow it: look for the unknown details in the other tools you have connected (especially Zoho Books), save what you find, then ask the user the rest.' : undefined }); } },
  { name: 'complete_profile', description: 'Call this right after saving or opening a customer. It lists what is still unknown about them, with the answer options, in the order to ask. Work through it like this: (1) if you have a Zoho Books connector, find this customer there by mobile number and copy their company, email, GST number, city, state and pincode with update_customer, then read their invoices, sales orders and quotes and save them with save_zoho_books_documents; (2) for what is still unknown, look in every other tool you have connected (email, calendar, documents, web search) for facts about this customer; (3) save what you find with update_customer; (4) ask the user for the rest, two or three questions at a time, offering the options; (5) save their answers with update_customer.',
    inputSchema: { type: 'object', properties: { mobile: MOBILE }, required: ['mobile'] },
    run: (c, me, a) => { const x = c.repo.customer(a.mobile); if (!x) return fail('No customer with that mobile number');
      const order = ['zoho_status', 'company', 'about', 'address', 'city', 'state', 'source', 'buyer_type', 'business', 'looking_for', 'application', 'cell_format', 'monthly_volume', 'urgency', 'email', 'gstin'];
      const todo = x.missing.slice().sort((p, q) => order.indexOf(p.field) - order.indexOf(q.field));
      return text({ customer: x.name, mobile: x.mobile, known: customerOut(x), unknown: todo, how: todo.length ? 'First look the customer up in your Zoho Books connector (by mobile) and save what it has, then search your other connected tools for these facts, save what you find, and ask the user the rest: two or three questions at a time with the options.' : 'The profile is complete.' }); } },
  { name: 'save_zoho_books_documents', description: 'Saves what you read from Zoho Books about ONE customer into the portal, so the whole team sees it on the customer page with what to do next. Use it after you have found the customer in your Zoho Books connector (match them by mobile number) and read their invoices, sales orders and quotes from it. Send only real data you read from Zoho, never guesses. A document that was saved before is updated, so call it again whenever statuses change. Nothing is deleted.',
    inputSchema: { type: 'object', properties: { mobile: MOBILE,
      invoices: { type: 'array', description: 'Invoices from Zoho Books', items: { type: 'object', properties: { number: str('Invoice number'), date: str('YYYY-MM-DD'), due_date: str('YYYY-MM-DD'), total: { type: 'number' }, balance: { type: 'number', description: 'Amount still unpaid' }, status: str('draft, sent, overdue, partially_paid, paid or void'), payment_expected: str('YYYY-MM-DD'), lines: { type: 'array', items: { type: 'object', properties: { name: str('Item name'), quantity: { type: 'number' }, rate: { type: 'number' }, total: { type: 'number' } } } } }, required: ['number'] } },
      orders: { type: 'array', description: 'Sales orders from Zoho Books', items: { type: 'object', properties: { number: str('Sales order number'), date: str('YYYY-MM-DD'), total: { type: 'number' }, status: str('draft, open, closed or void'), shipped_status: str('not_shipped, partially_shipped or shipped'), invoiced_status: str('not_invoiced, partially_invoiced or invoiced'), lines: { type: 'array', items: { type: 'object', properties: { name: str('Item name'), quantity: { type: 'number' }, rate: { type: 'number' }, total: { type: 'number' } } } } }, required: ['number'] } },
      quotes: { type: 'array', description: 'Quotes (estimates) from Zoho Books', items: { type: 'object', properties: { number: str('Quote number'), date: str('YYYY-MM-DD'), expiry: str('YYYY-MM-DD'), total: { type: 'number' }, status: str('draft, sent, viewed, accepted, declined, expired or invoiced') }, required: ['number'] } } }, required: ['mobile'] },
    run: (c, me, a) => { const r = c.repo.saveBooksDocs(a.mobile, a, me.id); return r.error ? fail(r.error) : text({ saved: true, ...r, note: 'The customer page now shows these with the next step for each.' }); } },
  { name: 'update_customer', description: 'Adds or corrects details on an existing customer, found by mobile number. Only the details you send are changed, and a blank never erases anything. Use it whenever you learn something new about them.',
    inputSchema: { type: 'object', properties: { mobile: MOBILE, ...PROFILE_PROPS }, required: ['mobile'] },
    run: (c, me, a) => { const r = c.repo.updateCustomer(a.mobile, a, me.id); return r.error ? fail(r.error) : text({ saved: true, changed: r.changed, ...fill(r) }); } },
  { name: 'set_zoho_directory_status', description: 'Records whether this customer is created in the Zoho Books customer directory. Look them up in your Zoho Books connector by mobile number first, then call this with created true (and the name they have in Zoho) or false. The customer page shows a tile with the answer. If they are not there, tell the user that the customer still needs to be created in Zoho Books.',
    inputSchema: { type: 'object', properties: { mobile: MOBILE, created: { type: 'boolean', description: 'true if a customer with this mobile exists in Zoho Books' }, zoho_contact_name: str('Their name as it is in Zoho Books') }, required: ['mobile', 'created'] },
    run: (c, me, a) => { const r = c.repo.setZohoStatus(a.mobile, a.created === true, a.zoho_contact_name, me.id); return r.error ? fail(r.error) : text({ saved: true, zoho_directory: r.status === 'created' ? 'created' : 'not created yet', next: r.status === 'created' ? 'Now read their invoices, sales orders and quotes and save them with save_zoho_books_documents.' : 'Tell the user this customer still has to be created in Zoho Books.' }); } },
  { name: 'assign_customer', description: 'ADMIN ONLY: puts a customer in a team member\'s basket (who then pursues them), or takes them out. Team members cannot use it: a new customer sits in nobody\'s basket until the admin assigns it in the portal. Use list_team for usernames. Say "unassigned" to leave the customer with nobody.',
    inputSchema: { type: 'object', properties: { mobile: MOBILE, owner_username: str('The team member\'s username, or "unassigned"') }, required: ['mobile', 'owner_username'] },
    run: (c, me, a) => { if (me.role !== 'admin') return fail('Only the admin can change who a customer is assigned to. Ask the admin to do it in the portal (Customers page).'); const r = c.repo.assignCustomer(a.mobile, a.owner_username, me.id); return r.error ? fail(r.error) : text({ saved: true, assigned_to: r.owner || 'nobody (unassigned)' }); } },
  { name: 'save_customer_contact', description: 'Adds, or updates, another person at the customer\'s company (a buyer, engineer, accounts, owner...), each with their own mobile number. Calling it again with the same contact_mobile updates that person; blanks never erase anything.',
    inputSchema: { type: 'object', properties: { mobile: MOBILE, contact_mobile: str('This person\'s own 10-digit mobile number'), name: str('Their name'), role: str('Their role: buyer, engineer, accounts, owner...'), email: str('Their email'), notes: str('Anything useful, e.g. best time to call') }, required: ['mobile', 'contact_mobile', 'name'] },
    run: (c, me, a) => { const r = c.repo.saveContact(a.mobile, { mobile: a.contact_mobile, name: a.name, role: a.role, email: a.email, notes: a.notes }, me.id); return r.error ? fail(r.error) : text({ saved: true, created: r.created, contact: r.contact }); } },
  { name: 'log_interaction', description: 'Records something that happened with a customer: a call, WhatsApp chat, visit, quote, order, payment, dispatch or note. Add next_date (YYYY-MM-DD) when a follow-up is due, and amount for money.',
    inputSchema: { type: 'object', properties: { mobile: MOBILE, type: en(ENUMS.TYPES, 'What kind of event'), summary: str('What happened, in a sentence or two'), amount: { type: 'number', description: 'Money involved in rupees' }, next_date: str('Follow-up date, YYYY-MM-DD') }, required: ['mobile', 'type', 'summary'] },
    run: (c, me, a) => { const r = c.repo.addInteraction({ mobile: a.mobile, type: a.type, summary: a.summary, amount: a.amount, nextDate: a.next_date }, me.id);
      return r.error ? fail(r.error) : text({ saved: true, id: r.interaction.id, type: r.interaction.type, next_date: r.interaction.next_date }); } },
  { name: 'my_follow_ups', description: 'Lists the customers in your basket whose latest interaction has a follow-up date of today or earlier (overdue first).', inputSchema: { type: 'object', properties: {} },
    run: (c, me) => text(c.repo.followUps(me.id, today()).map((f) => ({ mobile: f.mobile, name: f.name, due: f.next_date, last_event: f.type, last_summary: f.summary }))) },
  { name: 'add_file', description: 'Attaches a SMALL file to a customer (up to 5 MB, sent as base64), with a description of one or two lines saying what it is. Claude cannot pass whole photos reliably, so a picture or document that must be kept exactly as it is should be added by the user from the customer page in the portal (Add a file button): say so instead of retrying. A file that arrives cut off or damaged is refused and nothing is saved.',
    inputSchema: { type: 'object', properties: { mobile: MOBILE, name: str('File name with its extension, e.g. payment.png'), note: str('One or two lines saying what the file is, e.g. "UPI payment screenshot for the 20 kg nickel order, 15 Nov"'), data_base64: str('The file contents as base64'), interaction_id: str('Optional: the interaction this belongs to') }, required: ['mobile', 'name', 'note', 'data_base64'] },
    run: (c, me, a) => { const data = String(a.data_base64 || '').replace(/^data:[^,]*,/, ''); if (!/^[A-Za-z0-9+/=\s]+$/.test(data)) return fail('data_base64 is not valid base64');
      const buffer = Buffer.from(data, 'base64'); if (buffer.length > MAX_FILE) return fail('The file is too big for Claude to pass (5 MB at most). Ask the user to add it from the portal page.');
      const r = c.repo.addFile({ mobile: a.mobile, interactionId: a.interaction_id, name: a.name, note: a.note, buffer }, me.id); return r.error ? fail(r.error) : text({ saved: true, id: r.file.id, name: r.file.name, size: r.file.size }); } },
  { name: 'customer_purchases', description: 'What has been saved from Zoho Books about a customer: their invoices, quotes and sales orders, the items they bought, what they owe, and the next step for every open document (for example "order placed: move it to invoicing", "not delivered yet", "overdue: call for payment"). If nothing is saved yet, read it from your Zoho Books connector and save it with save_zoho_books_documents.',
    inputSchema: { type: 'object', properties: { mobile: MOBILE }, required: ['mobile'] },
    run: (c, me, a) => { if (!c.repo.customer(a.mobile)) return fail('No customer with that mobile number');
      const b = books.forCustomer(c.repo, a.mobile, today());
      if (!b.synced) return text({ found: false, note: b.note });
      return text({ saved_at: b.syncedAt, saved_by: b.syncedBy, summary: b.summary, what_to_do: b.actions, sold_so_far: b.summary.billed, collected: b.summary.collected, still_to_collect: b.summary.outstanding,
        bought_by_category: b.boughtByCategory.map((g) => ({ category: g.category, value: g.value, items: g.items.slice(0, 10).map((x) => ({ item: x.name, quantity: x.quantity, value: x.value, times: x.times, last: x.last })) })),
        pending_quotes: b.pendingQuotes.map((q) => ({ number: q.number, date: q.date, total: q.total, status: q.status, next: q.next.action })),
        orders: b.orders.slice(0, 10).map((o) => ({ number: o.number, date: o.date, total: o.total, status: o.status, delivery: o.shipped, invoicing: o.invoiced, next: o.next.action })),
        invoices: b.invoices.slice(0, 10).map((i) => ({ number: i.number, date: i.date, total: i.total, balance: i.balance, status: i.status, due: i.dueDate, next: i.next.action })),
        quotes: b.quotes.slice(0, 10).map((q) => ({ number: q.number, date: q.date, total: q.total, status: q.status, next: q.next.action })) }); } },

  // ---------- items ----------
  { name: 'search_items', description: 'Finds our own items (from Zoho Commerce) by words in the name, code or category, e.g. "nickel strip 0.15". Returns up to 10 with their id, price and stock. Use the id when linking a vendor rate.',
    inputSchema: { type: 'object', properties: { query: str('Words from the item name, code or category'), category: str('Only this category') }, required: ['query'] },
    run: (c, me, a) => text(c.repo.items({ q: a.query, category: a.category }).slice(0, 10).map((i) => ({ id: i.id, sku: i.sku, name: i.name, category: i.category, price: i.price, stock: i.stock, unit: i.unit, best_vendor_rate: i.best }))) },
  { name: 'get_item', description: 'Shows one item with its description and every vendor who offers it, cheapest first.', inputSchema: { type: 'object', properties: { item_id: str('The item id from search_items') }, required: ['item_id'] },
    run: (c, me, a) => { const i = c.repo.item(a.item_id); return i ? text({ id: i.id, sku: i.sku, name: i.name, category: i.category, price: i.price, stock: i.stock, unit: i.unit, moq: i.moq, collections: i.collections, description: i.description.slice(0, 1500), suppliers: i.suppliers, notes: i.notes.slice(0, 10).map((n) => ({ text: n.text, by: n.by_name, at: n.at })), attachments: i.attachments.map((x) => ({ name: x.name, note: x.note, by: x.by_name, at: x.at })), recent_updates: i.log.slice(0, 12).map((e) => ({ at: e.at, by: e.by, what: e.title + (e.text ? ': ' + e.text : '') })) }) : fail('Item not found'); } },

  // ---------- vendors (suppliers) ----------
  { name: 'add_vendor', description: 'Adds a supplier. THE RULE: a vendor can only be added together with at least one of OUR items that they supply, so first find the item(s) with search_items (for example a cell vendor: search the cell model) and send their ids in item_ids. If none of our items matches what they supply, do not add the vendor: tell the user instead. The mobile number is required and unique. Afterwards use log_vendor_rate for rates.',
    inputSchema: { type: 'object', properties: { mobile: MOBILE, name: str('Vendor name'), item_ids: { type: 'array', items: { type: 'string' }, description: 'Ids of OUR items they supply, from search_items. At least one.' }, company: str('Company'), email: str('Email'), city: str('City'), state: str('State'), gstin: str('GST number'), notes: str('Anything useful: terms, reliability, how you found them') }, required: ['mobile', 'name', 'item_ids'] },
    run: (c, me, a) => { const r = c.repo.addVendor({ ...a, itemIds: a.item_ids }, me.id); return r.error ? fail(r.error) : text({ saved: true, mobile: r.vendor.mobile, name: r.vendor.name, supplies: r.vendor.items.map((i) => i.name), next: 'Now record their rates with log_vendor_rate.' }); } },
  { name: 'link_vendor_items', description: 'Adds more of OUR items to a vendor, found by mobile number, when they supply more. Item ids come from search_items.',
    inputSchema: { type: 'object', properties: { mobile: MOBILE, item_ids: { type: 'array', items: { type: 'string' }, description: 'Ids of our items, from search_items' } }, required: ['mobile', 'item_ids'] },
    run: (c, me, a) => { const r = c.repo.linkVendorItems(a.mobile, a.item_ids, me.id); return r.error ? fail(r.error) : text({ saved: true, newly_linked: r.linked, supplies: r.vendor.items.map((i) => i.name) }); } },
  { name: 'update_vendor', description: 'Adds or corrects a vendor\'s details, found by mobile number. Blanks never erase anything.',
    inputSchema: { type: 'object', properties: { mobile: MOBILE, name: str('Vendor name'), company: str('Company'), email: str('Email'), city: str('City'), state: str('State'), gstin: str('GST number'), address: str('Full address'), about: str('What the company does and supplies'), payment_terms: str('Payment terms, e.g. 15 days credit, advance'), lead_time: str('How long they take to deliver'), min_order: str('Minimum order'), notes: str('Notes') }, required: ['mobile'] },
    run: (c, me, a) => { const r = c.repo.updateVendor(a.mobile, a, me.id); return r.error ? fail(r.error) : text({ saved: true, changed: r.changed }); } },
  { name: 'add_note', description: 'Adds a dated note to a vendor (key = their mobile number) or to one of our items (key = item id from search_items): anything worth remembering, such as "pays in 15 days", "thickness varies, check on delivery", "quality was poor in the last lot". Notes are kept in order, with your name.',
    inputSchema: { type: 'object', properties: { kind: en(['vendor', 'item'], 'Whether the note is about a vendor or an item'), key: str('The vendor\'s mobile number, or the item id'), text: str('The note') }, required: ['kind', 'key', 'text'] },
    run: (c, me, a) => { const r = c.repo.addNote(a.kind, a.key, a.text, me.id); return r.error ? fail(r.error) : text({ saved: true, about: r.subject }); } },
  { name: 'add_attachment', description: 'Attaches a SMALL file to a vendor (key = mobile number) or to one of our items (key = item id), with a description of one or two lines saying what it is. Claude cannot pass whole photos or large documents reliably, so a price list, quotation or photo that must be kept exactly as it is should be added by the user from that vendor or item page in the portal (Add a file button): say so instead of retrying. A file that arrives cut off or damaged is refused and nothing is saved.',
    inputSchema: { type: 'object', properties: { kind: en(['vendor', 'item'], 'Vendor or item'), key: str('The vendor\'s mobile number, or the item id'), name: str('File name with its extension, e.g. price-list-nov.pdf'), note: str('One or two lines saying what the file is, e.g. "Saurav November price list, valid till 30 Nov"'), data_base64: str('The file contents as base64') }, required: ['kind', 'key', 'name', 'note', 'data_base64'] },
    run: (c, me, a) => { const data = String(a.data_base64 || '').replace(/^data:[^,]*,/, ''); if (!/^[A-Za-z0-9+/=\s]+$/.test(data)) return fail('data_base64 is not valid base64');
      const buffer = Buffer.from(data, 'base64'); if (buffer.length > MAX_FILE) return fail('The file is too big for Claude to pass (5 MB at most). Ask the user to add it from the portal page.');
      const r = c.repo.addAttachment({ kind: a.kind, key: a.key, name: a.name, note: a.note, buffer }, me.id); return r.error ? fail(r.error) : text({ saved: true, attached_to: r.subject, name: r.attachment.name }); } },
  { name: 'recent_updates', description: 'What changed lately on vendors and items, newest first: rates, notes, files, new vendors, and who now supplies what. Optionally for one item or one vendor.',
    inputSchema: { type: 'object', properties: { item_id: str('Only this item'), vendor_mobile: str('Only this vendor'), limit: { type: 'number', description: 'How many, default 20' } } },
    run: (c, me, a) => text(c.repo.events({ itemId: a.item_id, vendorMobile: a.vendor_mobile, limit: Math.min(Number(a.limit) || 20, 60) }).map((e) => ({ at: e.at, by: e.by, type: e.type, what: e.title + (e.text ? ': ' + e.text : '') }))) },
  { name: 'search_vendors', description: 'Finds vendors by name, company, city, mobile, notes, or a material they have offered. Empty query lists the most recently active.', inputSchema: { type: 'object', properties: { query: str('Words or a mobile number') } },
    run: (c, me, a) => text(c.repo.vendors({ q: a.query }).slice(0, 25).map((v) => ({ mobile: v.mobile, name: v.name, company: v.company, city: v.city, items_supplied: v.materials, last_rate_on: v.last_offer }))) },
  { name: 'get_vendor', description: 'Shows one vendor by mobile number with the latest rate for each material they offered, and the full rate history.',
    inputSchema: { type: 'object', properties: { mobile: MOBILE }, required: ['mobile'] },
    run: (c, me, a) => { const v = c.repo.vendor(a.mobile); if (!v) return fail('No vendor with that mobile number');
      const o = (x) => ({ offer_id: x.id, material: x.item_name || x.item_text, linked_item_id: x.item_id, rate: x.rate, unit: x.unit, quantity: x.quantity, valid_till: x.valid_till, offered_on: x.offer_date, note: x.note, by: x.by_name });
      return text({ mobile: v.mobile, name: v.name, company: v.company, address: v.address, about: v.about, payment_terms: v.payment_terms, lead_time: v.lead_time, min_order: v.min_order, city: v.city, state: v.state, gstin: v.gstin, notes: v.notes, dated_notes: v.notes_list.slice(0, 10).map((n) => ({ text: n.text, by: n.by_name, at: n.at })), attachments: v.attachments.map((x) => ({ name: x.name, note: x.note, by: x.by_name, at: x.at })), recent_updates: v.log.slice(0, 12).map((e) => ({ at: e.at, by: e.by, what: e.title + (e.text ? ': ' + e.text : '') })), supplies: v.items.map((i) => ({ item_id: i.id, item: i.name, sku: i.sku, latest_rate: i.rate, unit: i.unit, rate_date: i.offer_date })), latest_rates: v.latest.map(o), history: v.offers.slice(0, 40).map(o) }); } },
  { name: 'log_vendor_rate', description: 'Records that a vendor has a material available at a rate (done day after day as vendors send new prices). The rate must be for one of OUR items: send item_id from search_items, or the material\'s name when exactly one of our items matches it. If no item matches, or several do, nothing is saved and the answer says why, so pick the right item_id and call again. The vendor is linked to the item automatically.',
    inputSchema: { type: 'object', properties: { vendor_mobile: MOBILE, item_id: str('Our item id from search_items'), material: str('The material as the vendor describes it (used to find our item if no item_id)'), rate: { type: 'number', description: 'Rate in rupees' }, unit: str('Per what: kg, piece, metre...'), quantity: str('How much is available, or the minimum order'), valid_till: str('Rate valid until, YYYY-MM-DD'), note: str('Anything else'), offered_on: str('Date of the rate, YYYY-MM-DD, default today') }, required: ['vendor_mobile', 'rate'] },
    run: (c, me, a) => { const r = c.repo.addOffer({ vendorMobile: a.vendor_mobile, itemId: a.item_id, itemText: a.material, rate: a.rate, unit: a.unit, quantity: a.quantity, validTill: a.valid_till, note: a.note, offerDate: a.offered_on }, me.id);
      return r.error ? fail(r.error) : text({ saved: true, offer_id: r.offer.id, item: r.mappedTo }); } },
  { name: 'map_vendor_rate', description: 'Links an older vendor rate that has no item yet to one of our items.', inputSchema: { type: 'object', properties: { offer_id: str('The offer id'), item_id: str('Our item id') }, required: ['offer_id', 'item_id'] },
    run: (c, me, a) => { const r = c.repo.mapOffer(a.offer_id, a.item_id, me.id); return r.error ? fail(r.error) : text({ saved: true, linked_to: r.item }); } },
  { name: 'find_suppliers', description: 'Who can supply a material, cheapest first: each vendor\'s latest rate, with how old it is and whether it has expired. Give an item_id or words like "nickel strip 0.15".',
    inputSchema: { type: 'object', properties: { item_id: str('Our item id'), query: str('Words describing the material') } },
    run: (c, me, a) => { if (!a.item_id && !a.query) return fail('Give an item_id or some words'); return text(c.repo.findSuppliers({ itemId: a.item_id, query: a.query }).slice(0, 25)); } },
];

const PROMPTS = [
  { name: 'new_lead', description: 'Save a new prospect from an email, chat or call note you paste, then complete their profile', arguments: [{ name: 'text', description: 'The email, chat or note', required: true }],
    text: (a) => 'Here is something about a new prospect:\n\n' + (a.text || '') + '\n\nPull out their mobile number (ask me if it is missing), name, company, city and state, where they came from, whether they are a trader or an OEM, their address, what the company does, their kind of business, the other people there, what they are looking for, what for, cell type, quantity and urgency. Search the portal first so you do not duplicate them, save them with add_customer or update_customer, log this as an interaction, then call complete_profile and fill the rest from my other connected tools before asking me anything.' },
  { name: 'complete_customer_profile', description: 'Fill in what is missing about a customer', arguments: [{ name: 'mobile', description: 'The customer\'s mobile number', required: true }],
    text: (a) => 'Complete the profile of the customer with mobile ' + (a.mobile || '') + ': call complete_profile, look the customer up in my Zoho Books connector and save what it has, look for the unknown details in my other connected tools, save what you find, then ask me the rest two or three questions at a time.' },
  { name: 'sync_from_zoho', description: 'Bring a customer\'s Zoho Books details, invoices, orders and quotes into the portal', arguments: [{ name: 'mobile', description: 'The customer\'s mobile number', required: true }],
    text: (a) => 'Sync the customer with mobile ' + (a.mobile || '') + ' from Zoho Books: find them in my Zoho Books connector by mobile number and record the answer with set_zoho_directory_status (created true or false; if there is no match, tell me they still need to be created in Zoho Books and stop). Copy their company, email, GST number, city, state and pincode with update_customer (never overwrite what the portal already has). Then read all their invoices, sales orders (with delivered and invoiced status) and quotes, including the item lines, and save them with save_zoho_books_documents. Finally call customer_purchases and tell me what needs doing next.' },
  { name: 'log_vendor_rates', description: 'Record today\'s rates from a vendor', arguments: [{ name: 'text', description: 'What the vendor sent: material and rates', required: true }],
    text: (a) => 'A vendor sent these rates:\n\n' + (a.text || '') + '\n\nFind the vendor by mobile (if new, add them with add_vendor, but only together with the item_ids of our items they supply; ask me for the mobile if it is missing), then record each material with log_vendor_rate, always for one of our items (search_items first). Do not add a vendor or a rate that does not match one of our items: tell me which ones could not be matched.' },
];
const INSTRUCTIONS = (me) => 'You are connected as ' + me.name + '. Everything you save is recorded under this name. ' +
  'A customer is either a trader (buys to resell) or an OEM (makes its own products with it). A customer is created by a team member with no basket; only the admin puts a customer in a team member basket (do not try: tell the user to ask the admin). Other people at the customer company are saved with save_customer_contact. A customer or vendor is identified by mobile number, which must be unique: search first, and if one exists use update_ instead of add_. A VENDOR MUST ALWAYS BE LINKED TO OUR ITEMS: before add_vendor, find the item(s) they supply with search_items and send item_ids; before log_vendor_rate, find the item and send its item_id. If none of our items matches what a vendor supplies, do not add the vendor or the rate: tell the user what you could not match. ' +
  'When the user gives you an email, a chat or call notes about a prospect, pull out everything you can (mobile, name, company, city and state, where they came from, trader or non-trader, what business, what they are looking for, what for, cell type, volume, urgency) and save it with add_customer or update_customer, then ask for the details still unknown. A mobile number is required: ask for it if it is missing. ' +
  'After you save or open a customer, call complete_profile and follow it: if you have a Zoho Books connector, look the customer up there by mobile number, copy their details with update_customer and save their invoices, sales orders and quotes with save_zoho_books_documents; then look in the other tools you have connected (email, calendar, documents, web search) for the unknown details and save what you find; only then ask the user for the rest, two or three questions at a time with the options. Do not stop after saving. ' +
  'Customers buy nickel strip, battery cells, BMS, busbars and holders, so ask about those. Use customer_purchases to see what has been saved from Zoho Books and what to do next; the portal has no Zoho access of its own, so only you can bring that data in. Photos and documents: you cannot pass whole files reliably, so when the user wants a picture or document kept, tell them to add the original from the portal page (Add a file button) rather than retrying; always give a one or two line description of what a file is. Never invent a detail you were not given.';

// one JSON-RPC message in, one reply out (null when no reply is wanted)
async function handle(ctx, me, msg) {
  const reply = (result) => ({ jsonrpc: '2.0', id: msg.id, result });
  const error = (code, message) => ({ jsonrpc: '2.0', id: msg.id == null ? null : msg.id, error: { code, message } });
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return error(-32600, 'Invalid request');
  if (msg.id === undefined) return null; // a notification, such as "initialized"
  switch (msg.method) {
    case 'initialize': {
      const asked = msg.params && msg.params.protocolVersion;
      return reply({ protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0], capabilities: { tools: {}, prompts: {} }, serverInfo: { name: 'arambhika-portal', version: '2.0.0' }, instructions: INSTRUCTIONS(me) });
    }
    case 'ping': return reply({});
    case 'prompts/list': return reply({ prompts: PROMPTS.map(({ name, description, arguments: args }) => ({ name, description, arguments: args })) });
    case 'prompts/get': {
      const p = PROMPTS.find((x) => x.name === (msg.params && msg.params.name));
      if (!p) return error(-32602, 'Unknown prompt');
      return reply({ description: p.description, messages: [{ role: 'user', content: { type: 'text', text: p.text((msg.params && msg.params.arguments) || {}) } }] });
    }
    case 'tools/list': return reply({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === (msg.params && msg.params.name));
      if (!tool) return error(-32602, 'Unknown tool');
      const args = (msg.params && msg.params.arguments) || {};
      if (typeof args !== 'object' || Array.isArray(args)) return reply(fail('The arguments must be an object'));
      // a Claude that still holds the older tool list sends "phone"; treat it as the mobile number
      if (args.mobile == null) { const alt = args.phone || args.mobile_number || args.phone_number || args.customer_id; if (alt) args.mobile = alt; } // the older tools took customer_id: a mobile number given there is understood
      try { return reply(await tool.run(ctx, me, args)); } catch (e) { return reply(fail('Something went wrong. Nothing was changed.')); }
    }
    default: return error(-32601, 'Method not found');
  }
}

// a short fingerprint of every tool definition, shown on /health, so it is easy to tell which version a server is serving
const schemaHash = () => require('crypto').createHash('sha256').update(JSON.stringify(TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })))).digest('hex').slice(0, 8);

module.exports = { handle, TOOLS, schemaHash };
