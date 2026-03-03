alter table public.profiles
  add column if not exists phone text;

create index if not exists profiles_phone_idx
  on public.profiles (phone);

do $$
begin
  if not exists (
    select 1 from pg_policy where polname = 'profiles.select.own'
  ) then
    execute 'create policy "profiles.select.own" on public.profiles for select using (auth.uid() = id)';
  end if;
  if not exists (
    select 1 from pg_policy where polname = 'profiles.insert.own'
  ) then
    execute 'create policy "profiles.insert.own" on public.profiles for insert with check (auth.uid() = id)';
  end if;
  if not exists (
    select 1 from pg_policy where polname = 'profiles.update.own'
  ) then
    execute 'create policy "profiles.update.own" on public.profiles for update using (auth.uid() = id)';
  end if;
end $$;
