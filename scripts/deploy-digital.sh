#!/usr/bin/env bash
# Deploys apps/digital-content to the DEV droplet only (https://digital.arambhika.com).
# Used by .github/workflows/digital-dev.yml, and runnable by hand with the same variables.
#
# It refuses to run for anything that is not the dev environment, so it can never be pointed at
# production by mistake.
#
# Layout on the server:
#   /root/digital-content/releases/<timestamp>/   one folder per deploy (last 3 kept)
#   /root/digital-content/current                 symlink to the live release
#   /root/digital-content/shared/.env             rendered from the environment on each deploy
#   /root/digital-content/shared/data             database
#   /root/digital-content/shared/uploads          generated images
set -euo pipefail

: "${SSH_HOST:?SSH_HOST is not set}"
: "${SSH_USER:?SSH_USER is not set}"
: "${SSH_PRIVATE_KEY:?SSH_PRIVATE_KEY is not set}"
: "${SSH_KNOWN_HOSTS:?SSH_KNOWN_HOSTS is not set}"
: "${DEPLOY_ENV:?DEPLOY_ENV is not set}"

if [ "$DEPLOY_ENV" != "dev" ]; then
  echo "::error::deploy-digital.sh only deploys to the dev environment (got '$DEPLOY_ENV')"
  exit 1
fi
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD is not set: the tool will not start without a login password}"

APP_PORT="${DIGITAL_PORT:-4000}"
PM2_NAME="digital-content"
BASE="/root/digital-content"
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)/apps/digital-content"
[ -f "$SRC_DIR/server.js" ] || { echo "::error::$SRC_DIR/server.js not found"; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
printf '%s\n' "$SSH_PRIVATE_KEY" > "$WORK/key"; chmod 600 "$WORK/key"
printf '%s\n' "$SSH_KNOWN_HOSTS" > "$WORK/known_hosts"
SSH_OPTS=(-i "$WORK/key" -o UserKnownHostsFile="$WORK/known_hosts" -o StrictHostKeyChecking=yes -o BatchMode=yes -o IdentitiesOnly=yes)
remote() { ssh "${SSH_OPTS[@]}" "$SSH_USER@$SSH_HOST" "$@"; }

# --- environment file, built from the environment (empty values are left out) ---
# The tool mirrors the dev store, which always carries the newest catalogue code (set WEBSITE_URL to point it elsewhere).
export WEBSITE_URL="${WEBSITE_URL:-https://dev.arambhika.com}"
KEYS=(ADMIN_PASSWORD BYTEPLUS_API_KEY ANTHROPIC_API_KEY PUBLIC_BASE_URL SESSION_SECRET WEBSITE_URL)
: > "$WORK/app.env"
{
  echo "PORT=$APP_PORT"
  echo "DB_PATH=$BASE/shared/data/shopmanager.db"
  echo "UPLOADS_DIR=$BASE/shared/uploads"
} >> "$WORK/app.env"
for k in "${KEYS[@]}"; do
  v="${!k:-}"
  if [ -n "$v" ]; then printf '%s=%s\n' "$k" "$v" >> "$WORK/app.env"; fi
done
chmod 600 "$WORK/app.env"

missing=()
for k in BYTEPLUS_API_KEY ANTHROPIC_API_KEY; do [ -n "${!k:-}" ] || missing+=("$k"); done
if [ "${#missing[@]}" -gt 0 ]; then
  echo "::warning::deploying without ${missing[*]}: the tool runs, but generation that needs them will say it is not configured"
fi

STAMP="$(date +%Y%m%d%H%M%S)"
REL="$BASE/releases/$STAMP"

remote "mkdir -p '$REL' '$BASE/shared/data' '$BASE/shared/uploads'"

# --- ship the code (no node_modules, tests, local .env or database) ---
tar -C "$SRC_DIR" -czf - \
  --exclude='./node_modules' --exclude='./test' --exclude='./.env' --exclude='./uploads' --exclude='*.db' . \
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

# keep the three newest releases
remote "cd '$BASE/releases' && ls -1dt */ | tail -n +4 | xargs -r rm -rf"
echo "Digital Content deployed to $SSH_HOST (dev): $body"
