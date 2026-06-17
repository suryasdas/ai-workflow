ALTER TABLE ticket_analyses
ADD COLUMN IF NOT EXISTS priority_reason text;

ALTER TABLE ticket_analyses
ADD COLUMN IF NOT EXISTS confidence_reason text;

UPDATE ticket_analyses
SET
  priority_reason = COALESCE(priority_reason, 'Reason not captured before v2.0'),
  confidence_reason = COALESCE(confidence_reason, 'Reason not captured before v2.0');

ALTER TABLE ticket_analyses
ALTER COLUMN priority_reason SET NOT NULL;

ALTER TABLE ticket_analyses
ALTER COLUMN confidence_reason SET NOT NULL;
