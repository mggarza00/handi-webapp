-- Add finalize columns and auto-finish trigger on requests
begin;

alter table public.requests
  add column if not exists finalized_by_client_at timestamptz,
  add column if not exists finalized_by_pro_at timestamptz,
  add column if not exists completed_at timestamptz;

-- Ensure status enum/check includes 'finished' (handled in prior migration)

create or replace function public.fn_requests_auto_finish()
returns trigger
language plpgsql as $$
begin
  if new.finalized_by_client_at is not null and new.finalized_by_pro_at is not null then
    new.status := 'finished';
    if new.completed_at is null then
      new.completed_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_requests_auto_finish on public.requests;
create trigger trg_requests_auto_finish
before update of finalized_by_client_at, finalized_by_pro_at on public.requests
for each row execute function public.fn_requests_auto_finish();

commit;

