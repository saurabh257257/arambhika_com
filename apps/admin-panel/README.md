# Arambhika Admin Panel

Staff-only site at `https://admin.arambhika.com` (dev droplet only, never part of the website release). The owner designs
the work, the team does it, and everyone can see where things stand.

## What it does

**The owner (`admin` + the `ADMIN_PANEL_PASSWORD` secret)**
- **Dashboard:** each team member's progress today (percent done, work left), who has not started, what is waiting to be
  assigned, the invoice follow-up health, and the Zoho connection.
- **Task designer:** design any task. *Fill in rows* ("Call 10 people": you pick the number and the columns, and that many
  rows appear for each person), *Checklist* (steps to tick, also how you give someone a task with sub-tasks), *Counter*
  ("Post 3 Instagram photos": a target, a number done and a link). Daily or one-time, for one or more people.
- **Team work:** read any member's tasks for any day. **Team:** add members and set or reset their passwords.
- **Leads, Customers, Orders, Invoices:** see everyone's work; assign owners; "Share unowned customers evenly".
- **Follow-up rules:** after a follow-up, what happened decides when the next one is due (editable table).
- **Office:** approve or reject transactions. **Activity:** who updated what, and when.

**Team members (password set by the owner)** see only their own work: *My day* (one percentage for everything, and how much
is left), *Tasks* (cells to fill, each saved with the time and their name), *Leads* (pick a new lead, log follow-ups, turn it
into an order), *Customers* and *Invoices* (their own list from Zoho, with the next follow-up date), *Orders* (tick the six
stages), *Office* (send a transaction for approval).

## What comes from Zoho, at runtime

Read-only, from Zoho Books, kept in memory for 5 minutes (the "Refresh from Zoho" buttons force a fresh pull). Nothing is copied
to disk and nothing is written to Zoho.
- **Customers** (contact list; if the saved login cannot read contacts, they are rebuilt from invoices) and, from invoices,
  whether each one is **onboarded** (invoiced before; the owner or member can override).
- **Invoices:** unpaid ones, with due date, balance and phone. A paid invoice disappears by itself. An invoice "needs follow-up"
  when it is overdue or due within a few days; "on track" means someone followed it up and a next date is set.
- **Sales orders:** new website orders appear in Orders by themselves and their invoice, payment, dispatch and delivery stages
  tick from Zoho.

What the panel itself stores (JSON files in `DATA_DIR`): team members, task designs and the work done, leads, orders, who owns
which customer/invoice, follow-up history, transactions and the activity feed.

## How "done" is counted
Today's work = every row, step or target of today's tasks + customers and invoices whose follow-up is due (plus up to 10 customers
never called yet) + leads that are new or due. A follow-up logged today counts as done. Percent = done / total. Each order shows its
own progress through the six stages instead.

## Adding or changing features
- Server: one file per feature in `modules/` (`module.exports = function (app, ctx)` adds its `/api` routes); list it in `app.js`.
- Screen: one file per feature in `public/js/` that calls `Panel.register({ id, label, roles, order, render })`; list it in `index.html`.
- Follow-up rules live in `lib/followups.js`, task kinds in `lib/tasks.js`, Zoho reads in `lib/zoho.js`.

## One-time setup
1. DNS: an `A` record `admin` -> the dev droplet IP (the same as `dev` and `digital`).
2. GitHub -> Settings -> Environments -> `dev`: add `ADMIN_PANEL_PASSWORD` and `ADMIN_PANEL_SESSION_SECRET` (any long random text).
   The Zoho values (`ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_BOOKS_ORG_ID`, variable `ZOHO_DC`) are the ones the
   website already uses. The login needs `ZohoBooks.invoices.READ`, `ZohoBooks.contacts.READ` and `ZohoBooks.salesorders.READ`.
3. Push to `dev` (or run the workflow). The deploy creates the nginx site and, once the DNS record exists, the HTTPS certificate.

Run locally: `ADMIN_PASSWORD=something npm start` (port 4100), tests: `npm test`.
