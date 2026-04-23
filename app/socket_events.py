from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

from flask import request
from flask_jwt_extended import current_user, verify_jwt_in_request
from flask_socketio import disconnect, emit, join_room, leave_room

from .extensions import db, socketio
from .models import Conversation, ConversationParticipant, User
from .services.serializers import serialize_user

ACTIVE_CALLS: dict[str, dict] = {}
SID_TO_USER: dict[str, str] = {}
# Track all connected SIDs per user (a user may have multiple tabs)
USER_SIDS: dict[str, set] = defaultdict(set)


def _authenticated_user():
    verify_jwt_in_request(locations=['cookies'])
    return current_user


def _conversation_for_user(user_id: str, conversation_id: str) -> Conversation | None:
    return (
        Conversation.query.join(ConversationParticipant)
        .filter(Conversation.id == conversation_id, ConversationParticipant.user_id == user_id)
        .first()
    )


def _get_contact_user_ids(user_id: str) -> list[str]:
    """Return IDs of all users who share a private conversation with user_id."""
    rows = (
        db.session.query(ConversationParticipant.user_id)
        .join(Conversation, Conversation.id == ConversationParticipant.conversation_id)
        .filter(
            Conversation.kind == 'private',
            Conversation.id.in_(
                db.session.query(ConversationParticipant.conversation_id)
                .filter(ConversationParticipant.user_id == user_id)
            ),
            ConversationParticipant.user_id != user_id,
        )
        .all()
    )
    return [r[0] for r in rows]


@socketio.on('connect')
def handle_connect(auth=None):  # noqa: ARG001
    try:
        user = _authenticated_user()
    except Exception:
        return False

    SID_TO_USER[request.sid] = user.id
    USER_SIDS[user.id].add(request.sid)
    join_room(f'user:{user.id}')
    # Update last_seen_at
    user.last_seen_at = datetime.now(timezone.utc)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
    emit('socket:ready', {'user_id': user.id})

    # Only broadcast online if this is the first connection for this user
    if len(USER_SIDS[user.id]) == 1:
        contact_ids = _get_contact_user_ids(user.id)
        for cid in contact_ids:
            socketio.emit('user:online', {'user_id': user.id}, to=f'user:{cid}')
    return True


@socketio.on('disconnect')
def handle_disconnect():
    user_id = SID_TO_USER.pop(request.sid, None)
    if not user_id:
        return

    USER_SIDS[user_id].discard(request.sid)

    # Update last_seen on disconnect
    user = db.session.get(User, user_id)
    if user:
        user.last_seen_at = datetime.now(timezone.utc)
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()

    # Only broadcast offline if no more connections remain for this user
    if not USER_SIDS[user_id]:
        USER_SIDS.pop(user_id, None)
        contact_ids = _get_contact_user_ids(user_id)
        for cid in contact_ids:
            socketio.emit('user:offline', {'user_id': user_id}, to=f'user:{cid}')

    empty_calls: list[str] = []
    for conversation_id, info in ACTIVE_CALLS.items():
        if user_id in info['participants']:
            info['participants'].discard(user_id)
            socketio.emit('call:participant-left', {'conversation_id': conversation_id, 'user_id': user_id}, to=f'call:{conversation_id}')
            if not info['participants']:
                empty_calls.append(conversation_id)
    for conversation_id in empty_calls:
        ACTIVE_CALLS.pop(conversation_id, None)
        # Notify all members the call ended (caller disconnected)
        conv = Conversation.query.get(conversation_id)
        if conv:
            for p in conv.participants:
                socketio.emit('call:ended', {'conversation_id': conversation_id}, to=f'user:{p.user_id}')


@socketio.on('presence:request')
def handle_presence_request():
    """Client asks which of its contacts are currently online."""
    try:
        user = _authenticated_user()
    except Exception:
        disconnect()
        return

    contact_ids = _get_contact_user_ids(user.id)
    online_ids = [cid for cid in contact_ids if cid in USER_SIDS and USER_SIDS[cid]]
    emit('presence:snapshot', {'online_user_ids': online_ids})


@socketio.on('conversation:join')
def handle_conversation_join(data):
    try:
        user = _authenticated_user()
    except Exception:
        disconnect()
        return

    conversation_id = (data or {}).get('conversation_id')
    if not conversation_id:
        return
    if _conversation_for_user(user.id, conversation_id) is None:
        return
    join_room(f'conversation:{conversation_id}')
    emit('conversation:joined', {'conversation_id': conversation_id})


@socketio.on('conversation:leave')
def handle_conversation_leave(data):
    conversation_id = (data or {}).get('conversation_id')
    if conversation_id:
        leave_room(f'conversation:{conversation_id}')


# ─── Typing indicators ───────────────────────────────────────────────────────

@socketio.on('typing:start')
def handle_typing_start(data):
    try:
        user = _authenticated_user()
    except Exception:
        disconnect()
        return

    data = data or {}
    conversation_id = data.get('conversation_id')
    if not conversation_id:
        return
    if _conversation_for_user(user.id, conversation_id) is None:
        return

    socketio.emit(
        'typing:start',
        {'conversation_id': conversation_id, 'user_id': user.id, 'username': user.username},
        to=f'conversation:{conversation_id}',
        include_self=False,
    )


@socketio.on('typing:stop')
def handle_typing_stop(data):
    try:
        user = _authenticated_user()
    except Exception:
        disconnect()
        return

    data = data or {}
    conversation_id = data.get('conversation_id')
    if not conversation_id:
        return

    socketio.emit(
        'typing:stop',
        {'conversation_id': conversation_id, 'user_id': user.id},
        to=f'conversation:{conversation_id}',
        include_self=False,
    )


# ─── Calls ───────────────────────────────────────────────────────────────────

@socketio.on('call:start')
def handle_call_start(data):
    try:
        user = _authenticated_user()
    except Exception:
        disconnect()
        return

    data = data or {}
    conversation_id = data.get('conversation_id')
    mode = data.get('mode', 'video')
    conversation = _conversation_for_user(user.id, conversation_id)
    if conversation is None:
        return

    ACTIVE_CALLS.setdefault(conversation_id, {'mode': mode, 'participants': set()})
    payload = {
        'conversation_id': conversation_id,
        'mode': mode,
        'caller': serialize_user(user),
        'conversation_title': conversation.title or 'Direct call',
    }
    for participant in conversation.participants:
        if participant.user_id != user.id:
            socketio.emit('call:incoming', payload, to=f'user:{participant.user_id}')


@socketio.on('call:join')
def handle_call_join(data):
    try:
        user = _authenticated_user()
    except Exception:
        disconnect()
        return

    data = data or {}
    conversation_id = data.get('conversation_id')
    mode = data.get('mode', 'video')
    conversation = _conversation_for_user(user.id, conversation_id)
    if conversation is None:
        return

    call_info = ACTIVE_CALLS.setdefault(conversation_id, {'mode': mode, 'participants': set()})
    existing = [participant_id for participant_id in call_info['participants'] if participant_id != user.id]
    call_info['participants'].add(user.id)
    join_room(f'call:{conversation_id}')
    emit('call:participants', {'conversation_id': conversation_id, 'participants': existing, 'mode': call_info['mode']})
    emit('call:participant-joined', {'conversation_id': conversation_id, 'user_id': user.id}, to=f'call:{conversation_id}', include_self=False)


@socketio.on('call:leave')
def handle_call_leave(data):
    try:
        user = _authenticated_user()
    except Exception:
        disconnect()
        return

    conversation_id = (data or {}).get('conversation_id')
    if not conversation_id:
        return

    call_info = ACTIVE_CALLS.get(conversation_id)
    if call_info:
        call_info['participants'].discard(user.id)
        emit('call:participant-left', {'conversation_id': conversation_id, 'user_id': user.id}, to=f'call:{conversation_id}', include_self=False)
        if not call_info['participants']:
            ACTIVE_CALLS.pop(conversation_id, None)
            # Notify all conversation members that the call has ended
            conversation = _conversation_for_user(user.id, conversation_id)
            if conversation:
                for participant in conversation.participants:
                    socketio.emit('call:ended', {'conversation_id': conversation_id}, to=f'user:{participant.user_id}')
    leave_room(f'call:{conversation_id}')


@socketio.on('call:decline')
def handle_call_decline(data):
    try:
        user = _authenticated_user()
    except Exception:
        disconnect()
        return

    data = data or {}
    conversation_id = data.get('conversation_id')
    caller_user_id = data.get('caller_user_id')
    if not conversation_id or not caller_user_id:
        return

    conversation = _conversation_for_user(user.id, conversation_id)
    if conversation is None:
        return
    if caller_user_id not in {participant.user_id for participant in conversation.participants}:
        return

    socketio.emit(
        'call:declined',
        {'conversation_id': conversation_id, 'source_user_id': user.id},
        to=f'user:{caller_user_id}',
    )


@socketio.on('webrtc:offer')
def handle_webrtc_offer(data):
    _forward_signaling('webrtc:offer', data)


@socketio.on('webrtc:answer')
def handle_webrtc_answer(data):
    _forward_signaling('webrtc:answer', data)


@socketio.on('webrtc:ice-candidate')
def handle_webrtc_ice(data):
    _forward_signaling('webrtc:ice-candidate', data)


@socketio.on('webrtc:hangup')
def handle_webrtc_hangup(data):
    _forward_signaling('webrtc:hangup', data)


def _forward_signaling(event_name: str, data):
    try:
        user = _authenticated_user()
    except Exception:
        disconnect()
        return

    data = data or {}
    conversation_id = data.get('conversation_id')
    target_user_id = data.get('target_user_id')
    if not conversation_id or not target_user_id:
        return
    if _conversation_for_user(user.id, conversation_id) is None:
        return

    socketio.emit(
        event_name,
        {
            'conversation_id': conversation_id,
            'source_user_id': user.id,
            'target_user_id': target_user_id,
            'payload': data.get('payload'),
            'mode': data.get('mode'),
        },
        to=f'user:{target_user_id}',
    )
