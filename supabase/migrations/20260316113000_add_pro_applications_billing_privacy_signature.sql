-- Persistir datos de la última sección de /pro-apply en pro_applications
-- Campos:
--  - Facultad para elaborar facturas
--  - Autorización para que Handi elabore facturas
--  - Aceptación del aviso de privacidad
--  - Firma (texto/base64)

begin;

alter table if exists public.pro_applications
  add column if not exists can_issue_invoices boolean,
  add column if not exists authorize_handi_to_issue_invoices boolean,
  add column if not exists privacy_notice_accepted boolean not null default false,
  add column if not exists signature text;

comment on column public.pro_applications.can_issue_invoices
  is 'Tiene facultad para elaborar facturas de sus servicios';
comment on column public.pro_applications.authorize_handi_to_issue_invoices
  is 'Autoriza a Handi a elaborar facturas de sus servicios';
comment on column public.pro_applications.privacy_notice_accepted
  is 'Aceptación del aviso de privacidad en la postulación';
comment on column public.pro_applications.signature
  is 'Firma capturada en texto/base64/data-url al enviar la postulación';

commit;
