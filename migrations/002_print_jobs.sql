-- Migration: Add print_jobs workflow tables
-- Purpose: Separate workflow state from printable map configuration

-- Print jobs table: workflow state machine for export jobs
CREATE TABLE IF NOT EXISTS print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printable_map_id UUID NOT NULL REFERENCES printable_maps(id) ON DELETE CASCADE,

  -- State machine
  state TEXT NOT NULL DEFAULT 'pending_export' CHECK (state IN (
    'pending_export',
    'exporting',
    'export_complete',
    'export_failed'
  )),

  -- Export tracking
  export_started_at TIMESTAMP,
  export_completed_at TIMESTAMP,
  export_file_path TEXT,
  export_error TEXT,
  export_retry_count INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Print job events table: audit log for state transitions
CREATE TABLE IF NOT EXISTS print_job_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  print_job_id UUID NOT NULL REFERENCES print_jobs(id) ON DELETE CASCADE,

  -- State transition
  from_state TEXT,
  to_state TEXT NOT NULL,

  -- Event metadata
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created',
    'started',
    'completed',
    'failed',
    'retrying'
  )),

  -- Additional context
  metadata JSONB,
  error_message TEXT,

  -- Timestamp
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_print_jobs_state ON print_jobs(state);
CREATE INDEX IF NOT EXISTS idx_print_jobs_printable_map ON print_jobs(printable_map_id);
CREATE INDEX IF NOT EXISTS idx_print_job_events_job ON print_job_events(print_job_id);
CREATE INDEX IF NOT EXISTS idx_print_job_events_created ON print_job_events(created_at);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_print_jobs_updated_at
  BEFORE UPDATE ON print_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
