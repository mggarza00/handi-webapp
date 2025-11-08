-- Remove "Pro Seed" user and related data from Supabase
-- Usage: run with Service Role (or in SQL editor with admin privileges) to delete from auth.users.

-- Preview: check user by email and by profile name
select id, email from auth.users where lower(email) = 'pro+seed@homaid.dev';
select id, full_name from public.profiles where lower(full_name) = 'pro seed';

-- Delete script (safe, best‑effort; tolerates missing tables/permissions)
do $$
declare
  v_uid uuid;
begin
  -- 1) Locate by email in auth.users
  select u.id into v_uid
  from auth.users u
  where lower(u.email) = 'pro+seed@homaid.dev'
  limit 1;

  -- 2) Fallback: locate by name in public.profiles
  if v_uid is null then
    select p.id into v_uid
    from public.profiles p
    where lower(p.full_name) = 'pro seed'
    limit 1;
  end if;

  if v_uid is null then
    raise notice 'No Pro Seed found by email or profile name.';
    return;
  end if;

  -- 3) Delete related rows in public schema (in case auth delete is not permitted)
  begin
    delete from public.applications where professional_id = v_uid;
  exception when others then
    raise notice 'applications delete skipped: %', SQLERRM;
  end;

  begin
    delete from public.agreements where professional_id = v_uid;
  exception when others then
    raise notice 'agreements delete skipped: %', SQLERRM;
  end;

  begin
    delete from public.professionals where id = v_uid;
  exception when others then
    raise notice 'professionals delete skipped: %', SQLERRM;
  end;

  begin
    delete from public.profiles where id = v_uid;
  exception when others then
    raise notice 'profiles delete skipped: %', SQLERRM;
  end;

  -- 4) Delete auth user (requires Service Role / elevated privileges)
  begin
    delete from auth.users where id = v_uid;
    raise notice 'auth.users user % removed', v_uid;
  exception when others then
    raise notice 'auth.users delete skipped (needs admin): %', SQLERRM;
  end;
end $$;

