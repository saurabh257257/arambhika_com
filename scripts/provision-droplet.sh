#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 22.04/24.04 droplet so the pipeline can deploy to it.
# Run as root on the new droplet:
#   bash provision-droplet.sh dev.arambhika.com
# Afterwards: point DNS at the droplet, run certbot (printed at the end), and add the droplet's
# details to the GitHub "dev" environment (see docs/PIPELINE.md).
set -euo pipefail

DOMAIN="${1:?usage: provision-droplet.sh <domain>}"
APP_DIR="${APP_DIR:-/root/app}"
PORT="${PORT:-3000}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates rsync nginx certbot python3-certbot-nginx ufw

# These droplets have 512 MB of RAM; npm install needs headroom, so add swap if there is none.
if ! swapon --show | grep -q .; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Node 20 LTS and pm2 (matches production)
if ! command -v node >/dev/null || ! node -v | grep -q '^v20'; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
command -v pm2 >/dev/null || npm install -g pm2
pm2 startup systemd -u root --hp /root >/dev/null || true

mkdir -p "$APP_DIR" "$(dirname "$APP_DIR")/releases"

cat > "/etc/nginx/sites-available/$DOMAIN" <<NGINX
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null

echo
echo "Provisioned. Next:"
echo "  1. Point the DNS A record for $DOMAIN at this droplet's IP."
echo "  2. Once DNS resolves:  certbot --nginx -d $DOMAIN"
echo "  3. Add the GitHub environment secrets and push to the branch (docs/PIPELINE.md)."
