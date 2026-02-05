ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS payment_mode text;

UPDATE public.offers
SET payment_mode = 'live'
WHERE payment_mode IS NULL;

ALTER TABLE public.offers
  ALTER COLUMN payment_mode SET DEFAULT 'live';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'offers'
      AND c.conname = 'offers_payment_mode_check'
  ) THEN
    ALTER TABLE public.offers
      ADD CONSTRAINT offers_payment_mode_check
      CHECK (payment_mode IN ('live', 'test'));
  END IF;
END $$;
