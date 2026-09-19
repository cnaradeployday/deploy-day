-- Reconstruido a partir del esquema real de Supabase (no habia archivo en el repo).
-- Comentario libre por consumo, mes del resumen al que pertenece y tipo de cambio
-- usado para convertir consumos en USD a pesos.

ALTER TABLE public.tarjeta_credito ADD COLUMN IF NOT EXISTS comentarios text;
ALTER TABLE public.tarjeta_credito ADD COLUMN IF NOT EXISTS mes_resumen text;
ALTER TABLE public.tarjeta_credito ADD COLUMN IF NOT EXISTS tipo_cambio numeric;
