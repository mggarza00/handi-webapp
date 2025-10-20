-- Add optional subcategories column to pro_applications to store fine-grained skills
alter table if exists public.pro_applications
  add column if not exists subcategories jsonb;

comment on column public.pro_applications.subcategories is 'Array JSON opcional con subcategorías elegidas por el profesional (ej. ["Instalación", {"name":"Cableado"}])';
