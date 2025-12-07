-- Down migration: Remove print_jobs workflow tables
-- Reverts migration 002_print_jobs.sql

-- Drop trigger first
DROP TRIGGER IF EXISTS update_print_jobs_updated_at ON print_jobs;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop indexes
DROP INDEX IF EXISTS idx_print_job_events_created;
DROP INDEX IF EXISTS idx_print_job_events_job;
DROP INDEX IF EXISTS idx_print_jobs_printable_map;
DROP INDEX IF EXISTS idx_print_jobs_state;

-- Drop tables (cascade to remove foreign keys)
DROP TABLE IF EXISTS print_job_events CASCADE;
DROP TABLE IF EXISTS print_jobs CASCADE;
