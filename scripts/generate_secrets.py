from __future__ import annotations

import base64
import os
import secrets
from cryptography.fernet import Fernet


def token(length: int = 48) -> str:
    return secrets.token_urlsafe(length)


if __name__ == '__main__':
    print(f'SECRET_KEY={token(48)}')
    print(f'JWT_SECRET_KEY={token(48)}')
    print(f'TOTP_ENCRYPTION_KEY={Fernet.generate_key().decode()}')
    print(f'DATABASE_PASSWORD={base64.urlsafe_b64encode(os.urandom(24)).decode().rstrip("=")}')
    print(f'TURN_PASSWORD={base64.urlsafe_b64encode(os.urandom(18)).decode().rstrip("=")}')
