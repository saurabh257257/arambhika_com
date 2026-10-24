# Arambhika Admin Panel

Staff-only page at `https://admin.arambhika.com` (dev droplet only, never part of the website release).

- **Employees** (created by the admin): record their daily routine (calls with who/phone/result, Instagram ads, website
  posts, invoices), look back over previous days, see the tasks and sub-tasks assigned to them, and send office
  transactions (expense, money received, purchase) for approval.
- **Admin** (`admin` + the `ADMIN_PANEL_PASSWORD` secret): overview of each employee's day, create tasks and
  sub-tasks and assign them, approve or reject transactions, look at any employee's records, add or switch off
  employees, and edit the daily jobs and targets.
- **Locked:** every page and API call needs a sign-in; passwords are stored hashed.
- **Data:** plain JSON files in `DATA_DIR` (`users`, `routine`, `entries`, `calls`, `tasks`, `transactions`), on the dev
  droplet at `/root/admin-panel/shared/data`. No database.

## One-time setup

1. DNS: an `A` record `admin` -> the dev droplet IP (the same as `dev` and `digital`).
2. GitHub -> Settings -> Environments -> `dev`: add the secrets `ADMIN_PANEL_PASSWORD` and
   `ADMIN_PANEL_SESSION_SECRET` (any long random text).
3. Push to `dev` (or run the workflow). The deploy creates the nginx site and, once the DNS record exists, the HTTPS
   certificate. If DNS was added later, re-run the workflow.

Run locally: `ADMIN_PASSWORD=something npm start` (port 4100), tests: `npm test`.
