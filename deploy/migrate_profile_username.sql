-- Migration: Add bio and username_changed_at to users table
-- Run with: psql $DATABASE_URL -f deploy/migrate_profile_username.sql
--      or:  sqlite3 path/to/db.sqlite < deploy/migrate_profile_username.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username_changed_at JSON NOT NULL DEFAULT '[]';
