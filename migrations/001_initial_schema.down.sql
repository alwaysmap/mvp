-- Down migration: Remove initial schema tables
-- Reverts migration 001_initial_schema.sql

-- Drop tables (cascade to remove foreign keys)
DROP TABLE IF EXISTS printable_maps CASCADE;
DROP TABLE IF EXISTS user_maps CASCADE;
