from __future__ import annotations

from collections import defaultdict

from ..models import Attachment, Conversation, ConversationParticipant, Friendship, Message, PrivateConversationIndex, User
from .security import utc_iso


def public_base_url() -> str:
    from flask import current_app, request

    configured = current_app.config.get('PUBLIC_BASE_URL', '').rstrip('/')
    if configured:
        return configured
    return request.url_root.rstrip('/')


def serialize_user(user: User) -> dict:
    return {
        'id': user.id,
        'username': user.username,
        'totp_enabled': user.totp_enabled,
        'created_at': utc_iso(user.created_at),
    }


def serialize_attachment(attachment: Attachment) -> dict:
    return {
        'id': attachment.id,
        'name': attachment.original_name,
        'kind': attachment.kind,
        'content_type': attachment.content_type,
        'size_bytes': attachment.size_bytes,
        'url': f'/api/attachments/{attachment.id}',
    }


def serialize_message(message: Message) -> dict:
    return {
        'id': message.id,
        'conversation_id': message.conversation_id,
        'sender': serialize_user(message.sender) if message.sender else None,
        'message_type': message.message_type,
        'body': message.body,
        'edited_at': utc_iso(message.edited_at),
        'created_at': utc_iso(message.created_at),
        'attachments': [serialize_attachment(item) for item in message.attachments],
        'extra': message.extra or {},
    }


def _private_partner(conversation: Conversation, current_user_id: str) -> User | None:
    for participant in conversation.participants:
        if participant.user_id != current_user_id:
            return participant.user
    return None


def _last_message_preview(conversation: Conversation) -> str:
    if not conversation.messages:
        return ''
    message = max(conversation.messages, key=lambda item: item.created_at)
    if message.message_type == 'text':
        return (message.body or '')[:80]
    if message.message_type == 'voice':
        return 'Voice message'
    if message.message_type in {'image', 'video', 'audio', 'document', 'file'}:
        return 'Attachment'
    return message.message_type.title()


def serialize_conversation(conversation: Conversation, current_user_id: str) -> dict:
    partner = _private_partner(conversation, current_user_id) if conversation.kind == 'private' else None
    title = conversation.title or (partner.username if partner else 'Direct chat')
    share_url = None
    if conversation.kind == 'group' and conversation.public_share_token:
        share_url = f'{public_base_url()}/g/{conversation.public_share_token}'

    me_role = 'member'
    for participant in conversation.participants:
        if participant.user_id == current_user_id:
            me_role = participant.role
            break

    return {
        'id': conversation.id,
        'kind': conversation.kind,
        'title': title,
        'description': conversation.description,
        'created_at': utc_iso(conversation.created_at),
        'last_message_at': utc_iso(conversation.last_message_at),
        'me_role': me_role,
        'is_public': conversation.is_public,
        'share_url': share_url,
        'member_count': len(conversation.participants),
        'member_ids': [p.user_id for p in conversation.participants] if conversation.kind == 'group' else None,
        'last_message_preview': _last_message_preview(conversation),
        'partner': serialize_user(partner) if partner else None,
    }


def serialize_friend(user: User, conversation_id: str | None = None) -> dict:
    base = serialize_user(user)
    base['conversation_id'] = conversation_id
    base['add_link'] = f'{public_base_url()}/add/{user.id}'
    return base
