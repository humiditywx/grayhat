from __future__ import annotations

from collections import defaultdict

from ..models import Attachment, Conversation, ConversationParticipant, FriendRequest, Friendship, Message, PrivateConversationIndex, Story, User
from .security import utc_iso


def public_base_url() -> str:
    from flask import current_app, request

    configured = current_app.config.get('PUBLIC_BASE_URL', '').rstrip('/')
    if configured:
        return configured
    return request.url_root.rstrip('/')


def serialize_user(user: User) -> dict:
    # v1 feature: avatar_url and last_seen_at
    avatar_url = f'/api/users/{user.id}/avatar' if user.avatar_storage_name else None
    return {
        'id': user.id,
        'username': user.username,
        'bio': getattr(user, 'bio', None) or '',
        'totp_enabled': user.totp_enabled,
        'created_at': utc_iso(user.created_at),
        'last_seen_at': utc_iso(user.last_seen_at),
        'avatar_url': avatar_url,
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
    # v1 feature: deleted_at and suppressed attachments for deleted messages
    return {
        'id': message.id,
        'conversation_id': message.conversation_id,
        'sender': serialize_user(message.sender) if message.sender else None,
        'message_type': message.message_type,
        'body': message.body,
        'edited_at': utc_iso(message.edited_at),
        'deleted_at': utc_iso(message.deleted_at),
        'created_at': utc_iso(message.created_at),
        'attachments': [] if message.deleted_at else [serialize_attachment(item) for item in message.attachments],
        'extra': message.extra or {},
    }


def serialize_story(story: Story) -> dict:
    avatar_url = (
        f'/api/users/{story.user_id}/avatar'
        if story.user and story.user.avatar_storage_name
        else None
    )
    return {
        'id': story.id,
        'user_id': story.user_id,
        'username': story.user.username if story.user else 'Unknown',
        'avatar_url': avatar_url,
        'media_type': story.media_type,
        'url': f'/api/stories/{story.id}/media',
        'content_type': story.content_type,
        'caption': story.caption,
        'expires_at': utc_iso(story.expires_at),
        'created_at': utc_iso(story.created_at),
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

    # v1 feature: per-member read tracking
    me_role = 'member'
    my_last_read_at = None
    partner_last_read_at = None
    members_read_at: dict = {}
    for participant in conversation.participants:
        if participant.user_id == current_user_id:
            me_role = participant.role
            my_last_read_at = participant.last_read_at
        elif conversation.kind == 'private':
            partner_last_read_at = participant.last_read_at
        if conversation.kind == 'group':
            members_read_at[participant.user_id] = utc_iso(participant.last_read_at)

    # v1 feature: group icon
    icon_url = None
    if conversation.kind == 'group' and getattr(conversation, 'icon_storage_name', None):
        icon_url = f'/api/conversations/{conversation.id}/icon'

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
        'members_read_at': members_read_at if conversation.kind == 'group' else None,
        'last_message_preview': _last_message_preview(conversation),
        'partner': serialize_user(partner) if partner else None,
        'my_last_read_at': utc_iso(my_last_read_at),
        'partner_last_read_at': utc_iso(partner_last_read_at),
        'icon_url': icon_url,
    }


def serialize_friend(user: User, conversation_id: str | None = None) -> dict:
    base = serialize_user(user)
    base['conversation_id'] = conversation_id
    base['add_link'] = f'{public_base_url()}/add/{user.id}'
    return base


def serialize_friend_request(req: FriendRequest, perspective_user_id: str) -> dict:
    other = req.receiver if req.sender_id == perspective_user_id else req.sender
    return {
        'id': req.id,
        'sender_id': req.sender_id,
        'receiver_id': req.receiver_id,
        'direction': 'outgoing' if req.sender_id == perspective_user_id else 'incoming',
        'other_user': {
            'id': other.id,
            'username': other.username,
            'avatar_url': f'/api/users/{other.id}/avatar' if other.avatar_storage_name else None,
        },
        'created_at': utc_iso(req.created_at),
    }
