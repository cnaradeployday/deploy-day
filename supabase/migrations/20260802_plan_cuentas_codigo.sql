-- Reconstruido a partir del esquema real de Supabase (no habia archivo en el repo).
-- Codigo numerico de cuenta (ej. 101 Banco, 401 Ventas) para ordenar y
-- referenciar el plan de cuentas en Balance Sheet / Estado de Resultados.

ALTER TABLE public.plan_cuentas ADD COLUMN IF NOT EXISTS codigo integer;
ALTER TABLE public.plan_cuentas ADD CONSTRAINT plan_cuentas_codigo_unique UNIQUE (codigo);
ALTER TABLE public.plan_cuentas ALTER COLUMN codigo SET NOT NULL;
