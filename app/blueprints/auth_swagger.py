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
from ..swagger_config import (
    AUTH_REGISTER, AUTH_LOGIN, AUTH_LOGOUT, AUTH_ME,
    TOTP_SETUP, TOTP_CONFIRM, PASSWORD_RESET, PASSWORD_CHANGE
)


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
    """
    Yeni istifadəçi qeydiyyatı
    ---
    tags:
      - Authentication
    summary: Yeni istifadəçi qeydiyyatı
    description: Yeni hesab yaratmaq üçün username və password göndərin
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - username
            - password
          properties:
            username:
              type: string
              example: john_doe
              description: 3-20 simvol arasında istifadəçi adı
            password:
              type: string
              example: SecurePass123!
              description: Ən az 8 simvol, böyük/kiçik hərflər, rəqəmlər və simvollar tələb olunur
    responses:
      201:
        description: Qeydiyyat uğurlu
        schema:
          type: object
          properties:
            ok:
              type: boolean
            user:
              type: object
            requires_totp_setup:
              type: boolean
      400:
        description: Validation xətası
      409:
        description: Bu username artıq istifadə olunub
    """
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
    """
    Hesaba daxil ol
    ---
    tags:
      - Authentication
    summary: Hesaba daxil ol
    description: Username və password ilə daxil ol, JWT token alın
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - username
            - password
          properties:
            username:
              type: string
              example: john_doe
            password:
              type: string
              example: SecurePass123!
    responses:
      200:
        description: Login uğurlu - JWT cookie-də qurulur
        schema:
          type: object
          properties:
            ok:
              type: boolean
            user:
              type: object
            requires_totp_setup:
              type: boolean
      401:
        description: Username/password səhv
    """
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
    """
    Hesabdan çıx
    ---
    tags:
      - Authentication
    summary: Hesabdan çıx
    description: JWT tokenini revoke et və çıx
    security:
      - Bearer: []
    responses:
      200:
        description: Logout uğurlu
      401:
        description: Avtentifikasiya xətası
    """
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
    """
    Cari istifadəçi məlumatı al
    ---
    tags:
      - Authentication
    summary: Cari istifadəçi məlumatı
    description: Login olan istifadəçinin məlumatını qaytarır
    security:
      - Bearer: []
    responses:
      200:
        description: Istifadəçi məlumatı
        schema:
          type: object
          properties:
            ok:
              type: boolean
            user:
              type: object
            requires_totp_setup:
              type: boolean
      401:
        description: Avtentifikasiya xətası
    """
    return jsonify({
        'ok': True,
        'user': serialize_user(current_user),
        'requires_totp_setup': not current_user.totp_enabled,
    })


@auth_bp.post('/totp/setup')
@jwt_required()
def totp_setup():
    """
    2FA setup başla
    ---
    tags:
      - Two-Factor Authentication
    summary: 2FA (Google Authenticator) setup başla
    description: TOTP secret və recovery codes al
    security:
      - Bearer: []
    responses:
      200:
        description: TOTP setup məlumatı
        schema:
          type: object
          properties:
            ok:
              type: boolean
            otpauth_uri:
              type: string
              description: QR kod olaraq istifadə edilə bilinən URI
            qr_code:
              type: string
              description: Base64 encoded SVG QR kod
            recovery_codes:
              type: array
              items:
                type: string
      401:
        description: Avtentifikasiya xətası
    """
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
    """
    2FA setup-ı təsdiqləyin
    ---
    tags:
      - Two-Factor Authentication
    summary: 2FA setup-ı təsdiqləyin
    description: Google Authenticator-dan aldığınız 6 rəqəmli kodu göndərin
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - code
          properties:
            code:
              type: string
              example: "123456"
              description: 6 rəqəmli TOTP kodu
    responses:
      200:
        description: 2FA aktivləşdirildi
        schema:
          type: object
          properties:
            ok:
              type: boolean
            user:
              type: object
      400:
        description: Kod səhvdir
      401:
        description: Avtentifikasiya xətası
    """
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
    """
    Parol sıfırla
    ---
    tags:
      - Account Management
    summary: Parol sıfırla
    description: TOTP kodu və ya recovery code ilə parol sıfırla
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - username
            - verification_code
            - new_password
          properties:
            username:
              type: string
              example: john_doe
            verification_code:
              type: string
              example: "123456"
              description: 6 rəqəmli TOTP kodu ya da recovery code
            new_password:
              type: string
              example: NewSecurePass456!
    responses:
      200:
        description: Parol sıfırlandı
        schema:
          type: object
          properties:
            ok:
              type: boolean
            user:
              type: object
      400:
        description: Verification code səhvdir
    """
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
    """
    Parolunuzu dəyişin
    ---
    tags:
      - Account Management
    summary: Parolunuzu dəyişin
    description: Cari parol ilə yeni parol dəyişin
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - current_password
            - new_password
          properties:
            current_password:
              type: string
            new_password:
              type: string
    responses:
      200:
        description: Parol dəyişildi
      400:
        description: Cari parol səhvdir
      401:
        description: Avtentifikasiya xətası
    """
    payload = request.get_json(silent=True) or {}
    current_password = payload.get('current_password', '')
    new_password = validate_password(payload.get('new_password', ''))

    if not check_password(current_user.password_hash, current_password):
        return jsonify({'ok': False, 'error': 'Your current password is incorrect.'}), 400

    current_user.password_hash = hash_password(new_password)
    current_user.token_version += 1
    db.session.commit()
    return _issue_auth_response(current_user)
