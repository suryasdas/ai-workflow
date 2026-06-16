CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
    CREATE TYPE ticket_status AS ENUM (
      'new',
      'processing',
      'processed',
      'approved',
      'failed',
      'rejected'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_category') THEN
    CREATE TYPE ticket_category AS ENUM (
      'damaged_item',
      'refund_request',
      'shipping_issue',
      'account_issue',
      'technical_issue',
      'other'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_decision') THEN
    CREATE TYPE review_decision AS ENUM (
      'approved',
      'edited',
      'rejected'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status ticket_status NOT NULL DEFAULT 'new',
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticket_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model text NOT NULL,
  category ticket_category NOT NULL,
  sentiment text NOT NULL,
  priority integer NOT NULL CHECK (priority BETWEEN 1 AND 5),
  confidence numeric(4, 3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  summary text NOT NULL,
  draft_reply text NOT NULL,
  raw_output jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  analysis_id uuid REFERENCES ticket_analyses(id) ON DELETE SET NULL,
  reviewer_name text NOT NULL,
  decision review_decision NOT NULL,
  final_reply text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_status_created_at ON tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_analyses_ticket_id_created_at ON ticket_analyses(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_actions_ticket_id_created_at ON review_actions(ticket_id, created_at DESC);
