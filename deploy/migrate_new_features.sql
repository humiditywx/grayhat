-- Migration: add new feature columns
-- Run this ONCE against your PostgreSQL database when upgrading.
-- Safe to run multiple times (uses IF NOT EXISTS / DO blocks).

-- 1. Profile pictures: add avatar column to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_storage_name VARCHAR(255);

-- 2. Soft-delete messages
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 3. Group icons
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS icon_storage_name VARCHAR(255);

-- Done.
