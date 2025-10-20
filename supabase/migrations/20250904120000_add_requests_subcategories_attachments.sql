-- Add missing columns to requests for subcategories and attachments
alter table public.requests
  add column if not exists subcategories jsonb default '[]'::jsonb;

alter table public.requests
  add column if not exists attachments jsonb default '[]'::jsonb;

-- Optional: comment for documentation
comment on column public.requests.subcategories is 'Array JSON con subcategorías (ej. ["Plomería", {"name":"Instalación"}])';
comment on column public.requests.attachments is 'Array JSON con adjuntos (url|path, mime, size)';

