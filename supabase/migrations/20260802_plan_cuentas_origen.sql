-- Reconstruido a partir del esquema real de Supabase (no habia archivo en el repo).
-- Distingue cuentas creadas a mano de las generadas automaticamente por el
-- sistema (ej. a partir de facturas, tarjeta de credito, IVA) para no dejarlas
-- editar/borrar libremente desde la UI.

ALTER TABLE public.plan_cuentas ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'manual'
  CHECK (origen = ANY (ARRAY['manual','auto']));
