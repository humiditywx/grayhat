from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Index, UniqueConstraint

from .extensions import db


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class User(db.Model, TimestampMixin):
    __tablename__ = 'users'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    username = db.Column(db.String(24), nullable=False)
    username_normalized = db.Column(db.String(24), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(512), nullable=False)
    totp_secret_encrypted = db.Column(db.Text, nullable=True)
    totp_enabled = db.Column(db.Boolean, nullable=False, default=False)
    recovery_codes = db.Column(db.JSON, nullable=False, default=list)
    token_version = db.Column(db.Integer, nullable=False, default=0)
    last_seen_at = db.Column(db.DateTime(timezone=True), nullable=True)
    # profile picture (v1 feature)
    avatar_storage_name = db.Column(db.String(255), nullable=True)
    # profile bio
    bio = db.Column(db.Text, nullable=True)
    # username change history – list of ISO datetime strings
    username_changed_at = db.Column(db.JSON, nullable=False, default=list)

    conversations = db.relationship('ConversationParticipant', back_populates='user', cascade='all, delete-orphan')
    sent_messages = db.relationship('Message', back_populates='sender', cascade='all, delete-orphan')


class Friendship(db.Model, TimestampMixin):
    __tablename__ = 'friendships'
    __table_args__ = (
        UniqueConstraint('user_a_id', 'user_b_id', name='uq_friendship_pair'),
        Index('ix_friendship_a', 'user_a_id'),
        Index('ix_friendship_b', 'user_b_id'),
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    user_a_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    user_b_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)

    user_a = db.relationship('User', foreign_keys=[user_a_id])
    user_b = db.relationship('User', foreign_keys=[user_b_id])


class FriendRequest(db.Model, TimestampMixin):
    __tablename__ = 'friend_requests'
    __table_args__ = (
        UniqueConstraint('sender_id', 'receiver_id', name='uq_friend_request_pair'),
        Index('ix_fr_receiver', 'receiver_id'),
        Index('ix_fr_sender', 'sender_id'),
    )
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    sender_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    receiver_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    status = db.Column(db.String(16), nullable=False, default='pending')
    sender = db.relationship('User', foreign_keys=[sender_id])
    receiver = db.relationship('User', foreign_keys=[receiver_id])


class Conversation(db.Model, TimestampMixin):
    __tablename__ = 'conversations'
    __table_args__ = (
        Index('ix_conversations_kind', 'kind'),
        Index('ix_conversations_share_token', 'public_share_token'),
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    kind = db.Column(db.String(16), nullable=False)
    title = db.Column(db.String(120), nullable=True)
    description = db.Column(db.Text, nullable=True)
    created_by_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    public_share_token = db.Column(db.String(48), unique=True, nullable=True)
    is_public = db.Column(db.Boolean, nullable=False, default=False)
    last_message_at = db.Column(db.DateTime(timezone=True), nullable=True)
    # group icon (v1 feature)
    icon_storage_name = db.Column(db.String(255), nullable=True)

    created_by = db.relationship('User')
    participants = db.relationship('ConversationParticipant', back_populates='conversation', cascade='all, delete-orphan')
    messages = db.relationship('Message', back_populates='conversation', cascade='all, delete-orphan')
    private_index = db.relationship('PrivateConversationIndex', back_populates='conversation', uselist=False, cascade='all, delete-orphan')


class ConversationParticipant(db.Model):
    __tablename__ = 'conversation_participants'
    __table_args__ = (
        UniqueConstraint('conversation_id', 'user_id', name='uq_conversation_user'),
        Index('ix_cp_user', 'user_id'),
        Index('ix_cp_conversation', 'conversation_id'),
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    conversation_id = db.Column(db.String(36), db.ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    role = db.Column(db.String(16), nullable=False, default='member')
    joined_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    last_read_at = db.Column(db.DateTime(timezone=True), nullable=True)

    conversation = db.relationship('Conversation', back_populates='participants')
    user = db.relationship('User', back_populates='conversations')


class PrivateConversationIndex(db.Model):
    __tablename__ = 'private_conversation_indices'
    __table_args__ = (
        UniqueConstraint('user_a_id', 'user_b_id', name='uq_private_pair'),
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    conversation_id = db.Column(db.String(36), db.ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False, unique=True)
    user_a_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    user_b_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)

    conversation = db.relationship('Conversation', back_populates='private_index')


class Message(db.Model):
    __tablename__ = 'messages'
    __table_args__ = (
        Index('ix_messages_conversation_created', 'conversation_id', 'created_at'),
        Index('ix_messages_sender', 'sender_id'),
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    conversation_id = db.Column(db.String(36), db.ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False)
    sender_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    message_type = db.Column(db.String(16), nullable=False, default='text')
    body = db.Column(db.Text, nullable=True)
    edited_at = db.Column(db.DateTime(timezone=True), nullable=True)
    # soft-delete (v1 feature)
    deleted_at = db.Column(db.DateTime(timezone=True), nullable=True)
    extra = db.Column(db.JSON, nullable=False, default=dict)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

    conversation = db.relationship('Conversation', back_populates='messages')
    sender = db.relationship('User', back_populates='sent_messages')
    attachments = db.relationship('Attachment', back_populates='message', cascade='all, delete-orphan')


class Attachment(db.Model):
    __tablename__ = 'attachments'
    __table_args__ = (
        Index('ix_attachment_message', 'message_id'),
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    message_id = db.Column(db.String(36), db.ForeignKey('messages.id', ondelete='CASCADE'), nullable=False)
    original_name = db.Column(db.String(255), nullable=False)
    storage_name = db.Column(db.String(255), nullable=False, unique=True)
    storage_path = db.Column(db.String(1024), nullable=False)
    content_type = db.Column(db.String(255), nullable=False)
    kind = db.Column(db.String(16), nullable=False)
    size_bytes = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

    message = db.relationship('Message', back_populates='attachments')


class RevokedToken(db.Model):
    __tablename__ = 'revoked_tokens'
    __table_args__ = (
        Index('ix_revoked_expires', 'expires_at'),
    )

    jti = db.Column(db.String(128), primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=True)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    reason = db.Column(db.String(64), nullable=False, default='logout')
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)


class Story(db.Model):
    __tablename__ = 'stories'
    __table_args__ = (
        Index('ix_stories_user_expires', 'user_id', 'expires_at'),
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    media_type = db.Column(db.String(8), nullable=False)  # 'image' or 'video'
    storage_name = db.Column(db.String(255), nullable=False, unique=True)
    storage_path = db.Column(db.String(1024), nullable=False)
    content_type = db.Column(db.String(255), nullable=False)
    caption = db.Column(db.Text, nullable=True)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

    user = db.relationship('User')


class StoryView(db.Model):
    __tablename__ = 'story_views'
    __table_args__ = (
        UniqueConstraint('story_id', 'viewer_id', name='uq_story_view'),
        Index('ix_story_views_story', 'story_id'),
        Index('ix_story_views_viewer', 'viewer_id'),
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    story_id = db.Column(db.String(36), db.ForeignKey('stories.id', ondelete='CASCADE'), nullable=False)
    viewer_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    viewed_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

    viewer = db.relationship('User', foreign_keys=[viewer_id])


class CallPresence(db.Model):
    __tablename__ = 'call_presences'
    __table_args__ = (
        UniqueConstraint('conversation_id', 'user_id', name='uq_call_presence_pair'),
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    conversation_id = db.Column(db.String(36), db.ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    mode = db.Column(db.String(16), nullable=False)
    joined_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
