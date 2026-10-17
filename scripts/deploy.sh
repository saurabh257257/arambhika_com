#!/usr/bin/env bash
# Deploys the checked-out code to a droplet over SSH. Run by the GitHub Actions pipeline; every
# value arrives as an environment variable that comes from the repo's secrets/variables, so no
# credential is ever stored in the repository or on a developer's machine.
#
#   1. render the server's .env from the environment
#   2. keep a copy of what is running (for rollback)
#   3. rsync the new code, install production dependencies, restart under pm2
#   4. wait for /healthz; if it never comes up, restore the previous copy and fail the run
set -euo pipefail

: "${SSH_HOST:?SSH_HOST is not set}"
: "${SSH_USER:?SSH_USER is not set}"
: "${SSH_PRIVATE_KEY:?SSH_PRIVATE_KEY is not set}"
: "${SSH_KNOWN_HOSTS:?SSH_KNOWN_HOSTS is not set}"
: "${DEPLOY_PATH:?DEPLOY_PATH is not set}"
: "${APP_ENV:?APP_ENV is not set}"
# Refuse to deploy with an incomplete configuration. Without this a missing secret would still
# pass the health check and leave a server that starts but cannot talk to Zoho or send OTPs.
REQUIRED=(ZOHO_DC ZOHO_STOREFRONT_DOMAIN ZOHO_CLIENT_ID ZOHO_CLIENT_SECRET ZOHO_BOOKS_ORG_ID
          ZOHO_INVENTORY_ORG_ID ADMIN_TOKEN SESSION_SECRET MSG91_AUTHKEY MSG91_TEMPLATE_ID
          MSG91_OTP_LENGTH MSG91_OTP_EXPIRY ZOHO_REDIRECT_URI)
missing=()
for k in "${REQUIRED[@]}"; do
  if [ -z "${!k:-}" ]; then missing+=("$k"); fi
done
if [ "${#missing[@]}" -gt 0 ]; then
  echo "::error::Missing required settings for $APP_ENV: ${missing[*]}"
  exit 1
fi

PM2_NAME="${PM2_NAME:-arambhika-store}"
PORT="${PORT:-3000}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

install -m 700 -d ~/.ssh
printf '%s\n' "$SSH_PRIVATE_KEY" > "$WORK/key"
chmod 600 "$WORK/key"
printf '%s\n' "$SSH_KNOWN_HOSTS" > "$WORK/known_hosts"
SSH_OPTS=(-i "$WORK/key" -o UserKnownHostsFile="$WORK/known_hosts" -o StrictHostKeyChecking=yes -o BatchMode=yes)
remote() { ssh "${SSH_OPTS[@]}" "$SSH_USER@$SSH_HOST" "$@"; }

# --- 1. .env from the environment (empty values are left out) ---
KEYS=(APP_ENV PORT ZOHO_DC ZOHO_STOREFRONT_DOMAIN ZOHO_REDIRECT_URI ZOHO_CLIENT_ID ZOHO_CLIENT_SECRET
      ZOHO_REFRESH_TOKEN ZOHO_BOOKS_ORG_ID ZOHO_INVENTORY_ORG_ID ADMIN_TOKEN SESSION_SECRET
      MSG91_AUTHKEY MSG91_TEMPLATE_ID MSG91_OTP_LENGTH MSG91_OTP_EXPIRY ALLOWED_TEST_MOBILE
      GST_PROVIDER GST_API_KEY)
: > "$WORK/app.env"
for k in "${KEYS[@]}"; do
  v="${!k:-}"
  if [ -n "$v" ]; then printf '%s=%s\n' "$k" "$v" >> "$WORK/app.env"; fi
done
chmod 600 "$WORK/app.env"

# --- 2. snapshot of the running release, for rollback ---
remote "mkdir -p '$DEPLOY_PATH' && cd '$DEPLOY_PATH' && mkdir -p ../releases && \
  tar --exclude=node_modules --exclude=data --exclude=.git -czf ../releases/previous.tgz . && \
  { [ -f .env ] && cp .env ../releases/previous.env || true; }"

# --- 3. ship the code ---
rsync -az --delete \
  -e "ssh ${SSH_OPTS[*]}" \
  --exclude '.git' --exclude '.github' --exclude 'node_modules' --exclude 'data' --exclude '.env' \
  --exclude 'test' --exclude 'test-helpers' --exclude 'docs' --exclude 'apps' \
  ./ "$SSH_USER@$SSH_HOST:$DEPLOY_PATH/"

scp "${SSH_OPTS[@]}" "$WORK/app.env" "$SSH_USER@$SSH_HOST:$DEPLOY_PATH/.env"

remote "cd '$DEPLOY_PATH' && chmod 600 .env && npm ci --omit=dev --no-audit --no-fund && \
  (pm2 describe '$PM2_NAME' >/dev/null 2>&1 && pm2 restart '$PM2_NAME' --update-env || pm2 start server.js --name '$PM2_NAME') && \
  pm2 save >/dev/null"

# --- 4. health check, with rollback ---
healthy=0
for i in $(seq 1 30); do
  body="$(remote "curl -fsS -m 5 http://127.0.0.1:$PORT/healthz" 2>/dev/null || true)"
  if echo "$body" | grep -q "\"env\":\"$APP_ENV\""; then healthy=1; break; fi
  sleep 2
done

if [ "$healthy" -ne 1 ]; then
  echo "::error::$PM2_NAME did not report healthy for APP_ENV=$APP_ENV; rolling back"
  remote "cd '$DEPLOY_PATH' && tar -xzf ../releases/previous.tgz -C . && \
    { [ -f ../releases/previous.env ] && cp ../releases/previous.env .env || true; } && \
    pm2 restart '$PM2_NAME' --update-env"
  exit 1
fi

echo "Deployed to $SSH_HOST ($APP_ENV): $body"
