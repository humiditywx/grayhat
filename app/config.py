from __future__ import annotations

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env.production')
load_dotenv(BASE_DIR / '.env')


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}


def _split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(',') if item.strip()]


class Config:
    APP_NAME = os.getenv('APP_NAME', 'GrayHat')
    SECRET_KEY = os.getenv('SECRET_KEY', 'development-secret-key-change-this')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', SECRET_KEY)
    PUBLIC_BASE_URL = os.getenv('PUBLIC_BASE_URL', '')

    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', f'sqlite:///{BASE_DIR / "app.db"}')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', str(50 * 1024 * 1024)))
    UPLOAD_ROOT = Path(os.getenv('UPLOAD_ROOT', str(BASE_DIR / 'uploads')))

    JWT_TOKEN_LOCATION = ['headers', 'cookies']
    JWT_ACCESS_COOKIE_NAME = 'messenger_access'
    JWT_ACCESS_COOKIE_PATH = '/'
    JWT_COOKIE_SECURE = _as_bool(os.getenv('JWT_COOKIE_SECURE'), default=False)
    JWT_COOKIE_SAMESITE = os.getenv('JWT_COOKIE_SAMESITE', 'Lax')
    JWT_COOKIE_CSRF_PROTECT = _as_bool(os.getenv('JWT_COOKIE_CSRF_PROTECT'), default=True)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.getenv('JWT_ACCESS_TOKEN_HOURS', '8')))
    JWT_SESSION_COOKIE = False

    ACCESS_RENEWAL_THRESHOLD_MINUTES = int(os.getenv('ACCESS_RENEWAL_THRESHOLD_MINUTES', '30'))
    PASSWORD_MIN_LENGTH = int(os.getenv('PASSWORD_MIN_LENGTH', '10'))
    MESSAGE_MAX_LENGTH = int(os.getenv('MESSAGE_MAX_LENGTH', '4000'))
    USERNAME_MIN_LENGTH = int(os.getenv('USERNAME_MIN_LENGTH', '3'))
    USERNAME_MAX_LENGTH = int(os.getenv('USERNAME_MAX_LENGTH', '31'))

    SMTP_HOST = os.getenv('SMTP_HOST', 'mail.grayhat.com.az')
    SMTP_PORT = int(os.getenv('SMTP_PORT', '465'))
    SMTP_USER = os.getenv('SMTP_USER', 'otp@grayhat.com.az')
    SMTP_PASS = os.getenv('SMTP_PASS', '')
    MAIL_FROM = os.getenv('MAIL_FROM', SMTP_USER)

    TOTP_ISSUER = os.getenv('TOTP_ISSUER', 'GrayHat')
    TOTP_ENCRYPTION_KEY = os.getenv('TOTP_ENCRYPTION_KEY', '')
    TOTP_VALID_WINDOW = int(os.getenv('TOTP_VALID_WINDOW', '1'))

    RATE_LIMIT_STORAGE_URI = os.getenv('RATE_LIMIT_STORAGE_URI', 'memory://')

    SOCKETIO_MESSAGE_QUEUE = os.getenv('SOCKETIO_MESSAGE_QUEUE', '')

    STUN_URLS = _split_csv(os.getenv('STUN_URLS', 'stun:stun.l.google.com:19302'))
    TURN_URLS = _split_csv(os.getenv('TURN_URLS', ''))
    TURN_USERNAME = os.getenv('TURN_USERNAME', '')
    TURN_CREDENTIAL = os.getenv('TURN_CREDENTIAL', '')

    SCAN_IMAGE_MAX_MB = int(os.getenv('SCAN_IMAGE_MAX_MB', '10'))
    DEBUG = _as_bool(os.getenv('FLASK_DEBUG'), default=False)
    TESTING = False


class TestConfig(Config):
    TESTING = True
    JWT_COOKIE_SECURE = False
    TOTP_ENCRYPTION_KEY = 'gVJX4d2D9G12fdfMyRjN1w8NAnD-oW1f_3y2pqqfWkw='
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
