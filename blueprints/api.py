from __future__ import annotations

import io
import re
from uuid import UUID

from flask import Blueprint, abort, jsonify, request, send_file
from flask_jwt_extended import current_user, jwt_required
from PIL import Image, UnidentifiedImageError
from pyzbar.pyzbar import decode as decode_qr
from sqlalchemy import or_
from sqlalchemy.orm import selectinload

from ..extensions import db, limiter, socketio
from ..models import Attachment, Conversation, ConversationParticipant, Friendship, Message, PrivateConversationIndex, User
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
from ..services.serializers import public_base_url, serialize_conversation, serialize_friend, serialize_message, serialize_user
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

    return jsonify({
        'ok': True,
        'user': serialize_user(current_user),
        'friends': friend_payload,
        'conversations': [serialize_conversation(item, current_user.id) for item in conversations],
        'ice_servers': _ice_servers(),
        'my_uuid': current_user.id,
        'my_add_link': f'{public_base_url()}/add/{current_user.id}',
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
def create_friendship():    payload = request.get_json(silent=True) or {}
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
def create_group_route():    payload = request.get_json(silent=True) or {}
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
    return jsonify({'ok': True, 'read_at': utc_iso(next((p.last_read_at for p in conversation.participants if p.user_id == current_user.id), None))})
