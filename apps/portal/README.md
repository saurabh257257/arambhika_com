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

### Claude apps (claude.ai, desktop): sign in with username and password

The portal is also an OAuth server (`lib/oauth.js`): dynamic client registration, authorization code with PKCE (S256), refresh tokens that rotate. In Claude: Settings, Connectors, Add custom connector, address `https://<portal address>/mcp`, then **Sign in now** with **Register automatically**. Claude opens `/oauth/authorize`, a page on this server where the member types their portal username and password; Claude only ever receives a token (access 1 hour, refresh 60 days). A password reset, switching a member off, or revoking their key ends their Claude sign-ins at once. Return addresses are limited to Claude's own sites and localhost. Needs an https address.

## Version 2: mobile keys, vendors, items, Zoho Books

- **Mobile number is the primary key** of a customer and of a vendor (`lib/schema.js`): cleaned to 10 digits (`+91`, spaces and a leading 0 are ignored, Indian mobiles only), and the database refuses a second row with the same number. An older database keyed by random ids is converted once, with a copy of the file kept (`portal.db.before-mobile-keys-*`); customers without a valid mobile cannot be kept.
- **Customer profile** (battery business): company, city/state/pincode, GST, where from (email, WhatsApp, call, IndiaMART, website...), trader or non-trader, kind of business, what they are looking for, application, cell type, quantity, urgency. `update_customer` only fills what it is given; a blank never erases. Each customer shows what is still unknown and the question to ask.
- **Customer page + Zoho Books** (`lib/books.js`, `/api/customers/:mobile/books`): the Books contact is matched by the last 10 digits of its mobile/phone; the page lists invoices, orders and quotes, the items bought, what is still owed, and for every document the next step (order placed: move to invoicing, delivered but not invoiced, placed and not delivered for days, overdue invoice: call, accepted quote: convert). Read-only. Needs `ZOHO_CLIENT_ID/SECRET/REFRESH_TOKEN` and `ZOHO_BOOKS_ORG_ID`.
- **Items** (`lib/items-sync.js`): read from the Zoho Commerce public storefront (no token; `ZOHO_STOREFRONT_DOMAIN`, default `armabhika.zohoecommerce.in`) every 30 minutes and on "Refresh from Zoho". Only items shown in the online store are visible there. Each item shows the vendors who supply it, cheapest first.
- **Vendors**: keyed by mobile. Every day a vendor's new rate is recorded (`log_vendor_rate`); a rate is linked to one of our items automatically when exactly one matches, otherwise Claude picks (`map_vendor_rate`). `find_suppliers` answers "who has nickel strip 0.15 and at what rate".
- MCP tools: customers (`search_customers`, `get_customer`, `add_customer`, `update_customer`, `log_interaction`, `my_follow_ups`, `add_file`, `customer_purchases`), items (`search_items`, `get_item`), vendors (`add_vendor`, `update_vendor`, `search_vendors`, `get_vendor`, `log_vendor_rate`, `map_vendor_rate`, `find_suppliers`), plus `who_am_i`, `list_team`.

### Finishing a customer profile with Claude

`complete_profile` returns what is unknown about a customer, in a sensible order, with the answer options and where to look; `enrich_from_zoho` (also run automatically by `add_customer`) fills blanks from the Zoho Books contact and never overwrites. The server cannot call a member's other connected tools (email, calendar...), so its instructions and prompts (`new_lead`, `complete_customer_profile`, `log_vendor_rates`) tell Claude to look there first and to ask the user only for the rest, two or three questions at a time.

Zoho Books needs these scopes on the saved login: `ZohoBooks.contacts.READ`, `ZohoBooks.invoices.READ`, `ZohoBooks.salesorders.READ`, `ZohoBooks.estimates.READ`. Each kind is read on its own, so a missing scope only hides that part and the customer page says which scope is missing. To give the Portal its own login without touching the website's, add the GitHub dev secret `PORTAL_ZOHO_REFRESH_TOKEN`.
