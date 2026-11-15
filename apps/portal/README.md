# Arambhika Portal

A small, **view-only** web app on the dev droplet:

- **Customers**: a list (search by name, company, phone, city; filter by owner) and a detail page per customer with a timeline of everything that happened (calls, WhatsApp, quotes, orders, payments, dispatches, follow-ups, notes), who did it and when, plus uploaded files and pictures.
- **Members** (admin only): create team members with a username and password, reset a password, switch someone off. The admin signs in as `admin` with the admin password (the `ADMIN_PASSWORD` environment value).

Nothing else can be changed from the web. Data changes will come only from the MCP server, which will use the functions in `lib/db.js` (`addCustomer`, `addInteraction`, `addFile`), so every change is stamped with the member who made it.

## Storage

SQLite in `DATA_DIR/portal.db` (Node 22.13+ built-in `node:sqlite`; on Node 20, which the droplet runs, the `better-sqlite3` package) and uploaded files in `DATA_DIR/files` under random names. Pictures show in the page; any other file is only ever sent as a download.

## Run it

```
npm ci
ADMIN_PASSWORD=choose-one SESSION_SECRET=any-long-text npm start     # http://localhost:4200
npm test
node scripts/seed-demo.js ./demo-data                                 # made-up data, local preview only
```

## Deploy

Dev droplet only, by `.github/workflows/portal-dev.yml` and `scripts/deploy-portal.sh`. It needs the GitHub `dev` environment secrets `PORTAL_ADMIN_PASSWORD` and `PORTAL_SESSION_SECRET` (without them the deploy is skipped), and a DNS record for the address (default `portal.arambhika.com`, change with the `PORTAL_DOMAIN` variable).

## MCP (how the team updates data)

`POST /mcp` is an MCP server (JSON-RPC over HTTP). Each member makes their own key under **My connection** (shown once; only a hash is stored) and adds it to Claude Code:

```
claude mcp add --transport http arambhika http://<portal address>/mcp --header "Authorization: Bearer <key>"
```

Tools: `who_am_i`, `list_team`, `search_customers`, `get_customer`, `add_customer` (refuses a phone number that already exists), `log_interaction` (call, whatsapp, visit, quote, order, payment, dispatch, note, followup), `my_follow_ups`, `add_file` (up to 5 MB). There is no delete tool. Every write is stamped with the member whose key was used. The admin can revoke a key under Members; switching a member off also stops their key at once.

Over plain http the key travels unencrypted, so use this only while testing; the Claude apps (claude.ai, desktop chat) need an https address and a sign-in page, which come with a domain.
