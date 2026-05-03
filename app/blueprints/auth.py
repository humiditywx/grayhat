from __future__ import annotations

from datetime import datetime, timezone, timedelta

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
from ..models import RevokedToken, User, OTP
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
    generate_secure_otp,
)
from ..services.serializers import serialize_user
from ..services.mail import send_otp_email


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


@auth_bp.post('/otp/send')
@limiter.limit('3 per 15 minutes')
def send_otp():
    payload = request.get_json(silent=True) or {}
    email = payload.get('email', '').strip().lower()
    if not email:
        return jsonify({'ok': False, 'error': 'Email is required.'}), 400

    otp_code = generate_secure_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    otp_record = OTP(
        email=email,
        code_hash=hash_password(otp_code),
        expires_at=expires_at
    )
    db.session.add(otp_record)
    db.session.commit()

    from flask import current_app
    send_otp_email(email, otp_code, current_app.config['APP_NAME'])

    return jsonify({'ok': True, 'message': 'OTP sent successfully.'})


@auth_bp.post('/otp/verify')
def verify_otp():
    payload = request.get_json(silent=True) or {}
    email = payload.get('email', '').strip().lower()
    code = payload.get('code', '').strip()

    if not email or not code:
        return jsonify({'ok': False, 'error': 'Email and code are required.'}), 400

    now = datetime.now(timezone.utc)
    otp_record = OTP.query.filter(
        OTP.email == email,
        OTP.expires_at > now,
        OTP.used_at == None
    ).order_by(OTP.created_at.desc()).first()

    if not otp_record or not check_password(otp_record.code_hash, code):
        return jsonify({'ok': False, 'error': 'Invalid or expired OTP.'}), 400

    otp_record.used_at = now

    user = User.query.filter_by(email=email).first()
    if user:
        if not user.username:
            # User started registration but didn't finish
        return jsonify({
            'ok': True,
            'registered': False,
            'registration_token': create_access_token(
                identity=user.id,
                additional_claims={'purpose': 'registration', 'tv': user.token_version or 0},
                expires_delta=timedelta(hours=1)
            )
        })

        user.last_seen_at = now
        db.session.commit()
        return _issue_auth_response(user)
    else:
        # New user
        user = User(email=email)
        db.session.add(user)
        db.session.commit()
        return jsonify({
            'ok': True,
            'registered': False,
            'registration_token': create_access_token(
                identity=user.id,
                additional_claims={'purpose': 'registration', 'tv': 0},
                expires_delta=timedelta(hours=1)
            )
        })


@auth_bp.post('/register/complete')
@jwt_required()
def register_complete():
    claims = get_jwt()
    if claims.get('purpose') != 'registration':
        return jsonify({'ok': False, 'error': 'Invalid registration session.'}), 403

    payload = request.get_json(silent=True) or {}
    username = validate_username(payload.get('username', ''))
    display_name = payload.get('display_name', '')[:20]
    is_global = bool(payload.get('is_global', False))
    normalized = normalize_username(username)

    existing = User.query.filter_by(username_normalized=normalized).first()
    if existing and existing.id != current_user.id:
        return jsonify({'ok': False, 'error': 'This username is already taken.'}), 409

    current_user.username = username
    current_user.username_normalized = normalized
    current_user.display_name = display_name
    current_user.is_global = is_global
    db.session.commit()

    return _issue_auth_response(current_user)


@auth_bp.post('/login')
def login():
    return jsonify({'ok': False, 'error': 'Standard login is disabled. Use OTP.'}), 405


@auth_bp.post('/register')
def old_register():
    return jsonify({'ok': False, 'error': 'Standard registration is disabled. Use OTP.'}), 405


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
