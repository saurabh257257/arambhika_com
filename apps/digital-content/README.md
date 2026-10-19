# Digital Content (Arambhika)

Generates on-brand product images (BytePlus ModelArk), captions and text posts (Claude). Images are
saved on the server and downloaded from the page; nothing is sent to Google Drive or any other service. It
**only generates**: nothing in this tool posts to Instagram, LinkedIn or any other network. Download
or copy the result and publish it yourself.

This is a separate tool from the website. It deploys only to the dev server, at
`https://digital.arambhika.com`, and is never part of the production release.

## Pages
- `login.html`: password gate (checked on the server; every page, API call and image needs a session)
- `image-generator.html`: image + caption generator, and a text-post generator
- `products.html`: product list used as reference photos for generation

## Run locally
```
npm install
cp .env.example .env   # set ADMIN_PASSWORD at least
npm start
npm test
```
`ADMIN_PASSWORD` is required: the server will not start without it.

## Deploy
`.github/workflows/digital-dev.yml` tests it and deploys it to the dev droplet when something under
`apps/digital-content/` changes on the `dev` branch. Settings come from the GitHub `dev`
environment (secrets listed in the workflow).
