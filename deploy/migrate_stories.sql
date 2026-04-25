-- Migration: add Stories feature
-- Run this ONCE against your PostgreSQL database when upgrading from v1.0.
-- Safe to run multiple times (uses IF NOT EXISTS / DO blocks).

-- 1. Create the stories table
CREATE TABLE IF NOT EXISTS stories (
    id               VARCHAR(36)              PRIMARY KEY,
    user_id          VARCHAR(36)              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_type       VARCHAR(8)               NOT NULL,
    storage_name     VARCHAR(255)             NOT NULL UNIQUE,
    storage_path     VARCHAR(1024)            NOT NULL,
    content_type     VARCHAR(255)             NOT NULL,
    caption          TEXT,
    expires_at       TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Index for fast friend-feed queries (user_id + expiry window)
CREATE INDEX IF NOT EXISTS ix_stories_user_expires ON stories (user_id, expires_at);

-- Done.
