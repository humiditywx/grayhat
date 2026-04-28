from __future__ import annotations

from datetime import datetime, timedelta, timezone

from flask import Flask, abort, jsonify, request
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    current_user,
    get_jwt,
    get_jwt_identity,
    set_access_cookies,
)

from .blueprints.api import api_bp
from .blueprints.auth import auth_bp
from .blueprints.docs import docs_bp
from .blueprints.pages import pages_bp
from .config import Config
from .extensions import db, jwt, limiter, socketio
from .models import RevokedToken, User


def create_app(config_object: type[Config] = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_object)
    app.config['RATELIMIT_STORAGE_URI'] = app.config['RATE_LIMIT_STORAGE_URI']
    app.config['RATELIMIT_HEADERS_ENABLED'] = True

    if not app.config['TOTP_ENCRYPTION_KEY'] and not app.config['TESTING']:
        raise RuntimeError('TOTP_ENCRYPTION_KEY must be configured before the app can start.')

    app.config['UPLOAD_ROOT'].mkdir(parents=True, exist_ok=True)

    db.init_app(app)
    jwt.init_app(app)
    limiter.init_app(app)
    socketio.init_app(app, message_queue=app.config.get('SOCKETIO_MESSAGE_QUEUE') or None)

    app.register_blueprint(pages_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(api_bp)
    app.register_blueprint(docs_bp)

    _register_jwt_handlers(app)
    _register_app_hooks(app)
    _register_error_handlers(app)
    _register_cli(app)

    from . import socket_events  # noqa: F401

    # Ensure columns added after initial create_all() are present in the database.
    # db.create_all() only creates missing tables, not missing columns on existing tables.
    _run_column_migrations(app)

    # Start background thread that purges expired stories every 5 minutes
    if not app.config.get('TESTING'):
        from .services.story_cleanup import start_cleanup_thread
        start_cleanup_thread(app)

    return app


def _run_column_migrations(app: Flask) -> None:
    """Add any columns/indexes introduced after the initial schema creation."""
    from sqlalchemy import inspect, text
    with app.app_context():
        try:
            inspector = inspect(db.engine)
            existing_tables = set(inspector.get_table_names())

            # Only call create_all when new tables are genuinely missing — avoids a
            # full metadata scan on every boot for established installs.
            all_known = {'users', 'friendships', 'friend_requests', 'conversations',
                         'conversation_participants', 'private_conversation_indices',
                         'messages', 'attachments', 'revoked_tokens', 'stories',
                         'story_views', 'call_presences'}
            if not all_known.issubset(existing_tables):
                db.create_all()
                inspector = inspect(db.engine)  # refresh after table creation
                existing_tables = set(inspector.get_table_names())

            if 'users' not in existing_tables:
                return  # fresh install — create_all handled everything

            existing_cols = {c['name'] for c in inspector.get_columns('users')}
            stmts = []
            if 'bio' not in existing_cols:
                stmts.append("ALTER TABLE users ADD COLUMN bio TEXT")
            if 'username_changed_at' not in existing_cols:
                stmts.append("ALTER TABLE users ADD COLUMN username_changed_at JSON NOT NULL DEFAULT '[]'")
            # Indexes added after initial deploy — CREATE INDEX IF NOT EXISTS is idempotent
            stmts += [
                "CREATE INDEX IF NOT EXISTS ix_cp_conversation ON conversation_participants (conversation_id)",
                "CREATE INDEX IF NOT EXISTS ix_story_views_viewer ON story_views (viewer_id)",
            ]
            if stmts:
                with db.engine.connect() as conn:
                    for stmt in stmts:
                        try:
                            conn.execute(text(stmt))
                            conn.commit()
                        except Exception:
                            conn.rollback()
        except Exception:
            pass  # never block startup


def _register_jwt_handlers(app: Flask) -> None:
    @jwt.additional_claims_loader
    def add_claims(identity: str):
        user = db.session.get(User, identity)
        return {'tv': (user.token_version or 0) if user else 0}

    @jwt.user_lookup_loader
    def user_lookup(_jwt_header, jwt_data):
        identity = jwt_data['sub']
        return db.session.get(User, identity)

    @jwt.token_in_blocklist_loader
    def token_in_blocklist(_jwt_header, jwt_payload):
        identity = jwt_payload['sub']
        user = db.session.get(User, identity)
        if user is None:
            return True
        # Guard against NULL token_version in legacy rows
        if jwt_payload.get('tv', 0) != (user.token_version or 0):
            return True
        return RevokedToken.query.filter_by(jti=jwt_payload['jti']).first() is not None

    @jwt.expired_token_loader
    def expired_token(_jwt_header, _jwt_payload):
        return jsonify({'ok': False, 'error': 'Your session has expired. Please sign in again.'}), 401

    @jwt.invalid_token_loader
    def invalid_token(message):
        return jsonify({'ok': False, 'error': message}), 401

    @jwt.unauthorized_loader
    def unauthorized_loader(message):
        return jsonify({'ok': False, 'error': message}), 401



def _register_app_hooks(app: Flask) -> None:
    @app.before_request
    def enforce_same_origin():
        if request.method in {'POST', 'PUT', 'PATCH', 'DELETE'}:
            origin = request.headers.get('Origin')
            if origin:
                allowed = {request.host_url.rstrip('/')}
                configured = app.config.get('PUBLIC_BASE_URL', '').rstrip('/')
                if configured:
                    allowed.add(configured)
                if origin.rstrip('/') not in allowed:
                    abort(403, description='Cross-origin request rejected.')

    @app.before_request
    def update_presence():
        try:
            identity = get_jwt_identity()
        except Exception:
            identity = None
        if identity:
            user = db.session.get(User, identity)
            if user:
                user.last_seen_at = datetime.now(timezone.utc)

    @app.after_request
    def refresh_expiring_jwt(response):
        try:
            exp_timestamp = get_jwt()['exp']
            now = datetime.now(timezone.utc)
            renewal_target = datetime.timestamp(now + timedelta(minutes=app.config['ACCESS_RENEWAL_THRESHOLD_MINUTES']))
            if renewal_target > exp_timestamp and current_user:
                new_token = create_access_token(identity=current_user.id)
                set_access_cookies(response, new_token)
        except Exception:
            pass
        try:
            if db.session.is_active:
                db.session.commit()
        except Exception:
            db.session.rollback()
        return response



def _register_error_handlers(app: Flask) -> None:
    from sqlalchemy.exc import IntegrityError

    @app.errorhandler(IntegrityError)
    def integrity_error(error):
        db.session.rollback()
        return _error_response(error, 400, default_message='The request conflicts with existing data.')

    @app.errorhandler(ValueError)
    def value_error(error):
        return _error_response(error, 400)

    @app.errorhandler(400)
    def bad_request(error):
        return _error_response(error, 400)

    @app.errorhandler(403)
    def forbidden(error):
        return _error_response(error, 403)

    @app.errorhandler(404)
    def not_found(error):
        return _error_response(error, 404)

    @app.errorhandler(413)
    def too_large(error):
        return _error_response(error, 413, default_message='The uploaded file is too large.')

    @app.errorhandler(429)
    def rate_limited(error):
        return _error_response(error, 429, default_message='Too many requests. Slow down and try again.')



def _error_response(error, status_code: int, default_message: str | None = None):
    message = getattr(error, 'description', None) or default_message or 'Request failed.'
    if request.path.startswith('/api/') or request.path.startswith('/socket.io/'):
        return jsonify({'ok': False, 'error': message}), status_code
    return message, status_code



def _register_cli(app: Flask) -> None:
    @app.cli.command('init-db')
    def init_db_command():
        db.create_all()
        print('Database initialized.')

    @app.cli.command('purge-revoked')
    def purge_revoked_tokens():
        now = datetime.now(timezone.utc)
        RevokedToken.query.filter(RevokedToken.expires_at < now).delete()
        db.session.commit()
        print('Expired revoked tokens removed.')
