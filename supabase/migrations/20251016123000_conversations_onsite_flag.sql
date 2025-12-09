-- Conversations: flag to indicate if onsite quote is required
begin;

alter table public.conversations
  add column if not exists onsite_quote_required boolean not null default false;

commit;

