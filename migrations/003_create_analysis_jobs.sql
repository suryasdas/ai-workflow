DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'analysis_job_status') THEN
    CREATE TYPE analysis_job_status AS ENUM (
      'queued',
      'processing',
      'completed',
      'failed'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
  status analysis_job_status NOT NULL DEFAULT 'queued',
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error text,
  locked_at timestamptz,
  available_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status_available_at
  ON analysis_jobs(status, available_at, created_at);
