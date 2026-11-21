#!/usr/bin/env bash
# Deploys apps/directory (Lithium Directory) to the DEV droplet only, first on its own port, and on a web address once DIRECTORY_DOMAIN is set.
# Used by .github/workflows/directory-dev.yml, and runnable by hand with the same variables.
#
# It refuses to run for anything that is not the dev environment. It never touches the other apps on the droplet (it adds its own
# pm2 process, its own folder and, when a domain is set, its own nginx site).
#
# Layout on the server:
#   /root/directory/releases/<timestamp>/   one folder per deploy (last 3 kept)
#   /root/directory/current                 symlink to the live release
#   /root/directory/shared/.env             rendered from the environment on each deploy
#   /root/directory/shared/data             directory.db (SQLite) and the listing photos
# SMS login: the same MSG91 account as arambhika.com. On dev the keys are copied on the droplet from the dev website's own .env
# (they never pass through this script or the logs). If they cannot be found, set DIRECTORY_DEV_OTP for a fixed test code.
set -euo pipefail

: "${SSH_HOST:?SSH_HOST is not set}"
: "${SSH_USER:?SSH_USER is not set}"
: "${SSH_PRIVATE_KEY:?SSH_PRIVATE_KEY is not set}"
: "${SSH_KNOWN_HOSTS:?SSH_KNOWN_HOSTS is not set}"
: "${DEPLOY_ENV:?DEPLOY_ENV is not set}"

if [ "$DEPLOY_ENV" != "dev" ]; then
  echo "::error::deploy-directory.sh only deploys to the dev environment (got '$DEPLOY_ENV')"
  exit 1
fi

DOMAIN="${DIRECTORY_DOMAIN:-}" # empty: no web address yet, so the site is reached by the droplet address and its port
APP_PORT="${DIRECTORY_PORT:-4300}"
PM2_NAME="directory"
BASE="/root/directory"
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)/apps/directory"
[ -f "$SRC_DIR/server.js" ] || { echo "::error::$SRC_DIR/server.js not found"; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
printf '%s\n' "$SSH_PRIVATE_KEY" > "$WORK/key"; chmod 600 "$WORK/key"
printf '%s\n' "$SSH_KNOWN_HOSTS" > "$WORK/known_hosts"
SSH_OPTS=(-i "$WORK/key" -o UserKnownHostsFile="$WORK/known_hosts" -o StrictHostKeyChecking=yes -o BatchMode=yes -o IdentitiesOnly=yes)
remote() { ssh "${SSH_OPTS[@]}" "$SSH_USER@$SSH_HOST" "$@"; }

# --- environment file, built from the environment (empty values are left out) ---
# the login-cookie secret: the one given, else the one already on the server, else a new random one (kept for later deploys)
SECRET="${SESSION_SECRET:-}"
[ -n "$SECRET" ] || SECRET="$(remote "grep '^SESSION_SECRET=' '$BASE/shared/.env' 2>/dev/null | cut -d= -f2- || true")"
[ -n "$SECRET" ] || SECRET="$(openssl rand -hex 32)"
: > "$WORK/app.env"
{
  echo "PORT=$APP_PORT"
  echo "DATA_DIR=$BASE/shared/data"
  echo "SESSION_SECRET=$SECRET"
  echo "ADMIN_MOBILE=${ADMIN_MOBILE:-8112662827}"
  if [ -n "$DOMAIN" ]; then echo "SITE_URL=https://$DOMAIN"; fi
} >> "$WORK/app.env"
for k in DEV_OTP_CODE MSG91_AUTHKEY MSG91_TEMPLATE_ID MSG91_OTP_LENGTH MSG91_OTP_EXPIRY; do
  v="${!k:-}"
  if [ -n "$v" ]; then printf '%s=%s\n' "$k" "$v" >> "$WORK/app.env"; fi
done
chmod 600 "$WORK/app.env"

STAMP="$(date +%Y%m%d%H%M%S)"
REL="$BASE/releases/$STAMP"

remote "mkdir -p '$REL' '$BASE/shared/data'"

# --- ship the code (no node_modules, tests, local .env or data) ---
tar -C "$SRC_DIR" -czf - \
  --exclude='./node_modules' --exclude='./test' --exclude='./.env' --exclude='./data' --exclude='./scripts' . \
  | remote "tar -xzf - -C '$REL'"

scp "${SSH_OPTS[@]}" "$WORK/app.env" "$SSH_USER@$SSH_HOST:$REL/.env.new" >/dev/null

# --- install, switch, restart ---
PREV="$(remote "readlink -f '$BASE/current' 2>/dev/null || true")"
remote "set -e
cd '$REL'
install -m 600 .env.new '$BASE/shared/.env'
rm -f .env.new
# SMS keys: unless given, copy the SMS settings (only those lines) from the dev website's .env on this droplet
if ! grep -q '^MSG91_AUTHKEY=' '$BASE/shared/.env' && [ -f /root/app/.env ]; then
  grep -E '^(MSG91_AUTHKEY|MSG91_TEMPLATE_ID|MSG91_OTP_LENGTH|MSG91_OTP_EXPIRY)=' /root/app/.env >> '$BASE/shared/.env' || true
fi
ln -sfn '$BASE/shared/.env' .env
npm ci --omit=dev --no-audit --no-fund || { echo '::error::npm ci failed on the droplet'; exit 1; }
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

# --- no web address yet: open the port so http://<droplet address>:$APP_PORT works (plain http, so use it only while testing) ---
if [ -z "$DOMAIN" ]; then
  remote "if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then ufw allow $APP_PORT/tcp >/dev/null; fi"
  echo "Lithium Directory is at http://$SSH_HOST:$APP_PORT (no DNS name, no HTTPS)"
else
# --- web address: an nginx site for the domain, and a certificate once the DNS record points here ---
remote "set -e
SITE=/etc/nginx/sites-available/$DOMAIN
if [ ! -f \"\$SITE\" ]; then
  cat > \"\$SITE\" <<NGINX
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 8m;
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
# photos go up to 6 MB, so this site may take an 8 MB request (nginx's own default is 1 MB)
changed=0
for f in \$(grep -l \"127.0.0.1:$APP_PORT\" /etc/nginx/sites-available/* 2>/dev/null); do
  if ! grep -q client_max_body_size \"\$f\"; then sed -i '/server_name /a\\    client_max_body_size 8m;' \"\$f\"; changed=1; fi
done
if [ \"\$changed\" = 1 ]; then nginx -t && systemctl reload nginx; fi
"

fi

# keep the three newest releases
remote "cd '$BASE/releases' && ls -1dt */ | tail -n +4 | xargs -r rm -rf"
echo "Lithium Directory deployed to $SSH_HOST (dev): $body"
