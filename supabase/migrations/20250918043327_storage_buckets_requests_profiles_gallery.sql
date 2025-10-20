-- Storage buckets: requests y profiles-gallery

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'requests') then
    begin
      perform storage.create_bucket(
        id => 'requests'::text,
        name => 'requests'::text,
        public => true,
        file_size_limit => null::bigint,
        allowed_mime_types => null::text[]
      );
    exception when undefined_function then
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('requests', 'requests', true, null::bigint, null::text[])
      on conflict (id) do update set
        name = excluded.name,
        public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
    end;
  end if;

  if not exists (select 1 from storage.buckets where id = 'profiles-gallery') then
    begin
      perform storage.create_bucket(
        id => 'profiles-gallery'::text,
        name => 'profiles-gallery'::text,
        public => true,
        file_size_limit => (5 * 1024 * 1024)::bigint,
        allowed_mime_types => ARRAY['image/png','image/jpeg']::text[]
      );
    exception when undefined_function then
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values (
        'profiles-gallery',
        'profiles-gallery',
        true,
        (5 * 1024 * 1024)::bigint,
        ARRAY['image/png','image/jpeg']::text[]
      )
      on conflict (id) do update set
        name = excluded.name,
        public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
    end;
  end if;
end
$$;

do $$ begin
  begin
    perform storage.update_bucket(id => 'requests', public => true);
  exception when undefined_function then
    update storage.buckets set public = true where id = 'requests';
  end;

  begin
    perform storage.update_bucket(id => 'profiles-gallery', public => true);
  exception when undefined_function then
    update storage.buckets set public = true where id = 'profiles-gallery';
  end;
end $$;
