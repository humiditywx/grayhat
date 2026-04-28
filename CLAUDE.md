# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (Flask)
```bash
python run.py                              # Start dev server (Socket.IO enabled)
FLASK_APP=wsgi.py flask init-db            # Initialize/reset database
python -m unittest tests.test_smoke        # Run smoke tests
```

### Frontend (React + Vite)
```bash
cd frontend && npm install                 # Install dependencies
cd frontend && npm run dev                 # Dev server on port 3000 (proxies /api and /socket.io to :5000)
cd frontend && npm run build               # Build SPA → app/static/dist/ (required for production)
```

### Environment
Copy key variables into `.env` before starting:
- `SECRET_KEY`, `JWT_SECRET_KEY`, `TOTP_ENCRYPTION_KEY` — required (generate with `scripts/generate_secrets.py`)
- `DATABASE_URL` — defaults to SQLite `sqlite:///app.db`
- `FLASK_DEBUG=true` for development
- `JWT_COOKIE_SECURE=false` for HTTP development

## Architecture

Pentastic is a secure social messaging platform. The Flask backend serves both a REST API (`/api/*`) and acts as a Socket.IO server for real-time events. In production, Vite builds the React SPA into `app/static/dist/` which Flask serves at `/`. In development, Vite's dev server proxies API calls to Flask.

### Request Flow
1. Browser → React SPA (port 3000 in dev, served by Flask in prod)
2. REST calls → `src/api.js` → Flask blueprints in `app/blueprints/`
3. Real-time events → Socket.IO client in `src/context/SocketContext.jsx` → `app/socket_events.py`
4. WebRTC calls use Flask/Socket.IO only for signaling; peer connections are browser-to-browser

### Backend Structure (`app/`)
- **`__init__.py`**: App factory (`create_app`). Registers all blueprints, Socket.IO handlers, JWT hooks, and starts the story cleanup background thread.
- **`blueprints/api.py`**: Main API (1300+ lines). Handles friends, conversations, messages, groups, file attachments, stories, presence, and QR codes.
- **`blueprints/auth.py`**: Auth routes — register, login, logout, TOTP setup/confirm, password reset/change.
- **`blueprints/pages.py`**: Catches all non-API routes and serves `index.html` (SPA fallback).
- **`models.py`**: All SQLAlchemy models. Key relationships: `User` ↔ `Friendship`/`FriendRequest`, `Conversation` (private or group) ↔ `ConversationParticipant` ↔ `Message` ↔ `Attachment`. `PrivateConversationIndex` is a denormalized lookup table for fast private-chat retrieval.
- **`socket_events.py`**: All Socket.IO event handlers — presence, conversation rooms, typing indicators, WebRTC signaling relay, call lifecycle.
- **`services/`**: `security.py` (password hashing, TOTP, JWT helpers), `chat.py` (friendship/conversation creation logic), `serializers.py` (JSON output for all models), `storage.py` (UUID-based file I/O), `story_cleanup.py` (background purge thread).
- **`config.py`**: Loads `.env.production` then `.env`. All config keys and their defaults are documented here.

### Frontend Structure (`frontend/src/`)
- **`App.jsx`**: Top-level auth gate. Bootstraps user data on load; renders `AuthPage` or the main layout.
- **`context/AppContext.jsx`**: Central state (auth user, friends list, conversations, friend requests, active panel, toasts). Consumed by nearly every component.
- **`context/SocketContext.jsx`**: Manages the Socket.IO connection lifecycle and maps incoming events to `AppContext` state updates.
- **`context/CallContext.jsx`**: WebRTC call state — signaling, ICE negotiation, peer connection management.
- **`api.js`**: All HTTP calls. Always sends `X-CSRF-TOKEN` header from the JWT cookie. Import specific functions from here rather than using `fetch` directly.
- **`components/layout/`**: `Sidebar.jsx` (conversation list, navigation) and `ChatPane.jsx` (message view).
- **`components/messages/`**: `MessageList.jsx`, `MessageBubble.jsx`, `Composer.jsx` (handles text, file uploads, voice recording).
- **`components/panels/`**: Slide-in panels for profile, friends, inbox (friend requests), settings, groups.

### Authentication Model
JWT tokens are stored as HttpOnly cookies (`access_token_cookie`). The frontend reads the CSRF token from a separate `csrf_access_token` cookie and sends it as `X-CSRF-TOKEN` on mutating requests. Token version (`token_version` on `User`) is incremented on password change to invalidate all existing sessions. Tokens auto-renew 30 minutes before expiry via a Flask `after_request` hook.

### Database Notes
- SQLite for development, PostgreSQL for production (`DATABASE_URL`).
- The app does not use Alembic; schema migrations are handled by raw SQL files in `deploy/` and an `_auto_migrate()` function in `__init__.py` that adds missing columns on startup.
- Message deletion is soft (`deleted_at` timestamp); the body is replaced with `null` on delete.
