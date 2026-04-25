"""Background thread that periodically purges expired stories from the database and disk."""
from __future__ import annotations

import logging
import os
import threading
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_INTERVAL_SECONDS = 300  # run every 5 minutes
_started = False
_lock = threading.Lock()


def _cleanup_once(app) -> None:
    """Delete expired Story rows and their media files from disk."""
    with app.app_context():
        from ..extensions import db
        from ..models import Story

        now = datetime.now(timezone.utc)
        expired = Story.query.filter(Story.expires_at <= now).all()
        if not expired:
            return

        deleted_count = 0
        for story in expired:
            try:
                if story.storage_path and os.path.exists(story.storage_path):
                    os.remove(story.storage_path)
            except OSError as exc:
                logger.warning("Could not delete story file %s: %s", story.storage_path, exc)
            db.session.delete(story)
            deleted_count += 1

        if deleted_count:
            db.session.commit()
            logger.info("Story cleanup: removed %d expired story/stories", deleted_count)


def _loop(app) -> None:
    while True:
        time.sleep(_INTERVAL_SECONDS)
        try:
            _cleanup_once(app)
        except Exception as exc:  # noqa: BLE001
            logger.error("Story cleanup error: %s", exc, exc_info=True)


def start_cleanup_thread(app) -> None:
    """Start the daemon cleanup thread once per process."""
    global _started
    with _lock:
        if _started:
            return
        _started = True

    t = threading.Thread(target=_loop, args=(app,), daemon=True, name="story-cleanup")
    t.start()
    logger.info("Story cleanup thread started (interval=%ds)", _INTERVAL_SECONDS)
