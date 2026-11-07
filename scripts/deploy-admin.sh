#!/usr/bin/env bash
# Deploys apps/admin-panel to the DEV droplet only (https://admin.arambhika.com).
# Used by .github/workflows/admin-panel-dev.yml, and runnable by hand with the same variables.
#
# It refuses to run for anything that is not the dev environment, so it can never be pointed at
# production by mistake. If the login password secret is not set yet, it skips (with a warning)
# instead of failing, because the app will not start without one.
#
# Layout on the server:
#   /root/admin-panel/releases/<timestamp>/   one folder per deploy (last 3 kept)
#   /root/admin-panel/current                 symlink to the live release
#   /root/admin-panel/shared/.env             rendered from the environment on each deploy
#   /root/admin-panel/shared/data             the JSON files (users, tasks, daily records, transactions)
set -euo pipefail

: "${SSH_HOST:?SSH_HOST is not set}"
: "${SSH_USER:?SSH_USER is not set}"
: "${SSH_PRIVATE_KEY:?SSH_PRIVATE_KEY is not set}"
: "${SSH_KNOWN_HOSTS:?SSH_KNOWN_HOSTS is not set}"
: "${DEPLOY_ENV:?DEPLOY_ENV is not set}"

if [ "$DEPLOY_ENV" != "dev" ]; then
  echo "::error::deploy-admin.sh only deploys to the dev environment (got '$DEPLOY_ENV')"
  exit 1
fi
if [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "::warning::ADMIN_PANEL_PASSWORD is not set in the GitHub 'dev' environment secrets, so the Admin Panel was NOT deployed. Add it and re-run."
  exit 0
fi

DOMAIN="${ADMIN_DOMAIN:-admin.arambhika.com}"
APP_PORT="${ADMIN_PORT:-4100}"
PM2_NAME="admin-panel"
BASE="/root/admin-panel"
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)/apps/admin-panel"
[ -f "$SRC_DIR/server.js" ] || { echo "::error::$SRC_DIR/server.js not found"; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
printf '%s\n' "$SSH_PRIVATE_KEY" > "$WORK/key"; chmod 600 "$WORK/key"
printf '%s\n' "$SSH_KNOWN_HOSTS" > "$WORK/known_hosts"
SSH_OPTS=(-i "$WORK/key" -o UserKnownHostsFile="$WORK/known_hosts" -o StrictHostKeyChecking=yes -o BatchMode=yes -o IdentitiesOnly=yes)
remote() { ssh "${SSH_OPTS[@]}" "$SSH_USER@$SSH_HOST" "$@"; }

# --- environment file, built from the environment (empty values are left out) ---
: > "$WORK/app.env"
{
  echo "PORT=$APP_PORT"
  echo "DATA_DIR=$BASE/shared/data"
} >> "$WORK/app.env"
# the Zoho values are the same ones the website uses (already in the dev environment); the panel only reads from Zoho
for k in ADMIN_PASSWORD SESSION_SECRET ZOHO_CLIENT_ID ZOHO_CLIENT_SECRET ZOHO_REFRESH_TOKEN ZOHO_BOOKS_ORG_ID ZOHO_DC; do
  v="${!k:-}"
  if [ -n "$v" ]; then printf '%s=%s\n' "$k" "$v" >> "$WORK/app.env"; fi
done
chmod 600 "$WORK/app.env"

STAMP="$(date +%Y%m%d%H%M%S)"
REL="$BASE/releases/$STAMP"

remote "mkdir -p '$REL' '$BASE/shared/data'"

# --- ship the code (no node_modules, tests, local .env or data) ---
tar -C "$SRC_DIR" -czf - \
  --exclude='./node_modules' --exclude='./test' --exclude='./.env' --exclude='./data' . \
  | remote "tar -xzf - -C '$REL'"

scp "${SSH_OPTS[@]}" "$WORK/app.env" "$SSH_USER@$SSH_HOST:$REL/.env.new" >/dev/null

# --- install, switch, restart ---
PREV="$(remote "readlink -f '$BASE/current' 2>/dev/null || true")"
remote "set -e
cd '$REL'
install -m 600 .env.new '$BASE/shared/.env'
rm -f .env.new
ln -sfn '$BASE/shared/.env' .env
npm ci --omit=dev --no-audit --no-fund
ln -sfn '$REL' '$BASE/current.new'
mv -Tf '$BASE/current.new' '$BASE/current'
pm2 delete '$PM2_NAME' >/dev/null 2>&1 || true
cd '$BASE/current'
pm2 start server.js --name '$PM2_NAME' --update-env >/dev/null
pm2 save >/dev/null
"

# --- health check, with rollback ---
healthy=0
for i in $(seq 1 30); do
  body="$(remote "curl -fsS -m 5 http://127.0.0.1:$APP_PORT/health" 2>/dev/null || true)"
  if echo "$body" | grep -q '"status":"ok"'; then healthy=1; break; fi
  sleep 2
done

if [ "$healthy" -ne 1 ]; then
  echo "::error::$PM2_NAME did not become healthy"
  if [ -n "$PREV" ] && [ "$PREV" != "$REL" ]; then
    echo "Rolling back to $PREV"
    remote "ln -sfn '$PREV' '$BASE/current.new' && mv -Tf '$BASE/current.new' '$BASE/current' && pm2 delete '$PM2_NAME' >/dev/null 2>&1; cd '$BASE/current' && pm2 start server.js --name '$PM2_NAME' --update-env >/dev/null && pm2 save >/dev/null"
  fi
  exit 1
fi

# --- web address: an nginx site for the domain, and a certificate once the DNS record points here ---
remote "set -e
SITE=/etc/nginx/sites-available/$DOMAIN
if [ ! -f \"\$SITE\" ]; then
  cat > \"\$SITE\" <<NGINX
server {
    listen 80;
    server_name $DOMAIN;
    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
    }
}
NGINX
  ln -sf \"\$SITE\" /etc/nginx/sites-enabled/$DOMAIN
  nginx -t && systemctl reload nginx
fi
if [ ! -d /etc/letsencrypt/live/$DOMAIN ]; then
  mine=\$(curl -4 -fsS -m 10 https://api.ipify.org || true)
  dns=\$(getent ahostsv4 $DOMAIN | awk 'NR==1{print \$1}' || true)
  if [ -n \"\$mine\" ] && [ \"\$mine\" = \"\$dns\" ]; then
    certbot --nginx -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email --redirect
  else
    echo \"NOTE: $DOMAIN does not point at this server yet (DNS says '\$dns', this server is '\$mine'). Add the DNS A record, then re-run this deploy to get the HTTPS certificate.\"
  fi
fi
"

# keep the three newest releases
remote "cd '$BASE/releases' && ls -1dt */ | tail -n +4 | xargs -r rm -rf"
echo "Admin Panel deployed to $SSH_HOST (dev): $body"
