# Lithium Directory

A listing site (lithiumdirectory.com) where manufacturers list lithium-ion batteries and related products. Buyers browse and tap
**Chat on WhatsApp** on a product to message the seller directly. There is no cart, no checkout and no payment on the site.

* **Public pages** are rendered on the server (fast, and findable by search engines): home, browse with filters, a product page with
  gallery, specifications and a WhatsApp button, how it works, terms and safety, `sitemap.xml`, `robots.txt`.
* **Sellers** log in with a mobile OTP (the same MSG91 account and approved SMS template as arambhika.com). They add a profile once, then add
  products: category (or a new one), photos (shrunk in the browser first), voltage, capacity, chemistry, price, state, city and their
  WhatsApp number. New sellers' products are reviewed first; after the admin approves one, that seller is "trusted" and later products
  go live at once.
* **Admin**: the mobile `8112662827` (`ADMIN_MOBILE`) opens `/admin`: review queue, all products (edit, approve, hide, delete), sellers
  (trust, suspend, edit), categories (rename, remove when empty), WhatsApp enquiries (every tap on a WhatsApp button is a lead,
  counted once per visitor per product every 10 minutes) and an activity log.
* The seller's number is never printed on the page; the button goes through `/go/<id>`, which records the lead and opens `wa.me`.
* **Data**: SQLite in `DATA_DIR/directory.db` and photos in `DATA_DIR/photos`. Nothing is shared with the arambhika.com website or the other apps.

## Run

```
npm install
DEV_OTP_CODE=1234 npm start      # no SMS keys: any number can log in with 1234 (testing only, never in production)
npm test
```

Environment: `PORT` (4300), `DATA_DIR`, `SESSION_SECRET`, `ADMIN_MOBILE`, `SITE_URL` (for links in the sitemap), `MSG91_AUTHKEY`,
`MSG91_TEMPLATE_ID`, `MSG91_OTP_LENGTH`, `MSG91_OTP_EXPIRY`, `DEV_OTP_CODE`.

## Deploy

Dev only for now: `.github/workflows/directory-dev.yml` runs the tests and `scripts/deploy-directory.sh` on a push to `dev`. It adds its own
pm2 process (`directory`, port 4300), folder (`/root/directory`) and, once `DIRECTORY_DOMAIN` is set, its own nginx site. On the dev droplet the SMS settings
are copied from the dev website's `.env` on the server. Production is a separate step that needs approval, DNS for lithiumdirectory.com and more memory on the droplet.
