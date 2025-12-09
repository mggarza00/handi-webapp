-- Storage bucket for service photos used in public portfolio

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'service-photos') then
    begin
      perform storage.create_bucket(
        id => 'service-photos'::text,
        name => 'service-photos'::text,
        public => true,
        file_size_limit => (10 * 1024 * 1024)::bigint,
        allowed_mime_types => ARRAY['image/png','image/jpeg','image/webp']::text[]
      );
    exception when undefined_function then
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values (
        'service-photos',
        'service-photos',
        true,
        (10 * 1024 * 1024)::bigint,
        ARRAY['image/png','image/jpeg','image/webp']::text[]
      )
      on conflict (id) do update set
        name = excluded.name,
        public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
    end;
  end if;
end $$;

-- Ensure bucket stays public
do $$ begin
  begin
    perform storage.update_bucket(id => 'service-photos', public => true);
  exception when undefined_function then
    update storage.buckets set public = true where id = 'service-photos';
  end;
end $$;

