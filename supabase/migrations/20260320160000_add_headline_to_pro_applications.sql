alter table if exists public.pro_applications
  add column if not exists headline text;

comment on column public.pro_applications.headline is
  'Titulo corto del perfil profesional capturado en pro-apply y sincronizado a professionals.headline al aprobar';
