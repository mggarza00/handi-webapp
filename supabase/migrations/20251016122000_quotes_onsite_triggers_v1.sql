-- Complemento: asegurar funciones/índices y consistencia
begin;

-- Asegura updated_at en quotes/onsite
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists set_updated_at_quotes on public.quotes;
create trigger set_updated_at_quotes before update on public.quotes
for each row execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at_onsite on public.onsite_quote_requests;
create trigger set_updated_at_onsite before update on public.onsite_quote_requests
for each row execute function public.tg_set_updated_at();

commit;

