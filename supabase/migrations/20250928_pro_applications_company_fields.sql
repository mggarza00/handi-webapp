-- Agrega campos para compañías en pro_applications y professionals
-- Ejecutar en Supabase migrations

begin;

-- 01) Nuevos campos en pro_applications
alter table public.pro_applications
  add column if not exists is_company boolean default false not null,
  add column if not exists company_legal_name text,
  add column if not exists company_industry text,
  add column if not exists company_employees_count integer,
  add column if not exists company_website text,
  add column if not exists company_doc_incorporation_url text,
  add column if not exists company_csf_url text,
  add column if not exists company_rep_id_front_url text,
  add column if not exists company_rep_id_back_url text;

-- Índice útil para filtrar por empresas
create index if not exists idx_pro_applications_is_company
  on public.pro_applications (is_company);

-- 02) Nuevos campos en professionals
alter table public.professionals
  add column if not exists is_company boolean default false not null,
  add column if not exists company_legal_name text,
  add column if not exists company_industry text,
  add column if not exists company_employees_count integer,
  add column if not exists company_website text,
  add column if not exists company_doc_incorporation_url text,
  add column if not exists company_csf_url text,
  add column if not exists company_rep_id_front_url text,
  add column if not exists company_rep_id_back_url text;

-- 03) Constraints suaves para número de empleados
alter table public.pro_applications
  drop constraint if exists pro_applications_company_employees_count_check;
alter table public.pro_applications
  add constraint pro_applications_company_employees_count_check
  check (company_employees_count is null or company_employees_count > 0);

alter table public.professionals
  drop constraint if exists professionals_company_employees_count_check;
alter table public.professionals
  add constraint professionals_company_employees_count_check
  check (company_employees_count is null or company_employees_count > 0);

commit;

-- 04) Supabase Storage bucket para documentos de empresa (público)
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'applications') then
    begin
      perform storage.create_bucket(
        id => 'applications'::text,
        name => 'applications'::text,
        public => true,
        file_size_limit => 10485760::bigint, -- 10MB
        allowed_mime_types => ARRAY[
          'image/*',
          'application/pdf'
        ]::text[]
      );
    exception when undefined_function then
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values (
        'applications',
        'applications',
        true,
        10485760::bigint,
        ARRAY['image/*','application/pdf']::text[]
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
