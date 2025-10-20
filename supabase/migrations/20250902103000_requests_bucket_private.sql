-- Make 'requests' bucket private and update policies to require signed URLs

-- Set bucket to private
update storage.buckets set public = false where id = 'requests';

-- Drop public select policy if exists and replace with deny-all (signed URLs bypass)
do $$ begin
  if exists (select 1 from pg_policy where polname = 'requests_select_public') then
    drop policy "requests_select_public" on storage.objects;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policy where polname = 'requests_select_private') then
    create policy "requests_select_private" on storage.objects
      for select
      using (false);
  end if;
end $$;
