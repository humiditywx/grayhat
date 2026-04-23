from __future__ import annotations

import io
import re
from datetime import datetime
from uuid import UUID

from flask import Blueprint, abort, jsonify, request, send_file
from flask_jwt_extended import current_user, jwt_required
from PIL import Image, UnidentifiedImageError
from pyzbar.pyzbar import decode as decode_qr
from sqlalchemy import or_
from sqlalchemy.orm import selectinload

from ..extensions import db, limiter, socketio
from ..models import Attachment, Conversation, ConversationParticipant, Friendship, Message, PrivateConversationIndex, Story, User
from ..models import utcnow as utcnow_dt
from ..services.chat import (
    add_friend,
    create_group,
    get_conversation_for_user_or_404,
    get_or_create_private_conversation,
    join_public_group,
    mark_read,
    touch_conversation,
)
from ..services.security import qr_code_png_bytes, random_token, utc_iso
from ..services.serializers import public_base_url, serialize_conversation, serialize_friend, serialize_message, serialize_story, serialize_user
from ..services.storage import classify_file, save_upload

api_bp = Blueprint('api', __name__, url_prefix='/api')
UUID_PATTERN = re.compile(r'[0-9a-fA-F-]{36}')


def _ice_servers() -> list[dict]:
    servers: list[dict] = []
    from flask import current_app

    if current_app.config['STUN_URLS']:
        servers.append({'urls': current_app.config['STUN_URLS']})
    if current_app.config['TURN_URLS'] and current_app.config['TURN_USERNAME'] and current_app.config['TURN_CREDENTIAL']:
        servers.append({
            'urls': current_app.config['TURN_URLS'],
            'username': current_app.config['TURN_USERNAME'],
            'credential': current_app.config['TURN_CREDENTIAL'],
        })
    return servers


def _extract_uuid(value: str) -> str | None:
    value = (value or '').strip()
    if not value:
        return None
    if value.startswith('http://') or value.startswith('https://'):
        match = re.search(r'/add/([0-9a-fA-F-]{36})', value)
        if match:
            value = match.group(1)
    elif value.lower().startswith('expressmessenger:add:'):
        value = value.split(':')[-1]

    if not UUID_PATTERN.fullmatch(value):
        return None
    try:
        return str(UUID(value))
    except ValueError:
        return None


def _emit_conversation_update(conversation: Conversation, event_name: str, payload: dict) -> None:
    room = f'conversation:{conversation.id}'
    socketio.emit(event_name, payload, to=room)
    for participant in conversation.participants:
        socketio.emit('conversation:updated', {'conversation_id': conversation.id}, to=f'user:{participant.user_id}')


@api_bp.get('/bootstrap')
@jwt_required()
def bootstrap():
    friendships = Friendship.query.filter(or_(Friendship.user_a_id == current_user.id, Friendship.user_b_id == current_user.id)).all()
    friend_ids = [item.user_b_id if item.user_a_id == current_user.id else item.user_a_id for item in friendships]
    friends = User.query.filter(User.id.in_(friend_ids)).all() if friend_ids else []

    private_indices = PrivateConversationIndex.query.filter(
        or_(PrivateConversationIndex.user_a_id == current_user.id, PrivateConversationIndex.user_b_id == current_user.id)
    ).all()
    private_map: dict[tuple[str, str], str] = {}
    for index in private_indices:
        pair = tuple(sorted((index.user_a_id, index.user_b_id)))
        private_map[pair] = index.conversation_id

    friend_payload = []
    for friend in sorted(friends, key=lambda item: item.username.lower()):
        pair = tuple(sorted((current_user.id, friend.id)))
        friend_payload.append(serialize_friend(friend, private_map.get(pair)))

    conversations = (
        Conversation.query.join(ConversationParticipant)
        .filter(ConversationParticipant.user_id == current_user.id)
        .options(
            selectinload(Conversation.participants).selectinload(ConversationParticipant.user),
            selectinload(Conversation.messages),
            selectinload(Conversation.private_index),
        )
        .order_by(Conversation.last_message_at.desc().nullslast(), Conversation.created_at.desc())
        .all()
    )

    # ── Stories ──────────────────────────────────────────────────────────────
    from datetime import timezone as tz
    from collections import defaultdict as dd
    from sqlalchemy.orm import selectinload as si

    now = datetime.now(tz.utc)
    visible_ids = [current_user.id] + friend_ids
    stories = (
        Story.query
        .filter(Story.user_id.in_(visible_ids), Story.expires_at > now)
        .options(si(Story.user))
        .order_by(Story.created_at.asc())
        .all()
    )
    grouped = dd(list)
    user_map: dict = {}  # user_id -> User ORM object for avatar lookup
    for s in stories:
        grouped[s.user_id].append(serialize_story(s))
        if s.user and s.user_id not in user_map:
            user_map[s.user_id] = s.user

    def _avatar_url(uid: str) -> str | None:
        u = user_map.get(uid)
        return f'/api/users/{uid}/avatar' if (u and u.avatar_storage_name) else None

    story_groups = []
    if current_user.id in grouped:
        story_groups.append({
            'user_id': current_user.id,
            'username': current_user.username,
            'avatar_url': f'/api/users/{current_user.id}/avatar' if current_user.avatar_storage_name else None,
            'stories': grouped[current_user.id],
        })
    for uid in friend_ids:
        if uid in grouped:
            story_groups.append({
                'user_id': uid,
                'username': grouped[uid][0]['username'],
                'avatar_url': _avatar_url(uid),
                'stories': grouped[uid],
            })
    # Always include self entry so the user can always post a story
    if not any(g['user_id'] == current_user.id for g in story_groups):
        story_groups.insert(0, {
            'user_id': current_user.id,
            'username': current_user.username,
            'avatar_url': f'/api/users/{current_user.id}/avatar' if current_user.avatar_storage_name else None,
            'stories': [],
        })

    return jsonify({
        'ok': True,
        'user': serialize_user(current_user),
        'friends': friend_payload,
        'conversations': [serialize_conversation(item, current_user.id) for item in conversations],
        'ice_servers': _ice_servers(),
        'my_uuid': current_user.id,
        'my_add_link': f'{public_base_url()}/add/{current_user.id}',
        'story_groups': story_groups,
    })


@api_bp.get('/users/me/qr.png')
@jwt_required()
def my_qr_png():
    payload = f'{public_base_url()}/add/{current_user.id}'
    png = qr_code_png_bytes(payload)
    return send_file(io.BytesIO(png), mimetype='image/png', download_name='my-uuid.png')


@api_bp.get('/friends')
@jwt_required()
def list_friends():
    friendships = Friendship.query.filter(or_(Friendship.user_a_id == current_user.id, Friendship.user_b_id == current_user.id)).all()
    ids = [item.user_b_id if item.user_a_id == current_user.id else item.user_a_id for item in friendships]
    users = User.query.filter(User.id.in_(ids)).all() if ids else []
    return jsonify({'ok': True, 'friends': [serialize_friend(item) for item in users]})


@api_bp.delete('/friends/<friend_id>')
@jwt_required()
def remove_friend(friend_id: str):
    from sqlalchemy import and_
    friendship = Friendship.query.filter(
        or_(
            and_(Friendship.user_a_id == current_user.id, Friendship.user_b_id == friend_id),
            and_(Friendship.user_a_id == friend_id, Friendship.user_b_id == current_user.id),
        )
    ).first()
    if not friendship:
        return jsonify({'ok': False, 'error': 'Friendship not found.'}), 404
    db.session.delete(friendship)
    db.session.commit()
    socketio.emit('friend:removed', {'friend_id': friend_id}, to=f'user:{current_user.id}')
    socketio.emit('friend:removed', {'friend_id': current_user.id}, to=f'user:{friend_id}')
    return jsonify({'ok': True})

@api_bp.post('/friends')
@jwt_required()
def create_friendship():
    payload = request.get_json(silent=True) or {}
    target_id = _extract_uuid(str(payload.get('uuid', '')))
    if not target_id:
        return jsonify({'ok': False, 'error': 'Enter a valid UUID or QR code URL.'}), 400

    target = db.session.get(User, target_id)
    if not target:
        return jsonify({'ok': False, 'error': 'That user does not exist.'}), 404

    try:
        _, conversation = add_friend(current_user, target)
        db.session.commit()
    except ValueError as exc:
        return jsonify({'ok': False, 'error': str(exc)}), 400

    payload = {
        'friend': serialize_friend(target, conversation.id),
        'conversation_id': conversation.id,
        'initiator_user_id': current_user.id,
    }
    socketio.emit('friend:added', payload, to=f'user:{current_user.id}')
    socketio.emit(
        'friend:added',
        {
            'friend': serialize_friend(current_user, conversation.id),
            'conversation_id': conversation.id,
            'initiator_user_id': current_user.id,
        },
        to=f'user:{target.id}',
    )
    return jsonify({'ok': True, **payload})


@api_bp.post('/friends/scan-image')
@jwt_required()
def scan_friend_image():
    file = request.files.get('file')
    if file is None:
        return jsonify({'ok': False, 'error': 'Upload a QR code image first.'}), 400

    try:
        image = Image.open(file.stream)
        decoded = decode_qr(image)
    except (UnidentifiedImageError, OSError):
        return jsonify({'ok': False, 'error': 'The uploaded file is not a readable image.'}), 400

    if not decoded:
        return jsonify({'ok': False, 'error': 'No QR code was found in that image.'}), 400

    raw_value = decoded[0].data.decode('utf-8', errors='ignore')
    target_id = _extract_uuid(raw_value)
    if not target_id:
        return jsonify({'ok': False, 'error': 'The QR code does not contain a valid add-friend payload.'}), 400

    target = db.session.get(User, target_id)
    if not target:
        return jsonify({'ok': False, 'error': 'That user does not exist.'}), 404

    try:
        _, conversation = add_friend(current_user, target)
        db.session.commit()
    except ValueError as exc:
        return jsonify({'ok': False, 'error': str(exc)}), 400

    payload = {
        'friend': serialize_friend(target, conversation.id),
        'conversation_id': conversation.id,
        'initiator_user_id': current_user.id,
    }
    socketio.emit('friend:added', payload, to=f'user:{current_user.id}')
    socketio.emit(
        'friend:added',
        {
            'friend': serialize_friend(current_user, conversation.id),
            'conversation_id': conversation.id,
            'initiator_user_id': current_user.id,
        },
        to=f'user:{target.id}',
    )
    return jsonify({'ok': True, **payload})


@api_bp.post('/conversations/private/<friend_id>')
@jwt_required()
def private_conversation(friend_id: str):
    friend = db.session.get(User, friend_id)
    if not friend:
        return jsonify({'ok': False, 'error': 'User not found.'}), 404
    try:
        _, conversation = add_friend(current_user, friend)
        db.session.commit()
    except ValueError as exc:
        return jsonify({'ok': False, 'error': str(exc)}), 400
    conversation = get_conversation_for_user_or_404(current_user.id, conversation.id)
    conversation = db.session.get(
        Conversation,
        conversation.id,
        options=[
            selectinload(Conversation.participants).selectinload(ConversationParticipant.user),
            selectinload(Conversation.messages),
        ],
    )
    return jsonify({'ok': True, 'conversation': serialize_conversation(conversation, current_user.id)})


@api_bp.get('/conversations')
@jwt_required()
def list_conversations():
    conversations = (
        Conversation.query.join(ConversationParticipant)
        .filter(ConversationParticipant.user_id == current_user.id)
        .options(selectinload(Conversation.participants).selectinload(ConversationParticipant.user), selectinload(Conversation.messages))
        .order_by(Conversation.last_message_at.desc().nullslast(), Conversation.created_at.desc())
        .all()
    )
    return jsonify({'ok': True, 'conversations': [serialize_conversation(item, current_user.id) for item in conversations]})


@api_bp.get('/conversations/<conversation_id>/messages')
@jwt_required()
def list_messages(conversation_id: str):
    conversation = get_conversation_for_user_or_404(current_user.id, conversation_id)
    before = request.args.get('before')
    limit = min(int(request.args.get('limit', '50')), 100)

    query = Message.query.filter_by(conversation_id=conversation.id).options(selectinload(Message.attachments), selectinload(Message.sender)).order_by(Message.created_at.desc())
    if before:
        from datetime import datetime

        try:
            cutoff = datetime.fromisoformat(before)
            query = query.filter(Message.created_at < cutoff)
        except ValueError:
            pass

    messages = list(reversed(query.limit(limit).all()))
    return jsonify({'ok': True, 'messages': [serialize_message(item) for item in messages]})


@api_bp.post('/conversations/<conversation_id>/messages')
@jwt_required()
def create_message(conversation_id: str):
    conversation = get_conversation_for_user_or_404(current_user.id, conversation_id)
    payload = request.get_json(silent=True) or {}
    body = (payload.get('body') or '').strip()
    if not body:
        return jsonify({'ok': False, 'error': 'Message text cannot be empty.'}), 400

    from flask import current_app

    if len(body) > current_app.config['MESSAGE_MAX_LENGTH']:
        return jsonify({'ok': False, 'error': 'Message is too long.'}), 400

    message = Message(conversation_id=conversation.id, sender_id=current_user.id, message_type='text', body=body)
    db.session.add(message)
    touch_conversation(conversation)
    db.session.commit()

    message = db.session.get(
        Message,
        message.id,
        options=[selectinload(Message.attachments), selectinload(Message.sender)],
    )
    payload = {'message': serialize_message(message)}
    _emit_conversation_update(conversation, 'message:new', payload)
    return jsonify({'ok': True, **payload}), 201


@api_bp.patch('/messages/<message_id>')
@jwt_required()
def edit_message(message_id: str):
    payload = request.get_json(silent=True) or {}
    body = (payload.get('body') or '').strip()
    if not body:
        return jsonify({'ok': False, 'error': 'Message text cannot be empty.'}), 400

    message = db.session.get(
        Message,
        message_id,
        options=[
            selectinload(Message.attachments),
            selectinload(Message.sender),
            selectinload(Message.conversation).selectinload(Conversation.participants),
        ],
    )
    if not message:
        return jsonify({'ok': False, 'error': 'Message not found.'}), 404

    conversation = get_conversation_for_user_or_404(current_user.id, message.conversation_id)
    if message.sender_id != current_user.id or message.message_type != 'text':
        return jsonify({'ok': False, 'error': 'Only your own text messages can be edited.'}), 403

    message.body = body
    from ..models import utcnow

    message.edited_at = utcnow()
    db.session.commit()
    serialized = serialize_message(message)
    _emit_conversation_update(conversation, 'message:updated', {'message': serialized})
    return jsonify({'ok': True, 'message': serialized})


@api_bp.post('/conversations/<conversation_id>/attachments')
@jwt_required()
def upload_attachment(conversation_id: str):
    conversation = get_conversation_for_user_or_404(current_user.id, conversation_id)
    file = request.files.get('file')
    if file is None:
        return jsonify({'ok': False, 'error': 'Choose a file to upload.'}), 400

    explicit_type = (request.form.get('message_type') or '').strip() or None
    body = (request.form.get('body') or '').strip() or None

    try:
        storage_name, storage_path, size_bytes, content_type = save_upload(file)
    except ValueError as exc:
        return jsonify({'ok': False, 'error': str(exc)}), 400

    kind = classify_file(content_type, explicit_type=explicit_type)
    message_type = 'voice' if explicit_type == 'voice' else kind
    message = Message(conversation_id=conversation.id, sender_id=current_user.id, message_type=message_type, body=body)
    db.session.add(message)
    db.session.flush()

    attachment = Attachment(
        message_id=message.id,
        original_name=file.filename or storage_name,
        storage_name=storage_name,
        storage_path=storage_path,
        content_type=content_type,
        kind=kind,
        size_bytes=size_bytes,
    )
    db.session.add(attachment)
    touch_conversation(conversation)
    db.session.commit()

    message = db.session.get(
        Message,
        message.id,
        options=[
            selectinload(Message.attachments),
            selectinload(Message.sender),
            selectinload(Message.conversation).selectinload(Conversation.participants),
        ],
    )
    payload = {'message': serialize_message(message)}
    _emit_conversation_update(conversation, 'message:new', payload)
    return jsonify({'ok': True, **payload}), 201


@api_bp.get('/attachments/<attachment_id>')
@jwt_required()
def download_attachment(attachment_id: str):
    attachment = db.session.get(Attachment, attachment_id)
    if not attachment:
        abort(404, description='Attachment not found.')

    conversation = get_conversation_for_user_or_404(current_user.id, attachment.message.conversation_id)
    del conversation
    as_download = request.args.get('download') == '1'
    return send_file(
        attachment.storage_path,
        mimetype=attachment.content_type,
        as_attachment=as_download,
        download_name=attachment.original_name,
        conditional=True,
    )


@api_bp.post('/conversations/<conversation_id>/members')
@jwt_required()
def add_group_member(conversation_id: str):
    conversation = get_conversation_for_user_or_404(current_user.id, conversation_id)
    if conversation.kind != 'group':
        return jsonify({'ok': False, 'error': 'This is not a group conversation.'}), 400
    payload = request.get_json(silent=True) or {}
    user_id = (payload.get('user_id') or '').strip()
    if not user_id:
        return jsonify({'ok': False, 'error': 'user_id is required.'}), 400
    target_user = db.session.get(User, user_id)
    if not target_user:
        return jsonify({'ok': False, 'error': 'User not found.'}), 404
    existing = ConversationParticipant.query.filter_by(conversation_id=conversation_id, user_id=user_id).first()
    if existing:
        return jsonify({'ok': False, 'error': 'User is already in this group.'}), 400
    participant = ConversationParticipant(conversation_id=conversation_id, user_id=user_id, role='member')
    db.session.add(participant)
    db.session.commit()
    conversation = db.session.get(
        Conversation,
        conversation_id,
        options=[
            selectinload(Conversation.participants).selectinload(ConversationParticipant.user),
            selectinload(Conversation.messages),
        ],
    )
    serialized = serialize_conversation(conversation, current_user.id)
    for p in conversation.participants:
        socketio.emit('conversation:updated', {'conversation_id': conversation_id}, to=f'user:{p.user_id}')
    return jsonify({'ok': True, 'conversation': serialized})


@api_bp.post('/conversations/groups')
@jwt_required()
def create_group_route():    
    payload = request.get_json(silent=True) or {}
    title = (payload.get('title') or '').strip()
    description = (payload.get('description') or '').strip() or None

    try:
        conversation = create_group(current_user, title, description)
        db.session.commit()
    except ValueError as exc:
        return jsonify({'ok': False, 'error': str(exc)}), 400

    conversation = db.session.get(
        Conversation,
        conversation.id,
        options=[
            selectinload(Conversation.participants).selectinload(ConversationParticipant.user),
            selectinload(Conversation.messages),
        ],
    )
    serialized = serialize_conversation(conversation, current_user.id)
    socketio.emit('conversation:updated', {'conversation': serialized}, to=f'user:{current_user.id}')
    return jsonify({'ok': True, 'conversation': serialized}), 201


@api_bp.get('/groups/<share_token>/public')
def public_group_metadata(share_token: str):
    conversation = Conversation.query.options(selectinload(Conversation.participants)).filter_by(public_share_token=share_token, kind='group', is_public=True).first()
    if not conversation:
        return jsonify({'ok': False, 'error': 'Group not found.'}), 404
    return jsonify({
        'ok': True,
        'group': {
            'title': conversation.title,
            'description': conversation.description,
            'member_count': len(conversation.participants),
            'share_url': f'{public_base_url()}/g/{share_token}',
        },
    })


@api_bp.post('/groups/join/<share_token>')
@jwt_required()
def join_group_route(share_token: str):
    conversation = join_public_group(current_user, share_token)
    db.session.commit()

    conversation = db.session.get(
        Conversation,
        conversation.id,
        options=[
            selectinload(Conversation.participants).selectinload(ConversationParticipant.user),
            selectinload(Conversation.messages),
        ],
    )
    serialized = serialize_conversation(conversation, current_user.id)
    for participant in conversation.participants:
        socketio.emit('conversation:updated', {'conversation': serialized}, to=f'user:{participant.user_id}')
    return jsonify({'ok': True, 'conversation': serialized})


@api_bp.post('/conversations/<conversation_id>/read')
@jwt_required()
def mark_conversation_read(conversation_id: str):
    conversation = get_conversation_for_user_or_404(current_user.id, conversation_id)
    mark_read(current_user.id, conversation.id)
    db.session.commit()
    read_at = next((p.last_read_at for p in conversation.participants if p.user_id == current_user.id), None)
    # Notify other participants that this user has read
    socketio.emit('conversation:read', {
        'conversation_id': conversation.id,
        'user_id': current_user.id,
        'read_at': utc_iso(read_at),
    }, to=f'conversation:{conversation.id}')
    return jsonify({'ok': True, 'read_at': utc_iso(read_at)})


# ─── Group icon endpoints ─────────────────────────────────────────────────────

@api_bp.post('/conversations/<conversation_id>/icon')
@jwt_required()
def upload_group_icon(conversation_id: str):
    conversation = get_conversation_for_user_or_404(current_user.id, conversation_id)
    if conversation.kind != 'group':
        return jsonify({'ok': False, 'error': 'Not a group conversation.'}), 400
    file = request.files.get('file')
    if not file:
        return jsonify({'ok': False, 'error': 'No file provided.'}), 400
    try:
        storage_name, storage_path, size_bytes, content_type = save_upload(file)
    except ValueError as exc:
        return jsonify({'ok': False, 'error': str(exc)}), 400
    if not content_type.startswith('image/'):
        return jsonify({'ok': False, 'error': 'Only image files are allowed.'}), 400
    # Remove old icon
    if conversation.icon_storage_name:
        import pathlib
        from flask import current_app as _a
        try:
            pathlib.Path(_a.config['UPLOAD_ROOT'] / conversation.icon_storage_name).unlink(missing_ok=True)
        except Exception:
            pass
    conversation.icon_storage_name = storage_name
    db.session.commit()
    icon_url = f'/api/conversations/{conversation_id}/icon'
    for p in conversation.participants:
        socketio.emit('conversation:updated', {'conversation_id': conversation_id}, to=f'user:{p.user_id}')
    return jsonify({'ok': True, 'icon_url': icon_url})


@api_bp.get('/conversations/<conversation_id>/icon')
@jwt_required()
def get_group_icon(conversation_id: str):
    conversation = get_conversation_for_user_or_404(current_user.id, conversation_id)
    if not getattr(conversation, 'icon_storage_name', None):
        abort(404, description='No icon.')
    from flask import current_app as _a
    import pathlib, mimetypes
    storage_path = pathlib.Path(_a.config['UPLOAD_ROOT'] / conversation.icon_storage_name)
    if not storage_path.exists():
        abort(404, description='Icon file not found.')
    content_type = mimetypes.guess_type(str(storage_path))[0] or 'image/jpeg'
    return send_file(str(storage_path), mimetype=content_type, conditional=True)


@api_bp.get('/conversations/<conversation_id>/members')
@jwt_required()
def get_group_members(conversation_id: str):
    conversation = get_conversation_for_user_or_404(current_user.id, conversation_id)
    if conversation.kind != 'group':
        return jsonify({'ok': False, 'error': 'Not a group conversation.'}), 400
    members = []
    for p in conversation.participants:
        user_data = serialize_user(p.user)
        user_data['role'] = p.role
        members.append(user_data)
    return jsonify({'ok': True, 'members': members})

@api_bp.post('/users/me/avatar')
@jwt_required()
def upload_avatar():
    file = request.files.get('file')
    if file is None:
        return jsonify({'ok': False, 'error': 'No file provided.'}), 400
    try:
        storage_name, storage_path, size_bytes, content_type = save_upload(file)
    except ValueError as exc:
        return jsonify({'ok': False, 'error': str(exc)}), 400
    if not content_type.startswith('image/'):
        return jsonify({'ok': False, 'error': 'Only image files are allowed for avatars.'}), 400
    # Delete old avatar file if it exists
    if current_user.avatar_storage_name:
        import pathlib
        from flask import current_app
        old_path = current_app.config['UPLOAD_ROOT'] / current_user.avatar_storage_name
        try:
            pathlib.Path(old_path).unlink(missing_ok=True)
        except Exception:
            pass
    current_user.avatar_storage_name = storage_name
    db.session.commit()
    avatar_url = f'/api/users/{current_user.id}/avatar'
    # Notify all users who have this user as a friend to refresh
    socketio.emit('user:avatar_updated', {'user_id': current_user.id, 'avatar_url': avatar_url}, to=f'user:{current_user.id}')
    return jsonify({'ok': True, 'avatar_url': avatar_url})


@api_bp.get('/users/<user_id>/avatar')
@jwt_required()
def get_user_avatar(user_id: str):
    user = db.session.get(User, user_id)
    if not user or not user.avatar_storage_name:
        abort(404, description='No avatar.')
    from flask import current_app
    import pathlib
    storage_path = current_app.config['UPLOAD_ROOT'] / user.avatar_storage_name
    if not pathlib.Path(storage_path).exists():
        abort(404, description='Avatar file not found.')
    import mimetypes
    content_type = mimetypes.guess_type(str(storage_path))[0] or 'image/jpeg'
    return send_file(str(storage_path), mimetype=content_type, conditional=True)


# ─── Delete message ──────────────────────────────────────────────────────────

@api_bp.delete('/messages/<message_id>')
@jwt_required()
def delete_message(message_id: str):
    from sqlalchemy.orm import selectinload as _sel
    message = db.session.get(
        Message,
        message_id,
        options=[
            _sel(Message.attachments),
            _sel(Message.sender),
            _sel(Message.conversation).selectinload(Conversation.participants),
        ],
    )
    if not message:
        return jsonify({'ok': False, 'error': 'Message not found.'}), 404
    conversation = get_conversation_for_user_or_404(current_user.id, message.conversation_id)
    if message.sender_id != current_user.id:
        # Allow group owners/admins to delete any message
        participant = next((p for p in conversation.participants if p.user_id == current_user.id), None)
        if not participant or participant.role not in ('owner', 'admin'):
            return jsonify({'ok': False, 'error': 'You can only delete your own messages.'}), 403
    from ..models import utcnow as _utcnow
    message.deleted_at = _utcnow()
    message.body = None
    db.session.commit()
    from ..services.serializers import serialize_message
    serialized = serialize_message(message)
    _emit_conversation_update(conversation, 'message:deleted', {'message': serialized})
    return jsonify({'ok': True, 'message': serialized})


@api_bp.post('/messages/<message_id>/react')
@jwt_required()
def react_message(message_id: str):
    payload = request.get_json(silent=True) or {}
    emoji = payload.get('emoji', '❤️')
    if emoji != '❤️':
        return jsonify({'ok': False, 'error': 'Only ❤️ reactions are supported.'}), 400

    message = db.session.get(
        Message,
        message_id,
        options=[
            selectinload(Message.attachments),
            selectinload(Message.sender),
            selectinload(Message.conversation).selectinload(Conversation.participants),
        ],
    )
    if not message:
        return jsonify({'ok': False, 'error': 'Message not found.'}), 404

    conversation = get_conversation_for_user_or_404(current_user.id, message.conversation_id)
    if message.deleted_at:
        return jsonify({'ok': False, 'error': 'Cannot react to a deleted message.'}), 400

    from sqlalchemy.orm.attributes import flag_modified
    extra = dict(message.extra or {})
    hearts = list(extra.get('hearts', []))
    if current_user.id in hearts:
        hearts.remove(current_user.id)
    else:
        hearts.append(current_user.id)
    extra['hearts'] = hearts
    message.extra = extra
    flag_modified(message, 'extra')
    db.session.commit()

    serialized = serialize_message(message)
    _emit_conversation_update(conversation, 'message:reaction', {'message': serialized})
    return jsonify({'ok': True, 'message': serialized})


# ─── Leave / delete conversation ─────────────────────────────────────────────

@api_bp.delete('/conversations/<conversation_id>/membership')
@jwt_required()
def leave_conversation(conversation_id: str):
    from sqlalchemy.orm import selectinload as _sel
    conversation = db.session.get(
        Conversation,
        conversation_id,
        options=[_sel(Conversation.participants), _sel(Conversation.private_index)],
    )
    if not conversation:
        return jsonify({'ok': False, 'error': 'Conversation not found.'}), 404
    participant = ConversationParticipant.query.filter_by(
        conversation_id=conversation_id, user_id=current_user.id
    ).first()
    if not participant:
        return jsonify({'ok': False, 'error': 'You are not in this conversation.'}), 404

    if conversation.kind == 'private':
        # Delete entire private conversation (messages, participants, index)
        db.session.delete(conversation)
        db.session.commit()
        socketio.emit('conversation:deleted', {'conversation_id': conversation_id}, to=f'user:{current_user.id}')
        # Also notify the other participant
        for p in conversation.participants:
            if p.user_id != current_user.id:
                socketio.emit('conversation:deleted', {'conversation_id': conversation_id}, to=f'user:{p.user_id}')
        return jsonify({'ok': True})

    # Group: remove participant
    remaining = [p for p in conversation.participants if p.user_id != current_user.id]
    if not remaining:
        # Last member — delete the whole group
        db.session.delete(conversation)
        db.session.commit()
        socketio.emit('conversation:deleted', {'conversation_id': conversation_id}, to=f'user:{current_user.id}')
        return jsonify({'ok': True})

    # If leaving member was the owner, promote someone else
    if participant.role == 'owner' and remaining:
        remaining[0].role = 'owner'

    db.session.delete(participant)
    db.session.commit()

    socketio.emit('conversation:deleted', {'conversation_id': conversation_id}, to=f'user:{current_user.id}')
    for p in remaining:
        socketio.emit('conversation:updated', {'conversation_id': conversation_id}, to=f'user:{p.user_id}')
    return jsonify({'ok': True})


# ─── Stories ─────────────────────────────────────────────────────────────────

@api_bp.post('/stories')
@jwt_required()
def create_story():
    file = request.files.get('file')
    if file is None:
        return jsonify({'ok': False, 'error': 'No file provided.'}), 400

    try:
        storage_name, storage_path, size_bytes, content_type = save_upload(file)
    except ValueError as exc:
        return jsonify({'ok': False, 'error': str(exc)}), 400

    media_type = 'video' if content_type.startswith('video/') else 'image'
    caption = (request.form.get('caption') or '').strip() or None

    from datetime import timedelta
    expires_at = utcnow_dt() + timedelta(hours=24)

    story = Story(
        user_id=current_user.id,
        media_type=media_type,
        storage_name=storage_name,
        storage_path=storage_path,
        content_type=content_type,
        caption=caption,
        expires_at=expires_at,
    )
    db.session.add(story)
    db.session.commit()

    from sqlalchemy.orm import selectinload as si
    story = db.session.get(Story, story.id, options=[si(Story.user)])
    serialized = serialize_story(story)
    socketio.emit('story:new', {'story': serialized}, to=f'user:{current_user.id}')
    # Notify friends
    friendships = Friendship.query.filter(
        or_(Friendship.user_a_id == current_user.id, Friendship.user_b_id == current_user.id)
    ).all()
    for fs in friendships:
        fid = fs.user_b_id if fs.user_a_id == current_user.id else fs.user_a_id
        socketio.emit('story:new', {'story': serialized}, to=f'user:{fid}')

    return jsonify({'ok': True, 'story': serialized}), 201


@api_bp.get('/stories')
@jwt_required()
def list_stories():
    from datetime import timezone as tz
    from sqlalchemy.orm import selectinload as si
    from collections import defaultdict as dd

    now = datetime.now(tz.utc)

    friendships = Friendship.query.filter(
        or_(Friendship.user_a_id == current_user.id, Friendship.user_b_id == current_user.id)
    ).all()
    friend_ids = [fs.user_b_id if fs.user_a_id == current_user.id else fs.user_a_id for fs in friendships]
    visible_ids = [current_user.id] + friend_ids

    stories = (
        Story.query
        .filter(Story.user_id.in_(visible_ids), Story.expires_at > now)
        .options(si(Story.user))
        .order_by(Story.created_at.asc())
        .all()
    )

    grouped = dd(list)
    user_map2: dict = {}
    for s in stories:
        grouped[s.user_id].append(serialize_story(s))
        if s.user and s.user_id not in user_map2:
            user_map2[s.user_id] = s.user

    def _av(uid: str) -> str | None:
        u = user_map2.get(uid)
        return f'/api/users/{uid}/avatar' if (u and u.avatar_storage_name) else None

    result = []
    if current_user.id in grouped:
        result.append({
            'user_id': current_user.id,
            'username': current_user.username,
            'avatar_url': f'/api/users/{current_user.id}/avatar' if current_user.avatar_storage_name else None,
            'stories': grouped[current_user.id],
        })
    for uid in friend_ids:
        if uid in grouped:
            result.append({
                'user_id': uid,
                'username': grouped[uid][0]['username'],
                'avatar_url': _av(uid),
                'stories': grouped[uid],
            })

    return jsonify({'ok': True, 'story_groups': result})


@api_bp.get('/stories/<story_id>/media')
@jwt_required()
def get_story_media(story_id: str):
    from datetime import timezone as tz
    from sqlalchemy.orm import selectinload as si

    story = db.session.get(Story, story_id, options=[si(Story.user)])
    if not story:
        abort(404)

    now = datetime.now(tz.utc)
    if story.expires_at < now:
        abort(410)

    # Must be own story or a friend's story
    if story.user_id != current_user.id:
        friendship = Friendship.query.filter(
            or_(
                (Friendship.user_a_id == current_user.id) & (Friendship.user_b_id == story.user_id),
                (Friendship.user_a_id == story.user_id) & (Friendship.user_b_id == current_user.id),
            )
        ).first()
        if not friendship:
            abort(403)

    return send_file(story.storage_path, mimetype=story.content_type, conditional=True)


@api_bp.delete('/stories/<story_id>')
@jwt_required()
def delete_story(story_id: str):
    story = db.session.get(Story, story_id)
    if not story or story.user_id != current_user.id:
        return jsonify({'ok': False, 'error': 'Not found.'}), 404
    db.session.delete(story)
    db.session.commit()
    return jsonify({'ok': True})


@api_bp.post('/stories/<story_id>/reply')
@jwt_required()
def reply_to_story(story_id: str):
    from datetime import timezone as tz
    from sqlalchemy.orm import selectinload as si

    story = db.session.get(Story, story_id, options=[si(Story.user)])
    if not story:
        return jsonify({'ok': False, 'error': 'Story not found.'}), 404

    now = datetime.now(tz.utc)
    if story.expires_at < now:
        return jsonify({'ok': False, 'error': 'Story expired.'}), 410

    payload = request.get_json(silent=True) or {}
    body = (payload.get('body') or '').strip()
    if not body:
        return jsonify({'ok': False, 'error': 'Reply text cannot be empty.'}), 400

    if story.user_id == current_user.id:
        return jsonify({'ok': False, 'error': 'Cannot reply to your own story.'}), 400

    target = db.session.get(User, story.user_id)
    if not target:
        return jsonify({'ok': False, 'error': 'User not found.'}), 404

    conversation = get_or_create_private_conversation(current_user.id, story.user_id)
    db.session.flush()

    message = Message(
        conversation_id=conversation.id,
        sender_id=current_user.id,
        message_type='text',
        body=body,
        extra={'story_reply': story_id},
    )
    db.session.add(message)
    touch_conversation(conversation)
    db.session.commit()

    message = db.session.get(
        Message,
        message.id,
        options=[selectinload(Message.attachments), selectinload(Message.sender)],
    )
    msg_payload = {'message': serialize_message(message)}
    _emit_conversation_update(conversation, 'message:new', msg_payload)
    socketio.emit('conversation:updated', {'conversation_id': conversation.id}, to=f'user:{story.user_id}')
    socketio.emit('conversation:updated', {'conversation_id': conversation.id}, to=f'user:{current_user.id}')
    return jsonify({'ok': True, 'conversation_id': conversation.id})
