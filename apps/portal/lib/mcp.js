// The MCP server: lets a team member's Claude read and update customer data. It speaks plain JSON-RPC over HTTP POST
// (the "streamable HTTP" transport, answering with JSON). Every call is made as one signed-in member, so every write is
// stamped with their name. There is deliberately no tool that deletes anything.
'use strict';
const { TYPES } = require('./db');

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const MAX_FILE = 5 * 1024 * 1024;
const today = () => new Date().toISOString().slice(0, 10);
const text = (v) => ({ content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 2) }] });
const fail = (msg) => ({ isError: true, content: [{ type: 'text', text: msg }] });
const str = (s) => ({ type: 'string', description: s });

const TOOLS = [
  { name: 'who_am_i', description: 'Shows which team member you are signed in as. Everything you save is recorded under this name.', inputSchema: { type: 'object', properties: {} },
    run: (repo, me) => text({ name: me.name, username: me.username, today: today() }) },
  { name: 'list_team', description: 'Lists the active team members (names and usernames), for choosing an owner.', inputSchema: { type: 'object', properties: {} },
    run: (repo) => text(repo.members().filter((m) => m.active).map((m) => ({ name: m.name, username: m.username }))) },
  { name: 'search_customers', description: 'Finds customers by name, company, phone number or city. Leave the query empty to list the most recently active ones. Returns up to 25.',
    inputSchema: { type: 'object', properties: { query: str('Part of a name, company, city, or a phone number'), owner_username: str('Only customers owned by this team member') } },
    run: (repo, me, a) => {
      let owner = '';
      if (a.owner_username) { const o = repo.memberByUsername(a.owner_username); if (!o) return fail('No active team member with that username'); owner = o.id; }
      return text(repo.customers({ q: a.query, owner }).slice(0, 25).map((c) => ({ id: c.id, name: c.name, company: c.company, phone: c.phone, city: c.city, owner: c.owner_name, last_interaction: c.last_at, interactions: c.interactions, next_follow_up: c.next_follow_up })));
    } },
  { name: 'get_customer', description: 'Shows one customer with their full history (calls, quotes, orders, payments and so on, newest first) and files.',
    inputSchema: { type: 'object', properties: { customer_id: str('The customer id from search_customers') }, required: ['customer_id'] },
    run: (repo, me, a) => {
      const c = repo.customer(String(a.customer_id || ''));
      if (!c) return fail('Customer not found');
      return text({ id: c.id, name: c.name, company: c.company, phone: c.phone, email: c.email, city: c.city, owner: c.owner_name,
        interactions: c.interactions.slice(0, 50).map((i) => ({ id: i.id, type: i.type, summary: i.summary, amount: i.amount, next_date: i.next_date, by: i.by_name, at: i.at })),
        files: c.files.map((f) => ({ id: f.id, name: f.name, size: f.size, by: f.by_name, at: f.at })) });
    } },
  { name: 'add_customer', description: 'Adds a new customer. You become the owner unless you name someone else. Refuses a phone number that already belongs to a customer.',
    inputSchema: { type: 'object', properties: { name: str('Customer or contact name'), company: str('Company'), phone: str('Phone number'), email: str('Email'), city: str('City'), owner_username: str('Owner, if not you') }, required: ['name'] },
    run: (repo, me, a) => {
      let owner = me.id;
      if (a.owner_username) { const o = repo.memberByUsername(a.owner_username); if (!o) return fail('No active team member with that username'); owner = o.id; }
      const r = repo.addCustomer({ name: a.name, company: a.company, phone: a.phone, email: a.email, city: a.city, ownerId: owner }, me.id);
      return r.error ? fail(r.error) : text({ saved: true, id: r.customer.id, name: r.customer.name });
    } },
  { name: 'log_interaction', description: 'Records something that happened with a customer: a call, WhatsApp chat, visit, quote, order, payment, dispatch or note. Add next_date (YYYY-MM-DD) when a follow-up is due, and amount for money.',
    inputSchema: { type: 'object', properties: { customer_id: str('The customer id'), type: { type: 'string', enum: TYPES, description: 'What kind of event' }, summary: str('What happened, in a sentence or two'), amount: { type: 'number', description: 'Money involved in rupees, for quotes, orders and payments' }, next_date: str('Follow-up date, YYYY-MM-DD') }, required: ['customer_id', 'type', 'summary'] },
    run: (repo, me, a) => {
      const r = repo.addInteraction({ customerId: String(a.customer_id || ''), type: a.type, summary: a.summary, amount: a.amount, nextDate: a.next_date }, me.id);
      return r.error ? fail(r.error) : text({ saved: true, id: r.interaction.id, type: r.interaction.type, next_date: r.interaction.next_date });
    } },
  { name: 'my_follow_ups', description: 'Lists your customers whose latest interaction has a follow-up date of today or earlier (overdue first).',
    inputSchema: { type: 'object', properties: {} },
    run: (repo, me) => text(repo.followUps(me.id, today()).map((f) => ({ customer_id: f.id, name: f.name, phone: f.phone, due: f.next_date, last_event: f.type, last_summary: f.summary }))) },
  { name: 'add_file', description: 'Attaches a small file or picture (up to 5 MB, sent as base64) to a customer, optionally to one interaction, for example a payment screenshot.',
    inputSchema: { type: 'object', properties: { customer_id: str('The customer id'), name: str('File name, e.g. payment.png'), mime_type: str('e.g. image/png, image/jpeg, application/pdf'), data_base64: str('The file contents as base64'), interaction_id: str('Optional: the interaction this belongs to') }, required: ['customer_id', 'name', 'data_base64'] },
    run: (repo, me, a) => {
      const data = String(a.data_base64 || '').replace(/^data:[^,]*,/, '');
      if (!/^[A-Za-z0-9+/=\s]+$/.test(data)) return fail('data_base64 is not valid base64');
      const buffer = Buffer.from(data, 'base64');
      if (buffer.length > MAX_FILE) return fail('The file is too big (5 MB at most)');
      const r = repo.addFile({ customerId: String(a.customer_id || ''), interactionId: a.interaction_id, name: a.name, mime: a.mime_type, buffer }, me.id);
      return r.error ? fail(r.error) : text({ saved: true, id: r.file.id, name: r.file.name, size: r.file.size });
    } },
];

// one JSON-RPC message in, one reply out (null when no reply is wanted)
function handle(repo, me, msg) {
  const reply = (result) => ({ jsonrpc: '2.0', id: msg.id, result });
  const error = (code, message) => ({ jsonrpc: '2.0', id: msg.id == null ? null : msg.id, error: { code, message } });
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return error(-32600, 'Invalid request');
  if (msg.id === undefined) return null; // a notification, such as "initialized"
  switch (msg.method) {
    case 'initialize': {
      const asked = msg.params && msg.params.protocolVersion;
      return reply({ protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0], capabilities: { tools: {} }, serverInfo: { name: 'arambhika-portal', version: '1.0.0' },
        instructions: 'You are connected as ' + me.name + '. Search for a customer before adding one, so you do not create duplicates. Everything you save is recorded under ' + me.name + '.' });
    }
    case 'ping': return reply({});
    case 'tools/list': return reply({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === (msg.params && msg.params.name));
      if (!tool) return error(-32602, 'Unknown tool');
      const args = (msg.params && msg.params.arguments) || {};
      if (typeof args !== 'object' || Array.isArray(args)) return reply(fail('The arguments must be an object'));
      try { return reply(tool.run(repo, me, args)); } catch (e) { return reply(fail('Something went wrong saving that. Nothing was changed.')); }
    }
    default: return error(-32601, 'Method not found');
  }
}

module.exports = { handle, TOOLS };
