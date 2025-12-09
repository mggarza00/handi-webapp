-- Create canonical receipt tables to back the PDF view
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Links (adjust to your schema)
  request_id uuid null,
  client_id uuid null,
  professional_id uuid null,
  offer_id uuid null,

  -- Payment linkage (optional but useful)
  checkout_session_id text null,
  payment_intent_id text null,

  -- Currency and amounts (in cents)
  currency text not null default 'MXN',
  service_amount_cents bigint not null default 0,
  commission_amount_cents bigint not null default 0,
  iva_amount_cents bigint not null default 0,
  total_amount_cents bigint not null default 0,

  -- Display
  folio text null,

  -- Metadata
  metadata jsonb not null default '{}'::jsonb
);

-- Optional FKs (use existing tables if present)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='requests') then
    alter table public.receipts
      add constraint receipts_request_id_fkey
      foreign key (request_id) references public.requests(id) on delete set null;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='profiles') then
    alter table public.receipts
      add constraint receipts_client_id_fkey
      foreign key (client_id) references public.profiles(id) on delete set null;
    alter table public.receipts
      add constraint receipts_professional_id_fkey
      foreign key (professional_id) references public.profiles(id) on delete set null;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='offers') then
    alter table public.receipts
      add constraint receipts_offer_id_fkey
      foreign key (offer_id) references public.offers(id) on delete set null;
  end if;
exception when others then null; end $$;

create index if not exists receipts_request_id_idx on public.receipts(request_id);
create index if not exists receipts_client_id_idx on public.receipts(client_id);
create index if not exists receipts_professional_id_idx on public.receipts(professional_id);
create index if not exists receipts_offer_id_idx on public.receipts(offer_id);
create index if not exists receipts_created_at_idx on public.receipts(created_at);

-- Per-line breakdown for traceability
create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null,
  item_type text not null, -- 'service' | 'commission' | 'iva'
  description text null,
  amount_cents bigint not null,
  created_at timestamptz not null default now(),
  constraint receipt_items_item_type_chk check (lower(item_type) in ('service','servicio','commission','comision','comisión','iva','tax')),
  constraint receipt_items_receipt_id_fkey foreign key (receipt_id) references public.receipts(id) on delete cascade
);
create index if not exists receipt_items_receipt_id_idx on public.receipt_items(receipt_id);

-- Compatibility alias in case of misspelling: reciepts -> receipts
create or replace view public.reciepts as select * from public.receipts;

