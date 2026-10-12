# Dev → Prod pipeline

```
 feature work ──► dev branch ──► tests ──► DEV droplet   (dev.arambhika.com, not indexed)
                     │
                     └── pull request ──► main ──► tests ──► approval ──► PROD droplet (www.arambhika.com)
```

Nobody edits a server by hand. A server only ever changes because a pipeline run deployed a commit
that passed the tests.

## Branches

| Branch | Deploys to | Rules |
|---|---|---|
| `dev`  | dev droplet (`APP_ENV=dev`) | Work lands here first. Every push is tested, then deployed. |
| `main` | production droplet (`APP_ENV=production`) | Only reached by a pull request **from `dev`**. Deploy waits for a human approval. |

Turn on in GitHub → Settings → Branches → branch protection for **both** branches:
require a pull request, require the `test` status check, and block force-pushes.
(Protection rules need a paid plan on private repositories; the pipeline's own `guard-promotion`
job already rejects pull requests into `main` that are not from `dev`.)

## What the pipeline checks (`.github/workflows/pipeline.yml`)

1. **Syntax** (`npm run check`): every `.js`/`.mjs` file parses.
2. **A test comes with every change** (`scripts/require-tests.mjs`, pull requests): if `server.js`,
   `lib/` or `public/` changed, something under `test/` must change too. The only exception is a
   `No-test-reason:` line in the PR description, which a reviewer can see and challenge.
3. **Tests** (`npm test`, ~340 cases) with a coverage floor of 70% of lines:

   | File | Covers |
   |---|---|
   | `test/auth.test.js` | OTP send/verify, rate limits, lockout, signed sessions, forged cookies, protected routes |
   | `test/customers.test.js` | profile, cart, per-customer isolation, checkout address rule |
   | `test/zoho-contacts.test.js` | Books/Inventory sync rules, duplicate numbers, no contact deletion, error handling |
   | `test/environment.test.js` | `/healthz`, production vs dev (noindex), key pages served, admin pages locked |
   | `test/seo.test.js` | per page: title, description, one h1, canonical, Open Graph, JSON-LD, alt text, `noopener`; sitemap/robots; private pages stay out |
   | `test/frontend.test.js` | every script parses, every local file reference exists, key customer-flow markup |

4. **Deploy** (`scripts/deploy.sh`): renders the server `.env` from secrets, snapshots the running
   release, rsyncs the code, `npm ci --omit=dev`, restarts pm2, waits for `/healthz` to report the
   right `APP_ENV`, and **rolls back automatically** if it does not.

### Known gaps (tracked, not hidden)

`KNOWN_GAPS` in `test/seo.test.js` and `KNOWN_BROKEN` in `test/frontend.test.js` list defects that
existed before the tests did (missing `<h1>`/Open Graph tags on a few pages, three broken product
images on the home page). They can only shrink: new pages must pass every rule, and fixing a page
makes its entry fail until you delete it.

## Rule for every change

> No change merges without a test. New API behaviour → a test in `test/*.test.js` that calls it.
> New or edited page → it is picked up automatically by `seo.test.js` and `frontend.test.js`; add a
> markup assertion to `frontend.test.js` if the page has a script that depends on specific elements.

Run locally: `npm test` · with coverage: `npm run test:coverage` · syntax only: `npm run check`.

## Secrets and variables

Nothing sensitive lives in the repository, in the tests, or in a developer's `.env`.
Create **two GitHub Environments** — `dev` and `production` — under Settings → Environments, and add
the same names to each with that environment's own values.

**Secrets**

| Name | What it is |
|---|---|
| `SSH_HOST` | droplet IP |
| `SSH_USER` | usually `root` |
| `SSH_PRIVATE_KEY` | a **deploy-only** key pair (public half in the droplet's `authorized_keys`) |
| `SSH_KNOWN_HOSTS` | output of `ssh-keyscan -t ed25519 <ip>` (pins the server identity) |
| `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET` | Zoho API Console client |
| `ZOHO_REFRESH_TOKEN` | refresh token from `/admin/zoho-connect` (optional: the server also keeps one on disk) |
| `ZOHO_BOOKS_ORG_ID`, `ZOHO_INVENTORY_ORG_ID` | Zoho organisation ids |
| `ADMIN_TOKEN` | password for the `/admin/*` pages — **use a long random value** |
| `SESSION_SECRET` | long random string that signs login cookies |
| `MSG91_AUTHKEY`, `MSG91_TEMPLATE_ID` | MSG91 OTP |

**Variables** (not secret)

| Name | Dev | Production |
|---|---|---|
| `APP_ENV` | `dev` | `production` |
| `DEPLOY_PATH` | `/root/app` | `/root/app` |
| `PM2_NAME` | `arambhika-store` | `arambhika-store` |
| `PORT` | `3000` | `3000` |
| `ZOHO_DC` | `in` | `in` |
| `ZOHO_STOREFRONT_DOMAIN` | store domain | store domain |
| `ZOHO_REDIRECT_URI` | `https://dev.arambhika.com/oauth/zoho/callback` | `https://www.arambhika.com/oauth/zoho/callback` |
| `MSG91_OTP_LENGTH` | `4` | `4` |
| `MSG91_OTP_EXPIRY` | `5` | `5` |
| `ALLOWED_TEST_MOBILE` | your test number | (leave empty) |

Add the production environment's **required reviewers** so every release is approved by a person.

## Setting up the dev droplet

1. Create a droplet (Ubuntu 22.04/24.04, same size as production, same region).
2. `scp scripts/provision-droplet.sh root@<ip>:` then `ssh root@<ip> bash provision-droplet.sh dev.arambhika.com`.
3. Add a DNS `A` record `dev` → the droplet IP, then `certbot --nginx -d dev.arambhika.com`.
4. Register `https://dev.arambhika.com/oauth/zoho/callback` as an Authorized Redirect URI in the Zoho API Console.
5. Ask MSG91 to whitelist the dev droplet's IPv4 address on the auth key (or use a second key).
6. Fill in the `dev` environment secrets/variables above, then push to `dev`.

## First cutover of production (do this once, carefully)

The production server's `.env` is currently hand-written. The first pipeline deploy **replaces it**
with one rendered from the `production` environment, so every value above must be filled in first.

1. Fill the `production` environment completely (copy values from the live `/root/app/.env`).
2. Keep a backup: `ssh root@<prod> cp /root/app/.env /root/env.backup`.
3. Merge `dev` → `main` through a pull request and approve the deploy.
4. If `/healthz` does not report `production`, the pipeline restores the previous release by itself.
5. Rotate anything that was ever pasted into a chat or ticket (MSG91 auth key, `ADMIN_TOKEN`).

## Things to know

- **Dev talks to the real Zoho organisation.** Zoho Commerce has no sandbox. A dev checkout creates a
  real payment page and a paid dev order is a real order. Test payments with care, or point the dev
  environment at a separate Zoho organisation/store.
- **Dev data is separate.** Customers, carts and orders live in each server's `data/` folder and are
  never touched by a deploy.
- **Dev is never indexed**: it sends `X-Robots-Tag: noindex` and serves `Disallow: /`.
- **Rollback by hand**: merge a revert into `dev`, then `main`; or re-run an older successful run.
