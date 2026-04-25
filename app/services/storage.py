from __future__ import annotations

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


def extension_for(filename: str) -> str:
    name = secure_filename(filename)
    if '.' not in name:
        return ''
    return name.rsplit('.', 1)[1].lower()


def validate_upload(file: FileStorage) -> None:
    ext = extension_for(file.filename or '')
    if not ext or ext not in ALLOWED_EXTENSIONS:
        raise ValueError('This file type is not allowed.')


def classify_file(content_type: str, explicit_type: str | None = None) -> str:
    if explicit_type == 'voice':
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
    validate_upload(file)
    upload_root = Path(current_app.config['UPLOAD_ROOT'])
    upload_root.mkdir(parents=True, exist_ok=True)

    ext = extension_for(file.filename or '')
    storage_name = f'{uuid4()}.{ext}' if ext else str(uuid4())
    target = upload_root / storage_name
    file.save(target)
    size = target.stat().st_size
    return storage_name, str(target), size, file.mimetype or 'application/octet-stream'
