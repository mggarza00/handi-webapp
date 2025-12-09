-- Add empresa boolean flag to pro_applications and professionals
begin;

-- pro_applications: applicants can be companies
alter table if exists public.pro_applications
  add column if not exists empresa boolean default false;

-- professionals: public profile indicating company provider
alter table if exists public.professionals
  add column if not exists empresa boolean default false;

-- Optional: simple index for admin filtering
create index if not exists idx_pro_applications_empresa on public.pro_applications(empresa);
create index if not exists idx_professionals_empresa on public.professionals(empresa);

commit;

