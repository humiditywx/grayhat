# Deployment Updates

---

## 2026-04-28 — Feature: Swagger UI API documentation at /docs

### What changed
| File | Change |
|------|--------|
| `app/blueprints/docs.py` | New blueprint. `GET /docs/` serves a custom dark-themed Swagger UI (swagger-ui loaded from CDN, no new Python packages). `GET /docs/openapi.yaml` serves the OpenAPI spec. The UI auto-injects the `X-CSRF-TOKEN` header from the `csrf_access_token` cookie via `requestInterceptor`, so login → execute works without any manual token setup. |
| `app/static/swagger/openapi.yaml` | OpenAPI 3.0.3 spec covering all 50 endpoints across auth, bootstrap, friends, conversations, messages, groups, users, and stories. Includes schemas, example values, and response documentation. |
| `app/__init__.py` | Registered `docs_bp`. |

### Deploy steps (server)
```bash
cd /opt/expressmessenger
git pull origin main
systemctl restart expressmessenger
systemctl status expressmessenger
```

Backend-only change — no frontend build, no new Python packages, no DB migration needed. Swagger UI loads from CDN on first browser visit.

### Access
```
https://your-server/docs/
```

### Rollback
```bash
cd /opt/expressmessenger
git revert HEAD --no-edit
systemctl restart expressmessenger
```

---

## 2026-04-28 — Bugfix: unfriend + re-add no longer returns HTTP 500

### What changed
| File | Change |
|------|--------|
| `app/blueprints/api.py` | Added `from sqlalchemy.exc import IntegrityError`. Wrapped all three `add_friend()` call sites (`accept_friend_request`, `create_friendship`, `scan_friend_image`) to catch `IntegrityError` in addition to `ValueError`, rolling back the session and returning HTTP 400 `"Already friends."`. Wrapped the `FriendRequest` INSERT in `create_friendship` and `scan_friend_image` in a try/except to catch the race-condition case where two concurrent requests both pass the pending-check and then collide on the `uq_friend_request_pair` unique constraint — returns HTTP 400 `"Request already sent."` instead of 500. |
| `app/__init__.py` | Registered a global `IntegrityError` error handler as a safety net: rolls back the session and returns HTTP 400 JSON for any unhandled SQLAlchemy constraint violation, preventing it from propagating as a 500. |

### Why this fixes the bug
`add_friend()` (in `chat.py`) calls `db.session.flush()` which can raise `IntegrityError` in a race condition (two requests creating the same `Friendship` row concurrently). Callers previously only caught `ValueError`, so the `IntegrityError` escaped as an unhandled 500. This fix handles it locally with a rollback and a clear 400 response. The global handler catches any remaining cases.

### Deploy steps (server)
```bash
cd /opt/expressmessenger
git pull origin main
systemctl restart expressmessenger
systemctl status expressmessenger
```

Backend-only change — no frontend build, no DB migration, no Nginx reload needed.

### Rollback
```bash
cd /opt/expressmessenger
git revert HEAD --no-edit
systemctl restart expressmessenger
```

---

## 2026-04-28 — Bugfix: reverse friend request after unfriend no longer returns HTTP 500

### What changed
| File | Change |
|------|--------|
| `app/blueprints/api.py` | Added `_clear_stale_friend_requests_between()` and use it before creating a new `FriendRequest`. This removes old non-pending request rows in either direction before insert, so the `uq_friend_request_pair` unique constraint cannot turn a normal re-request into an `IntegrityError`/HTTP 500. Applied the cleanup to both `/api/friends` and `/api/friends/scan-image`. |
| `tests/test_smoke.py` | Updated friend tests to the current request/accept flow and added a regression test for: Alice removes Bob, then Bob sends Alice a new friend request. Expected result is HTTP 200 with a pending request. |
| `DEPLOY_UPDATE.md` | Added this deployment note and explicit git commit/push/pull guidance. |

### Why this fixes the bug
`friend_requests` has a unique pair constraint on `(sender_id, receiver_id)`. Older request flows could leave an `accepted` or other non-pending row behind after users became friends. After one user removed the friendship, the next request in the same direction could try to insert a duplicate pair and crash with HTTP 500. The server now deletes stale non-pending rows before inserting a new pending request, while still returning `Request already sent.` for an existing pending request.

### Git workflow
```bash
# Run locally after verifying the patch
git status
git add app/blueprints/api.py tests/test_smoke.py
# DEPLOY_UPDATE.md is ignored today; include it only if deploy notes should be versioned.
git add -f DEPLOY_UPDATE.md
git commit -m "Fix friend request after unfriend"
git push origin main
```

`git commit` records the local code and documentation changes as one deployable snapshot.  
`git push origin main` uploads that snapshot to the remote repository so the server can receive it.  
`git pull origin main` on the server downloads and applies the pushed commit to `/opt/expressmessenger`.
Because `DEPLOY_UPDATE.md` is currently ignored, it remains a local ops note unless it is force-added or the ignore rule is changed. If a server already has an untracked local copy and the file becomes tracked later, move or commit the server copy before `git pull` so Git can check out the tracked file cleanly.

### Deploy steps (server)
```bash
cd /opt/expressmessenger
git pull origin main
systemctl restart expressmessenger
systemctl status expressmessenger
```

Backend-only change — no frontend build, no DB migration, no Nginx reload needed.

### Optional verification (server)
```bash
cd /opt/expressmessenger
.venv/bin/python -m unittest tests/test_smoke.py
```

### Rollback
```bash
cd /opt/expressmessenger
git revert HEAD --no-edit
systemctl restart expressmessenger
```

---

## 2026-04-28 — Optimization pass: dead code removal, query efficiency, DB indexes

### What changed
| File | Change |
|------|--------|
| `frontend/src/hooks/useSounds.js` | Deleted entirely — sound system removed |
| `app/static/sounds/` | Deleted — 13 mp3 files removed |
| `frontend/src/components/panels/GroupsPanel.jsx` | Deleted — dead code, never rendered since sidebar redesign |
| `frontend/src/context/SocketContext.jsx` | Removed useSounds import and `play('messageReceive')` call |
| `frontend/src/components/layout/Sidebar.jsx` | Removed useSounds; added `useMemo` to conversation sort (no longer re-sorts on every render) |
| `frontend/src/components/dialogs/AddFriendDialog.jsx` | Removed useSounds; deleted dead `ScanCamera` function (was never rendered) |
| `frontend/src/components/stories/StoryBar.jsx` | Removed redundant `getStories()` HTTP call after upload — socket `story:new` event already handles state update |
| `frontend/src/components/panels/FriendsPanel.jsx` | Removed useSounds import |
| `frontend/src/App.jsx` | Removed useSounds import and `play('friendAdded')` call |
| `frontend/src/components/common/FriendRequestBanner.jsx` | Removed useSounds and `play('friendRequest')` |
| `frontend/src/components/messages/Composer.jsx` | Removed useSounds and all `play(...)` calls |
| `frontend/src/components/calls/IncomingCallDialog.jsx` | Removed useSounds and ringtone useEffect |
| `frontend/src/components/calls/CallOverlay.jsx` | Removed useSounds and all call-phase sound effects |
| `frontend/src/context/CallContext.jsx` | Removed useSounds, `play('callAnswer')`, and `stopAllCallSounds()` from leaveCall |
| `app/models.py` | Added `Index('ix_cp_conversation', 'conversation_id')` to `ConversationParticipant` and `Index('ix_story_views_viewer', 'viewer_id')` to `StoryView` |
| `app/__init__.py` | Gated `db.create_all()` — only runs when tables are actually missing (avoids full metadata scan on every boot). Added `CREATE INDEX IF NOT EXISTS` statements for the new indexes so existing installs get them on next restart. |
| `app/services/serializers.py` | Added `_preview_from_message()` helper; `serialize_conversation()` now accepts optional `preview` kwarg |
| `app/blueprints/api.py` | `bootstrap()`: removed `selectinload(Conversation.messages)` — was loading every message ever sent across all conversations; replaced with a single batched query that fetches only the last message per conversation |

### Deploy steps (server)
```bash
cd /opt/expressmessenger
git pull
cd frontend && npm install && npm run build
cd /opt/expressmessenger
systemctl restart expressmessenger
systemctl status expressmessenger
```

Frontend changed — npm build required.  
On restart, the new DB indexes are created automatically via `_run_column_migrations`.  
No Nginx reload needed.

### Rollback
```bash
cd /opt/expressmessenger
git revert HEAD --no-edit
cd frontend && npm run build
systemctl restart expressmessenger
```

---

## 2026-04-28 — Bugfix: sending friend request 500 due to stale DB rows

### What changed
| File | Change |
|------|--------|
| `app/blueprints/api.py` | `create_friendship`: outgoing-request check now queries without filtering on `status`. Stale `accepted` rows (left by old code that never deleted them) are deleted before inserting the new request. Also cleans up any stale reverse-direction row. This prevents the `UniqueConstraint` IntegrityError that caused 500s when re-adding someone after unfriending. |

### Deploy steps (server)
```bash
cd /opt/expressmessenger
git pull
systemctl restart expressmessenger
systemctl status expressmessenger
```

Backend-only change — no frontend build, no DB migration, no Nginx reload needed.

### Rollback
```bash
cd /opt/expressmessenger
git revert HEAD --no-edit
systemctl restart expressmessenger
```

---

## 2026-04-28 — Bugfix: friend requests causing HTTP 500 on re-add after unfriend

### What changed
| File | Change |
|------|--------|
| `app/blueprints/api.py` | `accept_friend_request`: delete the `FriendRequest` row instead of setting `status='accepted'` (row was never removed, causing IntegrityError on re-add). Same fix applied to both auto-accept paths in `create_friendship` and `scan_friend_image`. `remove_friend`: added cleanup of `FriendRequest` rows in both directions so stale rows can't block future requests. |

### Deploy steps (server)
```bash
cd /opt/expressmessenger
git pull
systemctl restart expressmessenger
systemctl status expressmessenger
```

Backend-only change — no frontend build, no DB migration, no Nginx reload needed.

### Rollback
```bash
cd /opt/expressmessenger
git revert HEAD --no-edit
systemctl restart expressmessenger
```

---

## 2026-04-28 — Story views: view tracking, eye icon, viewers list

### What changed
| File | Change |
|------|--------|
| `app/models.py` | Added `StoryView` model (`story_views` table) — tracks who viewed each story with a unique constraint per viewer per story. |
| `app/__init__.py` | Added `db.create_all()` call in `_run_column_migrations()` so new tables are auto-created on startup without needing `flask init-db`. |
| `app/blueprints/api.py` | Added `POST /api/stories/<id>/view` (record a view, skips own stories) and `GET /api/stories/<id>/views` (owner-only, returns viewer list). |
| `frontend/src/api.js` | Added `viewStory(id)` and `getStoryViews(id)`. |
| `frontend/src/components/stories/StoryViewer.jsx` | Records a view when any non-own story is displayed. For own stories: shows an eye icon at bottom center with viewer count; tapping it opens a slide-up sheet listing all viewers with timestamps. |
| `frontend/src/styles/global.css` | Added CSS for `.story-view-count-btn`, `.story-viewers-overlay`, `.story-viewers-sheet`, and related elements. |

### Deploy steps (server)
```bash
cd /opt/expressmessenger
git pull
cd frontend && npm install && npm run build
cd /opt/expressmessenger
systemctl restart expressmessenger
systemctl status expressmessenger
```

The `story_views` table is **auto-created on startup** via `db.create_all()` — no manual SQL migration needed.

Frontend changed — npm build required.  
No Nginx reload needed.

### Rollback
```bash
cd /opt/expressmessenger
git revert HEAD --no-edit
cd frontend && npm run build
systemctl restart expressmessenger
```

---

Changes are deployed by pushing to git, pulling on the server, rebuilding if frontend changed, and restarting the service. Server lives at `/opt/expressmessenger`.

```bash
# Standard deploy sequence (run on server)
cd /opt/expressmessenger
git pull
cd frontend && npm install && npm run build   # skip if no frontend changes
cd /opt/expressmessenger
systemctl restart expressmessenger
```

---

## 2026-04-26 — Sidebar redesign: merged inbox/groups into chats, search bar, 3-tab nav

### What changed
| File | Change |
|------|--------|
| `frontend/src/components/layout/Sidebar.jsx` | Removed Inbox and Groups from bottom navbar. Groups now appear inline in the chats list alongside private chats, sorted by recency. Inbox is a pinned "Friend Requests" item at the top of the chat list; clicking it opens an inbox sub-view within the Chats tab. Search bar added above the chat list. Bottom nav reduced to 3 items: Chats, Camera (center), Profile. New Group button moved to chats header. |
| `frontend/src/components/panels/InboxPanel.jsx` | Added `hideHeader` prop for embedded rendering. |
| `frontend/src/styles/global.css` | Added styles for `.chat-search-wrap`, `.chat-search-inner`, `.chat-search`, `.inbox-pinned-avatar`. |

### Deploy steps (server)
```bash
cd /opt/expressmessenger
git pull
cd frontend && npm install && npm run build
cd /opt/expressmessenger
systemctl restart expressmessenger
```

Frontend-only change — no Python deps, no DB migrations, no Nginx reload needed.

### Rollback
```bash
cd /opt/expressmessenger
git revert HEAD --no-edit
cd frontend && npm run build
systemctl restart expressmessenger
```
