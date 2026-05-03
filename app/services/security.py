from __future__ import annotations

import base64
import io
import os
import re
import secrets
from datetime import datetime, timezone
from typing import Iterable

import pyotp
import qrcode
from cryptography.fernet import Fernet
from flask import current_app
from werkzeug.security import check_password_hash, generate_password_hash

USERNAME_RE = re.compile(r'^[a-z0-9._]+$')


def normalize_username(username: str) -> str:
    return username.strip().lower()


def validate_username(username: str) -> str:
    username = username.strip()
    if not username:
        raise ValueError('Username is required.')
    min_len = 3
    max_len = 31
    if not (min_len <= len(username) <= max_len):
        raise ValueError(f'Username must be between {min_len} and {max_len} characters.')
    if not USERNAME_RE.match(username):
        raise ValueError('Username can contain only lowercase letters, numbers, dots and underscores.')
    return username


def generate_secure_otp(length: int = 6) -> str:
    return ''.join(secrets.choice('0123456789') for _ in range(length))


def validate_password(password: str) -> str:
    if not password:
        raise ValueError('Password is required.')
    min_len = current_app.config['PASSWORD_MIN_LENGTH']
    if len(password) < min_len:
        raise ValueError(f'Password must be at least {min_len} characters long.')
    if not re.search(r'[A-Z]', password):
        raise ValueError('Password must include at least one uppercase letter.')
    if not re.search(r'[a-z]', password):
        raise ValueError('Password must include at least one lowercase letter.')
    if not re.search(r'\d', password):
        raise ValueError('Password must include at least one number.')
    return password


def hash_password(password: str) -> str:
    return generate_password_hash(password, method='scrypt')


def check_password(password_hash: str, password: str) -> bool:
    return check_password_hash(password_hash, password)


def _fernet() -> Fernet:
    key = current_app.config['TOTP_ENCRYPTION_KEY']
    if not key:
        raise RuntimeError('TOTP_ENCRYPTION_KEY is not configured.')
    if isinstance(key, str):
        key = key.encode('utf-8')
    return Fernet(key)


def encrypt_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode('utf-8')).decode('utf-8')


def decrypt_secret(secret_encrypted: str | None) -> str | None:
    if not secret_encrypted:
        return None
    return _fernet().decrypt(secret_encrypted.encode('utf-8')).decode('utf-8')


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def build_provisioning_uri(secret: str, username: str) -> str:
    return pyotp.TOTP(secret, issuer=current_app.config['TOTP_ISSUER']).provisioning_uri(
        name=username,
        issuer_name=current_app.config['TOTP_ISSUER'],
    )


def verify_totp(secret: str, code: str) -> bool:
    return pyotp.TOTP(secret).verify(code.strip(), valid_window=current_app.config['TOTP_VALID_WINDOW'])


def qr_code_data_uri(payload: str) -> str:
    image = qrcode.make(payload)
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    b64 = base64.b64encode(buffer.getvalue()).decode('ascii')
    return f'data:image/png;base64,{b64}'


def qr_code_png_bytes(payload: str) -> bytes:
    image = qrcode.make(payload)
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    return buffer.getvalue()


def generate_recovery_codes(count: int = 10) -> list[str]:
    codes: list[str] = []
    for _ in range(count):
        raw = base64.b32encode(os.urandom(5)).decode('ascii').rstrip('=')
        codes.append(f'{raw[:4]}-{raw[4:8]}')
    return codes


def hash_recovery_codes(codes: Iterable[str]) -> list[str]:
    return [generate_password_hash(code, method='scrypt') for code in codes]


def consume_recovery_code(stored_hashes: list[str], submitted_code: str) -> tuple[bool, list[str]]:
    cleaned = submitted_code.strip().upper()
    remaining: list[str] = []
    matched = False
    for stored_hash in stored_hashes:
        if not matched and check_password_hash(stored_hash, cleaned):
            matched = True
            continue
        remaining.append(stored_hash)
    return matched, remaining


def utc_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def canonical_user_pair(first: str, second: str) -> tuple[str, str]:
    return tuple(sorted((first, second)))


def random_token(length: int = 32) -> str:
    return secrets.token_urlsafe(length)[:length]
