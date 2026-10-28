# Arambhika Admin Panel

Staff-only site at `https://admin.arambhika.com` (dev droplet only, never part of the website release). The owner designs
the work, the team does it, and everyone can see where things stand.

## What it does

**The owner (`admin` + the `ADMIN_PANEL_PASSWORD` secret)**
- **Dashboard:** each team member's percent done today and work left, how much was carried over, call follow-ups running late,
  open customer requests (and how many were not touched today), who has not started, invoice follow-up health, the Zoho connection.
- **Task designer:** design any task, or use **Quick start** for the usual ones.
  - *Fill in rows* ("Call 10 people": phone, name, company, what was discussed, follow-up date), *Checklist*, *Counter*.
  - Daily (working days), weekly (Monday to Sunday) or one-time (stays until done), for any people.
  - **Quick task:** a one-time task for today ("Send the new price list to dealers") given to one or both people.
  - **Carry forward what was missed:** 8 of 10 calls today means 12 tomorrow (up to the limit you set, default = the daily target).
- **Team work** (anyone's tasks for any day), **Team** (add people, set passwords), **Follow-up rules** (what happened -> when to follow up,
  and the **working days**, Monday to Saturday by default), **Activity** (who did what and when), **Office** (approve transactions).
- **Customer requests, Customers, Invoices:** see everyone's; assign owners; "Share unowned customers evenly".

**Team members (password set by the owner)** see only their own work:
- **My day:** one percentage for everything, what is left, follow-up calls due, unfinished customer requests, tasks.
- **Tasks:** cells to fill, each saved with the time and their name. **Follow-up calls due** sit at the top until they are logged.
- **Customer requests:** a customer messages on WhatsApp, they log it, and tick six steps: *asked what is required*, *quote sent and
  payment asked*, *payment received (with the screenshot)*, *material ready*, *dispatched*, *sent successfully*. Every step is a checkbox
  with a time and a name; steps can be ticked in any order, and payment needs its screenshot first.
- **Customers, Invoices** (their own list from Zoho), **Office** (send a transaction for approval).

## How work carries over
- **Daily rows / counters:** the first time somebody opens the panel on a working day, that day's work is created. Target = base + what was
  left over yesterday (capped). Working days nobody opened are filled in (up to 7 days back) so a miss is not forgotten. Days off add nothing.
- **Weekly:** one card for the week; next week's target = base + this week's shortfall.
- **Call follow-ups:** a call row with a follow-up date comes back in "Follow-up calls due" on that date, and stays (with "N days late") until the
  person logs it (what was said, and the next date or none). They are extra work on top of the daily 10.
- **Customer requests:** every request that is not "sent successfully" is listed again every day for its owner; it counts as one piece of work
  per day, done when it is touched (a step ticked or a note added). A request not touched for a day is flagged to the owner.
- **One-time tasks:** stay until done.

## What comes from Zoho, at runtime
Read-only, from Zoho Books, kept in memory for 5 minutes ("Refresh from Zoho" forces a pull). Nothing is copied to disk or written to Zoho.
- **Customers** (contact list, or rebuilt from invoices if the saved login cannot read contacts) and whether each is **onboarded** (invoiced before).
- **Invoices:** unpaid ones with due date, balance and phone; a paid invoice disappears by itself.
- **Website orders** (sales orders) appear in Customer requests by themselves (source "Website"); payment, ready, dispatched and sent tick from Zoho.

What the panel itself stores (JSON files in `DATA_DIR`, plus payment screenshots in `DATA_DIR/uploads`): team members, task designs and the work done,
customer requests, who owns which customer/invoice, follow-up history, transactions, the activity feed and settings.

## How "done" is counted
Today's work = every row, step or target of today's tasks (including what carried over) + call follow-ups due + customer and invoice follow-ups
due + customer requests not finished. Percent = done / total. On a day off only what was actually done counts.

## Adding or changing features
- Server: one file per feature in `modules/` (`module.exports = function (app, ctx)` adds its `/api` routes); list it in `app.js`.
- Screen: one file per feature in `public/js/` that calls `Panel.register({ id, label, roles, order, render })`; list it in `index.html`.
- Task kinds, presets and carry rules are in `lib/tasks.js`; follow-up rules in `lib/followups.js`; Zoho reads in `lib/zoho.js`; photo saving in `lib/files.js`.
- Tests pretend it is another day with `clock.date = '2026-11-02'` (from `lib/util.js`).

## One-time setup
1. DNS: an `A` record `admin` -> the dev droplet IP (the same as `dev` and `digital`).
2. GitHub -> Settings -> Environments -> `dev`: add `ADMIN_PANEL_PASSWORD` and `ADMIN_PANEL_SESSION_SECRET` (any long random text).
   The Zoho values (`ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_BOOKS_ORG_ID`, variable `ZOHO_DC`) are the ones the
   website already uses. The login needs `ZohoBooks.invoices.READ`, `ZohoBooks.contacts.READ` and `ZohoBooks.salesorders.READ`.
3. Push to `dev` (or run the workflow). The deploy creates the nginx site and, once the DNS record exists, the HTTPS certificate.

Run locally: `ADMIN_PASSWORD=something npm start` (port 4100), tests: `npm test`.
