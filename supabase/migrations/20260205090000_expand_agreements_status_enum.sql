-- Expand agreements.status to full enum for offer lifecycle statuses.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agreement_status') THEN
    CREATE TYPE agreement_status AS ENUM (
      'negotiating',
      'accepted',
      'rejected',
      'paid',
      'in_progress',
      'completed',
      'cancelled'
    );
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'agreement_status' AND e.enumlabel = 'accepted'
    ) THEN
      ALTER TYPE agreement_status ADD VALUE 'accepted';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'agreement_status' AND e.enumlabel = 'rejected'
    ) THEN
      ALTER TYPE agreement_status ADD VALUE 'rejected';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'agreement_status' AND e.enumlabel = 'paid'
    ) THEN
      ALTER TYPE agreement_status ADD VALUE 'paid';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'agreement_status' AND e.enumlabel = 'in_progress'
    ) THEN
      ALTER TYPE agreement_status ADD VALUE 'in_progress';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'agreement_status' AND e.enumlabel = 'completed'
    ) THEN
      ALTER TYPE agreement_status ADD VALUE 'completed';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'agreement_status' AND e.enumlabel = 'cancelled'
    ) THEN
      ALTER TYPE agreement_status ADD VALUE 'cancelled';
    END IF;
  END IF;
END $$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE t.relname = 'agreements'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE agreements DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE agreements
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE agreement_status USING status::text::agreement_status,
  ALTER COLUMN status SET DEFAULT 'negotiating';

CREATE UNIQUE INDEX IF NOT EXISTS agreements_request_professional_unique
  ON agreements (request_id, professional_id);
