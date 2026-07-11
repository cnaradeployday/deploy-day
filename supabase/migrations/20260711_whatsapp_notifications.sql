-- Notificaciones por WhatsApp (Fases 1, 2 y 5 del spec).
-- Fase 3 (envío real vía Twilio) y Fase 4 (webhook de estado) quedan pendientes:
-- esta migración solo deja la cola y las preferencias de usuario listas.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS whatsapp_phone text,
  ADD COLUMN IF NOT EXISTS whatsapp_country_code text,
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_notification_types text[] NOT NULL DEFAULT '{}';

CREATE TABLE public.whatsapp_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.users(id),
  phone text NOT NULL,
  event_type text NOT NULL,
  template_name text NOT NULL,
  template_vars jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pendiente'
    CHECK (status = ANY (ARRAY['pendiente','procesando','enviada','entregada','leida','fallida','cancelada'])),
  dedup_key text,
  twilio_message_id text,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE UNIQUE INDEX idx_whatsapp_notifications_dedup ON public.whatsapp_notifications(dedup_key) WHERE dedup_key IS NOT NULL;
CREATE INDEX idx_whatsapp_notifications_status ON public.whatsapp_notifications(status);
CREATE INDEX idx_whatsapp_notifications_user ON public.whatsapp_notifications(user_id);

ALTER TABLE public.whatsapp_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY whatsapp_notifications_admin_select ON public.whatsapp_notifications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ANY (ARRAY['admin'::user_role,'gerente_operaciones'::user_role]))
  );
