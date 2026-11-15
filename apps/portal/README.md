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
- **Customer page + Zoho Books**: the portal has **no Zoho Books login of its own**. A team member's Claude, which has Zoho Books connected with that person's own login, finds the customer there by mobile number, copies their details with `update_customer`, and saves their invoices, sales orders and quotes with `save_zoho_books_documents` (`books_docs` table, one row per document number, saved again = updated). The customer page then shows what they bought, what they owe, and for each document the next step, worked out each time the page opens (`lib/books.js`): order placed, move it to invoicing; delivered, not invoiced; placed and not delivered for days; overdue invoice, call; accepted quote, convert. The prompt `sync_from_zoho` does all of that in one go.
- **Items** (`lib/items-sync.js`): read from the Zoho Commerce public storefront (no token; `ZOHO_STOREFRONT_DOMAIN`, default `armabhika.zohoecommerce.in`) every 30 minutes and on "Refresh from Zoho". Only items shown in the online store are visible there. Each item shows the vendors who supply it, cheapest first.
- **Vendors**: keyed by mobile. Every day a vendor's new rate is recorded (`log_vendor_rate`); a rate is linked to one of our items automatically when exactly one matches, otherwise Claude picks (`map_vendor_rate`). `find_suppliers` answers "who has nickel strip 0.15 and at what rate".
- MCP tools: customers (`search_customers`, `get_customer`, `add_customer`, `update_customer`, `complete_profile`, `log_interaction`, `my_follow_ups`, `add_file`, `customer_purchases`, `save_zoho_books_documents`), items (`search_items`, `get_item`), vendors (`add_vendor`, `update_vendor`, `search_vendors`, `get_vendor`, `log_vendor_rate`, `map_vendor_rate`, `find_suppliers`), plus `who_am_i`, `list_team`.

### Finishing a customer profile with Claude

`complete_profile` returns what is unknown about a customer, in a sensible order, with the answer options and where to look. The server cannot call a member's other connected tools (Zoho Books, email, calendar...), so its instructions and prompts (`new_lead`, `complete_customer_profile`, `sync_from_zoho`, `log_vendor_rates`) tell Claude to look there first, save what it finds, and ask the user only for the rest, two or three questions at a time.

### The vendor rule

A vendor exists only with at least one of our items linked to them (`vendor_items`), and a rate is saved only for one of our items. `add_vendor` needs `item_ids` (from `search_items`); `log_vendor_rate` needs an `item_id`, or a name that matches exactly one item, otherwise nothing is saved and the answer lists the candidates; `link_vendor_items` adds more items. A vendor saved before this rule with no item is shown with a red "No item linked" tag so it can be fixed (link items) or deleted by the admin.

### Customers: the list and the page

The list shows name, mobile, who looks after them, trader or OEM, state, and coloured "needs attention" chips (a late follow-up, a payment overdue, an order not delivered, an accepted quote, quotes waiting, no contact for 30 days). Quick filters: All, Needs attention, Unassigned, Mine; selects for assigned-to, state, type and business; search covers every field and the history. A customer with no owner is "unassigned" (`assign_customer`).

The page: a header with mobile, place, owner, onboarding date and four numbers (sold so far, collected, still to collect, quotes waiting); "What to do next" (next follow-up, last contact, and the open steps from Zoho Books); About (address, what they do, GST, where from, what they want); the other people at the company (`save_customer_contact`); what they bought grouped by our item categories with bars, quotes waiting, orders, invoices; every interaction with photos and attachments; photos and documents. Customer type is **trader** (buys to resell) or **OEM** (makes its own products); the older word "non-trader" is read as OEM. Everything is changed only through Claude.

### Suppliers (vendors and items in one place)

One **Suppliers** tab with three views: **By item** (all items from Zoho Commerce with the best vendor rate), **By vendor**, and **By collection** (the collections set up in Zoho Commerce, such as 18650 and 21700). Under each view, **Latest updates** lists every rate, note, file, new vendor and "now supplies" link, newest first. Vendor and item pages carry details (address, what they do, payment terms, delivery time, minimum order), dated **notes**, **attachments** of any kind (pictures show in the page, other files download), and the full log newest first. All of it is added through Claude (`update_vendor`, `add_note`, `add_attachment`, `recent_updates`); only the admin can remove a wrong note or file.

### Zoho Books directory tile

Each customer shows whether they are created in the Zoho Books customer directory: Created, Not created, or Not checked. Claude looks the customer up in its own Zoho Books connector and reports with `set_zoho_directory_status`; saving the customer's Zoho documents also marks them as created.

Menu order: Customers, Suppliers, Members (admin only), My connection (last). The top bar and menu stay fixed while the page scrolls.
