-- Normalize offers.status: replace 'sent' with 'pending' and enforce allowed values

-- Ensure column exists (most envs already have it)
alter table public.offers
  add column if not exists status text;

do $$
declare
  v_typename text;
begin
  -- Detect column type
  select pg_catalog.format_type(a.atttypid, a.atttypmod)
  into v_typename
  from pg_attribute a
  where a.attrelid = 'public.offers'::regclass
    and a.attname = 'status'
    and a.attnum > 0
    and not a.attisdropped;

  -- If enum public.offer_status, add 'pending' if missing
  if v_typename = 'public.offer_status' then
    begin
      alter type public.offer_status add value if not exists 'pending';
    exception when others then
      -- ignore if already exists or lacks privileges
      null;
    end;
    -- Backfill enum by casting to text for comparison
    update public.offers set status = 'pending'::public.offer_status where status::text in ('sent','Sent','SENT');
    -- Optionally set default to pending
    alter table public.offers alter column status set default 'pending'::public.offer_status;
  else
    -- Treat as text
    update public.offers set status = 'pending' where status in ('sent','Sent','SENT');
    -- Add check constraint if missing
    perform 1 from pg_constraint where conname = 'offers_status_chk' and conrelid = 'public.offers'::regclass;
    if not found then
      alter table public.offers
        add constraint offers_status_chk
        check (status in ('pending','accepted','rejected','expired'));
    end if;
    -- Validate the constraint
    alter table public.offers validate constraint offers_status_chk;
  end if;
end$$;

