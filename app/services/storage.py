from __future__ import annotations

import mimetypes
from pathlib import Path
from uuid import uuid4

from flask import current_app
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

ALLOWED_EXTENSIONS = {
    'png', 'jpg', 'jpeg', 'gif', 'webp',
    'mp4', 'webm', 'mov', 'mkv',
    'mp3', 'wav', 'ogg', 'm4a', 'opus',
    'pdf', 'txt', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'zip', 'rar', '7z'
}


PREFERRED_MIME_EXTENSIONS = {
    'image/jpeg': 'jpg',
    'audio/mp4': 'm4a',
    'audio/aac': 'm4a',
    'audio/webm': 'webm',
    'video/webm': 'webm',
}

VOICE_MESSAGE_TYPES = {'voice', 'voice_note'}


def extension_for(filename: str, content_type: str | None = None) -> str:
    name = secure_filename(filename)
    if '.' in name:
        return name.rsplit('.', 1)[1].lower()

    normalized_type = (content_type or '').split(';', 1)[0].strip().lower()
    if not normalized_type:
        return ''

    preferred = PREFERRED_MIME_EXTENSIONS.get(normalized_type)
    if preferred:
        return preferred

    guessed = mimetypes.guess_extension(normalized_type) or ''
    if not guessed:
        return ''
    return guessed.lstrip('.').lower()


def validate_upload(file: FileStorage) -> str:
    ext = extension_for(file.filename or '', file.mimetype)
    if not ext or ext not in ALLOWED_EXTENSIONS:
        raise ValueError('This file type is not allowed.')
    return ext


def classify_file(content_type: str, explicit_type: str | None = None) -> str:
    if explicit_type in VOICE_MESSAGE_TYPES:
        return 'voice'
    if content_type.startswith('image/'):
        return 'image'
    if content_type.startswith('video/'):
        return 'video'
    if content_type.startswith('audio/'):
        return 'audio'
    if content_type in {
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv',
        'application/zip',
        'application/x-rar-compressed',
        'application/x-7z-compressed',
    }:
        return 'document'
    return 'file'


def save_upload(file: FileStorage) -> tuple[str, str, int, str]:
    ext = validate_upload(file)
    upload_root = Path(current_app.config['UPLOAD_ROOT'])
    upload_root.mkdir(parents=True, exist_ok=True)

    storage_name = f'{uuid4()}.{ext}' if ext else str(uuid4())
    target = upload_root / storage_name
    file.save(target)
    size = target.stat().st_size
    return storage_name, str(target), size, file.mimetype or 'application/octet-stream'
