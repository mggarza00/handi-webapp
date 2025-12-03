-- Extend public.bank_accounts with optional columns used in UI flows
-- Safe, idempotent changes only.

alter table if exists public.bank_accounts
  add column if not exists account_type text,
  add column if not exists verification_document_url text;

-- Helpful index for lookups by profile
create index if not exists idx_bank_accounts_profile_id
  on public.bank_accounts (profile_id);

