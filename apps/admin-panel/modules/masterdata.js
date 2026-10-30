// The customer master list (customers.json) and the three files it is built from with the team's work:
//   call10.json        every row written in "Call 10 people"
//   find4.json         every row written in "Find 4 customers"
//   newrequests.json   customers logged by hand in Customer requests
// customers.json holds every customer in Zoho Books (with quotes, invoices, bills, orders, items and item categories) plus the leads
// found by the team. People are matched by mobile number; a lead becomes a customer when a paid invoice for that number appears in Zoho.
//
// Keeping it fresh without running into Zoho's daily call limit:
//   - Zoho can call POST /hooks/zoho?token=... when something changes; the panel then looks again within 30 seconds
//   - a full safety check runs every 30 minutes (MASTER_SYNC_MINUTES changes it), and the team's own work is folded in a second after it is saved
// All of it is read only: nothing is ever written to Zoho.
'use strict';
const M = require('../lib/master');
const { nowISO } = require('../lib/util');

const FULL_EVERY_MS = (Math.max(Number(process.env.MASTER_SYNC_MINUTES) || 30, 1)) * 60 * 1000;
const QUICK_GAP_MS = 30 * 1000;
const LINES_PER_CYCLE = 10; // sales orders whose item lines are fetched in one pass (each needs its own Zoho call)

module.exports = function masterdata(app, ctx) {
  let snapshot = null; // the last data read from Zoho
  let running = null;
  let rebuildTimer = null; let quickTimer = null; let lastQuickStart = 0;
  const status = { lastFullAt: '', lastQuickAt: '', lastWebhookAt: '', lastBuildAt: '', error: '', counts: {}, webhookOn: false };

  const replace = (name, rows) => { const c = ctx.col(name); c.length = 0; c.push(...rows); ctx.save(name); };
  const lineStore = () => ctx.col('orderlines'); // [{ id, items }]: order item lines already fetched, so each is fetched once

  function sources() {
    const tasks = ctx.col('tasks');
    const call10 = M.taskRows(tasks, /call\s*10/i, 'call10');
    const find4 = M.taskRows(tasks, /find\s*4/i, 'find4');
    const requests = M.requestRows(ctx.requests.list());
    return { call10, find4, requests };
  }

  // rebuild the three team files and the master list from what we hold now (no Zoho call)
  function rebuild() {
    const s = sources();
    const named = (rows) => rows.map((r) => ({ ...r, userName: ctx.userName(r.userId) }));
    replace('call10', named(s.call10)); replace('find4', named(s.find4)); replace('newrequests', named(s.requests));
    const z = snapshot || {};
    const lines = {}; for (const l of lineStore()) lines[l.id] = l.items;
    const manual = {}; for (const c of ctx.col('leadconv')) manual[c.id] = c.date;
    const records = M.buildMaster({ ...z, lines, sources: [...s.call10, ...s.find4, ...s.requests], manual, userName: ctx.userName });
    replace('customers', records);
    status.lastBuildAt = nowISO(); status.counts = { ...M.summary(records), call10: s.call10.length, find4: s.find4.length, requests: s.requests.length };
  }

  // a pull from Zoho. "quick" reads what changes often (customers, invoices, quotes, orders); "full" also reads bills and items.
  function sync(kind) {
    if (running) return running;
    running = (async () => {
      try {
        if (!ctx.zoho.configured) { status.error = 'Zoho is not connected to this panel yet'; return; }
        const o = { refresh: true }; const z = ctx.zoho;
        const cust = await z.customers(o); const invoices = await z.invoices(o);
        const estimates = z.estimates ? await z.estimates(o) : []; const orders = await z.salesOrders(o);
        const full = kind === 'full' || !snapshot;
        const bills = full ? (z.bills ? await z.bills(o) : []) : snapshot.bills;
        const items = full ? (z.items ? await z.items(o) : []) : snapshot.items;
        if (z.orderLines) {
          const have = new Set(lineStore().map((l) => l.id)); let n = 0;
          for (const ord of orders) {
            if (have.has(ord.id)) continue; if (n >= LINES_PER_CYCLE) break; n += 1;
            try { lineStore().push({ id: ord.id, items: await z.orderLines(ord.id) }); } catch (e) { break; } // try again next time
          }
          ctx.save('orderlines');
        }
        snapshot = { contacts: cust.list, invoices, estimates, bills, items, orders };
        status.error = ''; if (full) status.lastFullAt = nowISO(); status.lastQuickAt = nowISO();
      } catch (err) { status.error = err.message; } finally { running = null; }
      rebuild(); // even when Zoho failed: the team's work still reaches the files
    })();
    return running;
  }

  // Zoho says something changed: look again, but never more often than every 30 seconds
  function webhook() {
    status.lastWebhookAt = nowISO();
    const wait = lastQuickStart + QUICK_GAP_MS - Date.now();
    if (wait <= 0) { lastQuickStart = Date.now(); sync('quick'); return; }
    if (quickTimer) return;
    quickTimer = setTimeout(() => { quickTimer = null; lastQuickStart = Date.now(); sync('quick'); }, wait); quickTimer.unref();
  }
  ctx.hooks.zoho = webhook;

  // the team's own work: fold it in a second after it is saved
  ctx.saveHooks.push((name) => {
    if (name !== 'tasks' && name !== 'requests') return;
    clearTimeout(rebuildTimer); rebuildTimer = setTimeout(() => { try { rebuild(); } catch (e) { status.error = e.message; } }, 1000); rebuildTimer.unref();
  });

  ctx.master = {
    start() {
      status.webhookOn = Boolean(process.env.ZOHO_WEBHOOK_SECRET);
      const first = setTimeout(() => sync('full'), 3000); first.unref();
      const every = setInterval(() => sync('full'), FULL_EVERY_MS); every.unref();
    },
    sync, rebuild,
  };

  const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => res.status(500).json({ error: err.message }));
  app.get('/api/master/status', ctx.requireAdmin, (req, res) => res.json({ ...status, webhookOn: status.webhookOn || Boolean(process.env.ZOHO_WEBHOOK_SECRET), zohoConfigured: ctx.zoho.configured }));
  app.post('/api/master/sync', ctx.requireAdmin, wrap(async (req, res) => {
    await sync('full'); ctx.log(req.user, 'Refreshed the customer master list');
    res.json({ ...status });
  }));
  // the four files themselves, for the owner to download
  app.get('/api/master/file/:name', ctx.requireAdmin, (req, res) => {
    if (!['customers', 'call10', 'find4', 'newrequests'].includes(req.params.name)) return res.status(404).json({ error: 'Not found' });
    res.set({ 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="' + req.params.name + '.json"' });
    res.send(JSON.stringify(ctx.col(req.params.name), null, 1));
  });
  // the owner turns a lead into a customer by hand (or undoes it)
  app.post('/api/master/convert', ctx.requireAdmin, (req, res) => {
    const id = String((req.body && req.body.id) || '');
    const rec = ctx.col('customers').find((r) => r.id === id);
    if (!rec || !rec.lead) return res.status(404).json({ error: 'That lead was not found' });
    const list = ctx.col('leadconv');
    if (req.body.undo) { const at = list.findIndex((c) => c.id === id); if (at >= 0) list.splice(at, 1); }
    else if (!list.some((c) => c.id === id)) list.push({ id, date: ctx.todayIST(), at: nowISO(), byName: req.user.name });
    ctx.save('leadconv'); rebuild();
    ctx.log(req.user, (req.body.undo ? 'Turned ' : 'Converted ') + rec.name + (req.body.undo ? ' back into a lead' : ' from a lead to a customer'));
    res.json({ ok: true });
  });
  app.get('/api/master/customers', (req, res) => {
    let list = ctx.col('customers');
    if (['lead', 'customer'].includes(req.query.stage)) list = list.filter((r) => r.stage === req.query.stage);
    if (req.query.unmatched === '1') list = list.filter((r) => r.unmatched);
    if (req.query.leads === '1') list = list.filter((r) => r.lead);
    const q = String(req.query.q || '').trim().toLowerCase();
    if (q) list = list.filter((r) => (r.name + ' ' + r.company + ' ' + r.phone + ' ' + r.email).toLowerCase().includes(q));
    res.json({ total: list.length, customers: list.slice(0, 500) });
  });
};
