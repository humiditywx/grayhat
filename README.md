# Pentastic (previously ExpressMessenger)

Pentastic is an open-source effort to create a secure social messaging platform with following feature set for now:

- username/password registration with automatic UUID assignment
- private conversations
- friend add by UUID, add-link, QR code image upload, or live camera scan when the browser supports it
- public groups with shareable links
- text messages, editable text messages, file attachments, media uploads, and voice notes
- browser-based voice and video calling with WebRTC
- Google Authenticator compatible TOTP account recovery and password reset
- Responsive React frontend with mobile app like feel

## Stack

- Backend: Flask
- Database: PostgreSQL
- Realtime: Socket.IO rooms for chat events and WebRTC signaling
- Frontend: server-rendered entrypoint plus Vanilla HTML/CSS/JS
- Deployment: Gunicorn threaded worker behind Nginx on Ubuntu Server

## Core behavior

### Identity and friends

Every user receives a UUID at registration. Usernames are stored in original form and in a normalized lowercase field with a unique index, so `Alice` and `alice` cannot coexist.

Private chats are created automatically the first time two users become friends. Friends can be added by:

- directly entering the UUID
- pasting an add-link URL
- uploading a QR code image
- scanning a QR code with the camera on browsers that support `BarcodeDetector (planning on better implementation for this)`

### Authentication and recovery

The web app uses JWT access tokens stored in cookies. Protected endpoints require valid JWTs and authorization is enforced by route ownership checks.

The app also enables:

- automatic token rotation before access-token expiry
- token version invalidation on password change or password reset
- per-token revocation on logout
- CSRF protection for cookie-backed JWT requests
- Google Authenticator compatible TOTP setup and verification
- one-time recovery codes for TOTP backup

### Messaging

Supported message flows:

- plain text messages
- text message editing by the original sender
- document and media uploads
- voice notes recorded in the browser with `MediaRecorder`
- protected attachment download URLs that require membership in the conversation

### Calling

Calling is browser-to-browser WebRTC. The Flask backend handles signaling only.

- `Socket.IO` rooms coordinate call presence and peer discovery
- the browser creates direct peer connections for voice/video media
- TURN is recommended in production for NAT-restricted networks
## Security notes

- Passwords are hashed with Werkzeug's `scrypt` password hasher.
- TOTP secrets are encrypted at rest using a Fernet key from `TOTP_ENCRYPTION_KEY`.
- JWT cookies are HttpOnly and are intended to be served over HTTPS in production.
- Same-origin checks are enforced for state-changing HTTP requests.
- Socket.IO uses same-origin behavior by default.
- Rate limiting is enabled globally and on sensitive auth endpoints.
- Uploaded filenames are sanitized and files are stored under UUID-based names.

## Local development

### 1. Create a virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 2. Generate secrets and write `.env`

```bash
python scripts/generate_secrets.py
```

Create a `.env` file with the generated values and at minimum set:

- `SECRET_KEY`
- `JWT_SECRET_KEY`
- `TOTP_ENCRYPTION_KEY`
- `DATABASE_URL`
- `PUBLIC_BASE_URL`
- `JWT_COOKIE_SECURE=false` for local HTTP development
- `FLASK_DEBUG=true`

A minimal local database setting is:

```bash
DATABASE_URL=sqlite:///app.db
```

### 3. Initialize the database

```bash
export FLASK_APP=wsgi.py
flask init-db
```

### 4. Start the application

```bash
python run.py
```

Open the app on `http://127.0.0.1:5000`.

## Production deployment

Use the included Ubuntu 24.04 installer:

```bash
sudo DOMAIN=chat.example.net CERTBOT_EMAIL=ops@example.net bash deploy/install_ubuntu_24_04.sh
```

The installer will:

- install system packages
- configure PostgreSQL
- create secrets
- install Python dependencies into a virtual environment
- create `.env.production`
- initialize the schema
- write the systemd service
- configure Nginx for HTTP and WebSocket proxying
- optionally provision coturn for TURN relay support
