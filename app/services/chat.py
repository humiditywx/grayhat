from __future__ import annotations

from flask import abort
from sqlalchemy import or_

from ..extensions import db
from ..models import Conversation, ConversationParticipant, Friendship, Message, PrivateConversationIndex, User, utcnow
from .security import canonical_user_pair, random_token


def get_user_or_404(user_id: str) -> User:
    user = db.session.get(User, user_id)
    if not user:
        abort(404, description='User not found.')
    return user


def are_friends(user_id: str, target_id: str) -> bool:
    a, b = canonical_user_pair(user_id, target_id)
    return Friendship.query.filter_by(user_a_id=a, user_b_id=b).first() is not None


def add_friend(user: User, target: User) -> tuple[Friendship, Conversation]:
    if user.id == target.id:
        raise ValueError('You cannot add yourself as a friend.')

    a, b = canonical_user_pair(user.id, target.id)
    friendship = Friendship.query.filter_by(user_a_id=a, user_b_id=b).first()
    if friendship is None:
        friendship = Friendship(user_a_id=a, user_b_id=b)
        db.session.add(friendship)

    conversation = get_or_create_private_conversation(user.id, target.id)
    db.session.flush()
    return friendship, conversation


def get_or_create_private_conversation(user_id: str, target_id: str) -> Conversation:
    a, b = canonical_user_pair(user_id, target_id)
    private_idx = PrivateConversationIndex.query.filter_by(user_a_id=a, user_b_id=b).first()
    if private_idx:
        return private_idx.conversation

    conversation = Conversation(kind='private', created_by_id=user_id, last_message_at=utcnow())
    db.session.add(conversation)
    db.session.flush()

    db.session.add_all([
        ConversationParticipant(conversation_id=conversation.id, user_id=user_id, role='owner'),
        ConversationParticipant(conversation_id=conversation.id, user_id=target_id, role='owner'),
        PrivateConversationIndex(conversation_id=conversation.id, user_a_id=a, user_b_id=b),
    ])
    db.session.flush()
    return conversation


def create_group(owner: User, title: str, description: str | None = None) -> Conversation:
    title = title.strip()
    if not title:
        raise ValueError('Group title is required.')
    conversation = Conversation(
        kind='group',
        title=title,
        description=(description or '').strip() or None,
        created_by_id=owner.id,
        is_public=True,
        public_share_token=random_token(24),
        last_message_at=utcnow(),
    )
    db.session.add(conversation)
    db.session.flush()
    db.session.add(ConversationParticipant(conversation_id=conversation.id, user_id=owner.id, role='owner'))
    return conversation


def get_conversation_for_user_or_404(user_id: str, conversation_id: str) -> Conversation:
    conversation = (
        Conversation.query.join(ConversationParticipant)
        .filter(Conversation.id == conversation_id, ConversationParticipant.user_id == user_id)
        .first()
    )
    if not conversation:
        abort(404, description='Conversation not found.')
    return conversation


def join_public_group(user: User, share_token: str) -> Conversation:
    conversation = Conversation.query.filter_by(public_share_token=share_token, kind='group', is_public=True).first()
    if not conversation:
        abort(404, description='Group not found.')

    existing = ConversationParticipant.query.filter_by(conversation_id=conversation.id, user_id=user.id).first()
    if existing is None:
        db.session.add(ConversationParticipant(conversation_id=conversation.id, user_id=user.id, role='member'))
    return conversation


def mark_read(user_id: str, conversation_id: str) -> None:
    participant = ConversationParticipant.query.filter_by(user_id=user_id, conversation_id=conversation_id).first()
    if participant:
        participant.last_read_at = utcnow()


def touch_conversation(conversation: Conversation) -> None:
    conversation.last_message_at = utcnow()
