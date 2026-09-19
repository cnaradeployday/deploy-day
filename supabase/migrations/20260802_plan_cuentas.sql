-- Reconstruido a partir del esquema real de Supabase (no habia archivo en el repo).
-- Plan de cuentas contable (activo/pasivo/patrimonio neto/resultado) y sus saldos
-- mensuales, base de Balance Sheet y Estado de Resultados.

CREATE TABLE public.plan_cuentas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL CHECK (categoria = ANY (ARRAY['activo','pasivo','patrimonio_neto','resultado'])),
  subcategoria text,
  nombre text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.plan_cuentas_saldos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id uuid NOT NULL REFERENCES public.plan_cuentas(id) ON DELETE CASCADE,
  periodo date NOT NULL,
  monto numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cuenta_id, periodo)
);

ALTER TABLE public.plan_cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_cuentas_saldos ENABLE ROW LEVEL SECURITY;

CREATE POLICY plan_cuentas_select ON public.plan_cuentas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY plan_cuentas_insert ON public.plan_cuentas FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY plan_cuentas_update ON public.plan_cuentas FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY plan_cuentas_delete ON public.plan_cuentas FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY plan_cuentas_saldos_select ON public.plan_cuentas_saldos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY plan_cuentas_saldos_insert ON public.plan_cuentas_saldos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY plan_cuentas_saldos_update ON public.plan_cuentas_saldos FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY plan_cuentas_saldos_delete ON public.plan_cuentas_saldos FOR DELETE USING (auth.uid() IS NOT NULL);
