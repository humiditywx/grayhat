from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    current_user,
    get_jwt,
    jwt_required,
    set_access_cookies,
    unset_jwt_cookies,
)

from ..extensions import db, limiter
from ..models import RevokedToken, User
from ..services.security import (
    build_provisioning_uri,
    check_password,
    consume_recovery_code,
    encrypt_secret,
    generate_recovery_codes,
    generate_totp_secret,
    hash_password,
    hash_recovery_codes,
    normalize_username,
    qr_code_data_uri,
    validate_password,
    validate_username,
    verify_totp,
)
from ..services.serializers import serialize_user


auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def _issue_auth_response(user: User, status_code: int = 200):
    response = jsonify({
        'ok': True,
        'user': serialize_user(user),
        'requires_totp_setup': not user.totp_enabled,
    })
    token = create_access_token(identity=user.id)
    set_access_cookies(response, token)
    return response, status_code


@auth_bp.post('/register')
@limiter.limit('10 per hour')
def register():
    payload = request.get_json(silent=True) or {}
    username = validate_username(payload.get('username', ''))
    password = validate_password(payload.get('password', ''))
    normalized = normalize_username(username)

    existing = User.query.filter_by(username_normalized=normalized).first()
    if existing:
        return jsonify({'ok': False, 'error': 'This username is already taken.'}), 409

    user = User(
        username=username,
        username_normalized=normalized,
        password_hash=hash_password(password),
    )
    db.session.add(user)
    db.session.commit()
    return _issue_auth_response(user, 201)


@auth_bp.post('/login')
@limiter.limit('20 per hour')
def login():
    payload = request.get_json(silent=True) or {}
    normalized = normalize_username(payload.get('username', ''))
    password = payload.get('password', '')

    user = User.query.filter_by(username_normalized=normalized).first()
    if user is None or not check_password(user.password_hash, password):
        return jsonify({'ok': False, 'error': 'Invalid username or password.'}), 401

    user.last_seen_at = datetime.now(timezone.utc)
    db.session.commit()
    return _issue_auth_response(user)


@auth_bp.post('/logout')
@jwt_required()
def logout():
    jwt_data = get_jwt()
    revoked = RevokedToken(
        jti=jwt_data['jti'],
        user_id=current_user.id,
        expires_at=datetime.fromtimestamp(jwt_data['exp'], tz=timezone.utc),
        reason='logout',
    )
    db.session.merge(revoked)
    db.session.commit()

    response = jsonify({'ok': True})
    unset_jwt_cookies(response)
    return response


@auth_bp.get('/me')
@jwt_required()
def me():
    return jsonify({
        'ok': True,
        'user': serialize_user(current_user),
        'requires_totp_setup': not current_user.totp_enabled,
    })


@auth_bp.post('/totp/setup')
@jwt_required()
def totp_setup():
    secret = generate_totp_secret()
    uri = build_provisioning_uri(secret, current_user.username)
    recovery_codes = [code.upper() for code in generate_recovery_codes()]

    current_user.totp_secret_encrypted = encrypt_secret(secret)
    current_user.recovery_codes = hash_recovery_codes(recovery_codes)
    current_user.totp_enabled = False
    db.session.commit()

    return jsonify({
        'ok': True,
        'otpauth_uri': uri,
        'qr_code': qr_code_data_uri(uri),
        'recovery_codes': recovery_codes,
    })


@auth_bp.post('/totp/confirm')
@jwt_required()
def totp_confirm():
    payload = request.get_json(silent=True) or {}
    code = str(payload.get('code', '')).strip()
    if not current_user.totp_secret_encrypted:
        return jsonify({'ok': False, 'error': 'Set up Google Authenticator first.'}), 400

    from ..services.security import decrypt_secret

    secret = decrypt_secret(current_user.totp_secret_encrypted)
    if not secret or not verify_totp(secret, code):
        return jsonify({'ok': False, 'error': 'The authentication code is invalid.'}), 400

    current_user.totp_enabled = True
    db.session.commit()
    return jsonify({'ok': True, 'user': serialize_user(current_user)})


@auth_bp.post('/password-reset')
@limiter.limit('20 per hour')
def password_reset():
    payload = request.get_json(silent=True) or {}
    normalized = normalize_username(payload.get('username', ''))
    verification_code = str(payload.get('verification_code', '')).strip().upper()
    new_password = validate_password(payload.get('new_password', ''))

    user = User.query.filter_by(username_normalized=normalized).first()
    if user is None or not user.totp_enabled or not user.totp_secret_encrypted:
        return jsonify({'ok': False, 'error': 'Invalid recovery details.'}), 400

    from ..services.security import decrypt_secret

    secret = decrypt_secret(user.totp_secret_encrypted)
    totp_ok = bool(secret and verify_totp(secret, verification_code))
    recovery_ok = False
    if not totp_ok:
        recovery_ok, remaining = consume_recovery_code(user.recovery_codes or [], verification_code)
        if recovery_ok:
            user.recovery_codes = remaining

    if not totp_ok and not recovery_ok:
        return jsonify({'ok': False, 'error': 'Invalid recovery details.'}), 400

    user.password_hash = hash_password(new_password)
    user.token_version += 1
    db.session.commit()
    return _issue_auth_response(user)


@auth_bp.post('/password-change')
@jwt_required()
def password_change():
    payload = request.get_json(silent=True) or {}
    current_password = payload.get('current_password', '')
    new_password = validate_password(payload.get('new_password', ''))

    if not check_password(current_user.password_hash, current_password):
        return jsonify({'ok': False, 'error': 'Your current password is incorrect.'}), 400

    current_user.password_hash = hash_password(new_password)
    current_user.token_version += 1
    db.session.commit()
    return _issue_auth_response(current_user)
