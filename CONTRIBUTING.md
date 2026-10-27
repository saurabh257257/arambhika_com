# Contributing

Short version: **branch from `dev`, add a test, open a pull request into `dev`, wait for review.**

The full step-by-step guide, with the rules and the "do not touch" list, is in
[`docs/Contributor-Guide.pdf`](docs/Contributor-Guide.pdf). Read it before your first change.

- Never push straight to `dev` or `main`.
- Every change under `server.js`, `lib/` or `public/` needs a change under `test/`.
- Run `npm test` and `npm run check` before you open the pull request.
- Never commit secrets, `.env` files, customer data or product data. Products come from Zoho Commerce only.
- `.github/`, `scripts/deploy*.sh`, login/payment code and anything about servers or secrets are owner-only.
