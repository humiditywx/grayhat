#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer as root or through sudo."
  exit 1
fi

APP_NAME="${APP_NAME:-ExpressMessenger}"
APP_SLUG="${APP_SLUG:-expressmessenger}"
APP_USER="${APP_USER:-expressmessenger}"
APP_GROUP="${APP_GROUP:-${APP_USER}}"
APP_DIR="${APP_DIR:-/opt/expressmessenger}"
APP_PORT="${APP_PORT:-5000}"
APP_HOST="${APP_HOST:-127.0.0.1}"
PROJECT_SOURCE="${PROJECT_SOURCE:-$(pwd)}"
DOMAIN="${DOMAIN:-$(hostname -f)}"
ENABLE_HTTPS="${ENABLE_HTTPS:-1}"
PUBLIC_SCHEME="https"
if [[ "${ENABLE_HTTPS}" != "1" ]]; then
  PUBLIC_SCHEME="http"
fi
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-${PUBLIC_SCHEME}://${DOMAIN}}"
JWT_COOKIE_SECURE="false"
if [[ "${ENABLE_HTTPS}" == "1" ]]; then
  JWT_COOKIE_SECURE="true"
fi
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
DB_NAME="${DB_NAME:-expressmessenger}"
DB_USER="${DB_USER:-expressmessenger}"
DB_PASSWORD="${DB_PASSWORD:-}"
ENABLE_TURN="${ENABLE_TURN:-1}"
TURN_USERNAME="${TURN_USERNAME:-turnuser}"
TURN_PASSWORD="${TURN_PASSWORD:-}"
TURN_EXTERNAL_IP="${TURN_EXTERNAL_IP:-}"
TURN_MIN_PORT="${TURN_MIN_PORT:-49160}"
TURN_MAX_PORT="${TURN_MAX_PORT:-49200}"
SOCKETIO_MESSAGE_QUEUE="${SOCKETIO_MESSAGE_QUEUE:-}"
RATE_LIMIT_STORAGE_URI="${RATE_LIMIT_STORAGE_URI:-memory://}"
FLASK_DEBUG="${FLASK_DEBUG:-false}"
MAX_CONTENT_LENGTH="${MAX_CONTENT_LENGTH:-52428800}"
JWT_ACCESS_TOKEN_HOURS="${JWT_ACCESS_TOKEN_HOURS:-8}"
ACCESS_RENEWAL_THRESHOLD_MINUTES="${ACCESS_RENEWAL_THRESHOLD_MINUTES:-30}"
PASSWORD_MIN_LENGTH="${PASSWORD_MIN_LENGTH:-10}"
MESSAGE_MAX_LENGTH="${MESSAGE_MAX_LENGTH:-4000}"
USERNAME_MIN_LENGTH="${USERNAME_MIN_LENGTH:-3}"
USERNAME_MAX_LENGTH="${USERNAME_MAX_LENGTH:-24}"
TOTP_VALID_WINDOW="${TOTP_VALID_WINDOW:-1}"
TOTP_ISSUER="${TOTP_ISSUER:-ExpressMessenger}"
SECRET_KEY="${SECRET_KEY:-}"
JWT_SECRET_KEY="${JWT_SECRET_KEY:-}"
TOTP_ENCRYPTION_KEY="${TOTP_ENCRYPTION_KEY:-}"
GUNICORN_THREADS="${GUNICORN_THREADS:-100}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1"
    exit 1
  }
}

resolve_ipv4() {
  local value="${1}"
  getent ahostsv4 "${value}" | awk 'NR==1 {print $1}'
}

random_urlsafe() {
  python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
}

random_fernet() {
  python3 - <<'PY'
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
PY
}

if [[ -z "${SECRET_KEY}" ]]; then
  SECRET_KEY="$(random_urlsafe)"
fi
if [[ -z "${JWT_SECRET_KEY}" ]]; then
  JWT_SECRET_KEY="$(random_urlsafe)"
fi
if [[ -z "${TOTP_ENCRYPTION_KEY}" ]]; then
  TOTP_ENCRYPTION_KEY="$(random_fernet)"
fi
if [[ -z "${DB_PASSWORD}" ]]; then
  DB_PASSWORD="$(python3 - <<'PY'
import base64, os
print(base64.urlsafe_b64encode(os.urandom(24)).decode().rstrip('='))
PY
)"
fi
if [[ -z "${TURN_PASSWORD}" ]]; then
  TURN_PASSWORD="$(python3 - <<'PY'
import base64, os
print(base64.urlsafe_b64encode(os.urandom(18)).decode().rstrip('='))
PY
)"
fi
if [[ -z "${TURN_EXTERNAL_IP}" ]]; then
  TURN_EXTERNAL_IP="$(resolve_ipv4 "${DOMAIN}" || true)"
fi
if [[ -z "${TURN_EXTERNAL_IP}" ]]; then
  TURN_EXTERNAL_IP="$(hostname -I | awk '{print $1}')"
fi

need_cmd python3
need_cmd apt-get
need_cmd systemctl
need_cmd psql || true

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y \
  build-essential \
  certbot \
  coturn \
  libpq-dev \
  libzbar0 \
  nginx \
  postgresql \
  python3 \
  python3-certbot-nginx \
  python3-dev \
  python3-venv \
  redis-server \
  rsync

systemctl enable postgresql
systemctl start postgresql
systemctl enable nginx
systemctl start nginx

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  useradd --create-home --home-dir "/home/${APP_USER}" --shell /bin/bash "${APP_USER}"
fi

install -d -m 0755 -o "${APP_USER}" -g "${APP_GROUP}" "${APP_DIR}"
rsync -a --delete \
  --exclude '.git' \
  --exclude '.venv' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude '.env' \
  --exclude '.env.production' \
  --exclude 'uploads/*' \
  "${PROJECT_SOURCE}/" "${APP_DIR}/"
install -d -m 0755 -o "${APP_USER}" -g "${APP_GROUP}" "${APP_DIR}/uploads"

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO
\$\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
      CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
   ELSE
      ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
   END IF;
END
\$\$;
SQL

sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"

sudo -u "${APP_USER}" python3 -m venv "${APP_DIR}/.venv"
"${APP_DIR}/.venv/bin/pip" install --upgrade pip wheel
"${APP_DIR}/.venv/bin/pip" install -r "${APP_DIR}/requirements.txt"

TURN_URLS=""
STUN_URLS="stun:stun.l.google.com:19302"
if [[ "${ENABLE_TURN}" == "1" ]]; then
  STUN_URLS="stun:${DOMAIN}:3478,stun:stun.l.google.com:19302"
  TURN_URLS="turn:${DOMAIN}:3478?transport=udp,turn:${DOMAIN}:3478?transport=tcp"
fi

cat > "${APP_DIR}/.env.production" <<ENVFILE
APP_NAME=${APP_NAME}
SECRET_KEY=${SECRET_KEY}
JWT_SECRET_KEY=${JWT_SECRET_KEY}
PUBLIC_BASE_URL=${PUBLIC_BASE_URL}
DATABASE_URL=postgresql+psycopg://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}
MAX_CONTENT_LENGTH=${MAX_CONTENT_LENGTH}
UPLOAD_ROOT=${APP_DIR}/uploads
JWT_COOKIE_SECURE=${JWT_COOKIE_SECURE}
JWT_COOKIE_SAMESITE=Lax
JWT_COOKIE_CSRF_PROTECT=true
JWT_ACCESS_TOKEN_HOURS=${JWT_ACCESS_TOKEN_HOURS}
ACCESS_RENEWAL_THRESHOLD_MINUTES=${ACCESS_RENEWAL_THRESHOLD_MINUTES}
PASSWORD_MIN_LENGTH=${PASSWORD_MIN_LENGTH}
MESSAGE_MAX_LENGTH=${MESSAGE_MAX_LENGTH}
USERNAME_MIN_LENGTH=${USERNAME_MIN_LENGTH}
USERNAME_MAX_LENGTH=${USERNAME_MAX_LENGTH}
TOTP_ISSUER=${TOTP_ISSUER}
TOTP_ENCRYPTION_KEY=${TOTP_ENCRYPTION_KEY}
TOTP_VALID_WINDOW=${TOTP_VALID_WINDOW}
RATE_LIMIT_STORAGE_URI=${RATE_LIMIT_STORAGE_URI}
SOCKETIO_MESSAGE_QUEUE=${SOCKETIO_MESSAGE_QUEUE}
STUN_URLS=${STUN_URLS}
TURN_URLS=${TURN_URLS}
TURN_USERNAME=${TURN_USERNAME}
TURN_CREDENTIAL=${TURN_PASSWORD}
FLASK_DEBUG=${FLASK_DEBUG}
GUNICORN_THREADS=${GUNICORN_THREADS}
APP_PORT=${APP_PORT}
GUNICORN_BIND=${APP_HOST}:${APP_PORT}
ENVFILE
chown "${APP_USER}:${APP_GROUP}" "${APP_DIR}/.env.production"
chmod 0600 "${APP_DIR}/.env.production"

pushd "${APP_DIR}" >/dev/null
sudo -u "${APP_USER}" env FLASK_APP=wsgi.py "${APP_DIR}/.venv/bin/flask" init-db
popd >/dev/null

cat > /etc/systemd/system/${APP_SLUG}.service <<SERVICE
[Unit]
Description=${APP_NAME}
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${APP_DIR}
Environment=PYTHONUNBUFFERED=1
Environment=FLASK_APP=wsgi.py
ExecStart=${APP_DIR}/.venv/bin/gunicorn -c ${APP_DIR}/gunicorn.conf.py wsgi:app
Restart=always
RestartSec=3
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
SERVICE

cat > /etc/nginx/sites-available/${APP_SLUG}.conf <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 50M;

    location / {
        proxy_pass http://${APP_HOST}:${APP_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
    }

    location /socket.io/ {
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_pass http://${APP_HOST}:${APP_PORT}/socket.io/;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX

ln -sf /etc/nginx/sites-available/${APP_SLUG}.conf /etc/nginx/sites-enabled/${APP_SLUG}.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl daemon-reload
systemctl enable ${APP_SLUG}
systemctl restart ${APP_SLUG}
systemctl reload nginx

if [[ "${ENABLE_HTTPS}" == "1" && -n "${CERTBOT_EMAIL}" && ! "${DOMAIN}" =~ ^[0-9.]+$ ]]; then
  certbot --nginx --non-interactive --agree-tos --redirect -m "${CERTBOT_EMAIL}" -d "${DOMAIN}"
fi

if [[ "${ENABLE_TURN}" == "1" ]]; then
  cat > /etc/turnserver.conf <<TURNCONF
listening-port=3478
fingerprint
realm=${DOMAIN}
server-name=${DOMAIN}
lt-cred-mech
user=${TURN_USERNAME}:${TURN_PASSWORD}
min-port=${TURN_MIN_PORT}
max-port=${TURN_MAX_PORT}
no-multicast-peers
no-cli
external-ip=${TURN_EXTERNAL_IP}
TURNCONF

  if grep -q '^#TURNSERVER_ENABLED=0' /etc/default/coturn; then
    sed -i 's/^#TURNSERVER_ENABLED=0/TURNSERVER_ENABLED=1/' /etc/default/coturn
  elif ! grep -q '^TURNSERVER_ENABLED=1' /etc/default/coturn; then
    echo 'TURNSERVER_ENABLED=1' >> /etc/default/coturn
  fi
  systemctl enable coturn
  systemctl restart coturn
fi

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q 'Status: active'; then
  ufw allow 80/tcp
  ufw allow 443/tcp
  if [[ "${ENABLE_TURN}" == "1" ]]; then
    ufw allow 3478/tcp
    ufw allow 3478/udp
    ufw allow ${TURN_MIN_PORT}:${TURN_MAX_PORT}/udp
  fi
fi

cat > /root/${APP_SLUG}-install-summary.txt <<SUMMARY
Application: ${APP_NAME}
Directory: ${APP_DIR}
Domain: ${DOMAIN}
Public URL: ${PUBLIC_BASE_URL}
System user: ${APP_USER}
Database: ${DB_NAME}
Database user: ${DB_USER}
Database password: ${DB_PASSWORD}
TURN username: ${TURN_USERNAME}
TURN password: ${TURN_PASSWORD}
Environment file: ${APP_DIR}/.env.production
Service name: ${APP_SLUG}
SUMMARY
chmod 0600 /root/${APP_SLUG}-install-summary.txt

echo "Provisioning complete."
echo "Summary written to /root/${APP_SLUG}-install-summary.txt"
echo "Service status: systemctl status ${APP_SLUG}"
