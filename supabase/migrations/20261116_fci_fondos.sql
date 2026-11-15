-- Fondo Común de Inversión con más de un fondo: cada movimiento y cada TC de cierre pertenece a un fondo
-- (Fima Premium o Fima Ahorro Pesos), porque tienen valores de cuota distintos y no se pueden mezclar.

ALTER TABLE public.inversiones_fci_movimientos
  ADD COLUMN IF NOT EXISTS fondo text NOT NULL DEFAULT 'Fima Premium';

-- Los movimientos con valor de cuota ~$83–86 (desde agosto 2026) son de Fima Ahorro Pesos; el resto, Fima Premium.
UPDATE public.inversiones_fci_movimientos SET fondo = 'Fima Ahorro Pesos' WHERE tc_fondo < 300;

ALTER TABLE public.inversiones_fci_cierres_mensuales
  ADD COLUMN IF NOT EXISTS fondo text NOT NULL DEFAULT 'Fima Premium';

-- La TC de cierre pasa a ser única por mes y fondo (antes, solo por mes).
ALTER TABLE public.inversiones_fci_cierres_mensuales DROP CONSTRAINT IF EXISTS inversiones_fci_cierres_mensuales_mes_key;
ALTER TABLE public.inversiones_fci_cierres_mensuales
  ADD CONSTRAINT inversiones_fci_cierres_mensuales_mes_fondo_key UNIQUE (mes, fondo);
