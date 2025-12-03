-- Crear tabla de alertas para notificar al cliente cuando llegue el primer profesional
CREATE TABLE IF NOT EXISTS public.request_pro_alerts (
  request_id uuid PRIMARY KEY REFERENCES public.requests (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  city text,
  category text,
  subcategory text,
  subcategories jsonb DEFAULT '[]'::jsonb,
  request_title text,
  created_at timestamptz DEFAULT now(),
  last_checked_at timestamptz,
  notified_at timestamptz,
  first_professional_id uuid,
  first_professional_snapshot jsonb
);

CREATE INDEX IF NOT EXISTS idx_request_pro_alerts_user ON public.request_pro_alerts (user_id);

ALTER TABLE public.request_pro_alerts ENABLE ROW LEVEL SECURITY;

-- RLS: solo el dueño de la solicitud puede gestionar su alerta
DROP POLICY IF EXISTS request_pro_alerts_owner_manage ON public.request_pro_alerts;
CREATE POLICY request_pro_alerts_owner_manage
  ON public.request_pro_alerts
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON TABLE public.request_pro_alerts TO anon;
GRANT ALL ON TABLE public.request_pro_alerts TO authenticated;
GRANT ALL ON TABLE public.request_pro_alerts TO service_role;
