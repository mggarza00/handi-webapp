-- Índices recomendados para public.agreements

-- Búsquedas/joins por request
create index if not exists agreements_request_id_idx
  on public.agreements(request_id);

-- Búsquedas por profesional
create index if not exists agreements_professional_id_idx
  on public.agreements(professional_id);

-- Filtros por estado
create index if not exists agreements_status_idx
  on public.agreements(status);

-- Listados recientes por solicitud
create index if not exists agreements_request_created_idx
  on public.agreements(request_id, created_at desc);
