# Pentastic — Update Guide (Ubuntu 24.04)

App lives at `/opt/expressmessenger`. All commands run as root or with sudo.

---

## 1. Pull latest code

```bash
cd /opt/expressmessenger
git pull
```

---

## 2. Install Node.js (first time only)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v   # should be 20.x
```

---

## 3. Build the React frontend

```bash
cd /opt/expressmessenger/frontend
npm install
npm run build
```

This outputs the compiled SPA to `app/static/dist/`. Flask serves it automatically.

---

## 4. Update Python dependencies (if requirements.txt changed)

```bash
cd /opt/expressmessenger
source .venv/bin/activate
pip install -r requirements.txt
```

---

## 5. Run any new database migrations

Check `deploy/` for any new `.sql` migration files and apply them:

```bash
psql -U pentastic -d pentastic -f deploy/migrate_new_features.sql
# or whichever new migration files exist
```

For Flask schema changes (new models):

```bash
source .venv/bin/activate
flask db upgrade    # only if Flask-Migrate is configured
# or: flask init-db  # full reset (destructive on production — avoid)
```

---

## 6. Restart the app service

```bash
systemctl restart expressmessenger
systemctl status expressmessenger   # confirm it's active
```

---

## 7. Reload Nginx (if config changed)

```bash
nginx -t && systemctl reload nginx
```

---

## 8. Verify

```bash
curl -I https://your-domain.com/
# Expect: HTTP/2 200
```

Open the site in a browser — you should see the new Pentastic UI (light mode, purple accent).

---

## Rollback

If something breaks, revert the commit and rebuild:

```bash
cd /opt/expressmessenger
git revert HEAD --no-edit
# or: git checkout <previous-commit>
cd frontend && npm run build
systemctl restart expressmessenger
```

---

## Environment variables

The `.env.production` file at `/opt/expressmessenger/.env.production` controls all config.
Key values to verify after a rebrand:

```
APP_NAME=Pentastic
TOTP_ISSUER=Pentastic
PUBLIC_BASE_URL=https://your-domain.com
```

These default to `Pentastic` in code now, but explicit env vars take precedence.

---

## Troubleshooting

**React app not loading (404 on `/`):**
Make sure the build ran: `ls app/static/dist/index.html` — file must exist.

**Socket.IO disconnecting:**
Check Nginx WS proxy config:
```nginx
location /socket.io/ {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

**Sounds not playing:**
Sound files live at `/opt/expressmessenger/app/static/sounds/`. Flask serves them at `/static/sounds/`.
