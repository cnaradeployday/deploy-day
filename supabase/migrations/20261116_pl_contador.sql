-- Ajustes para que el P&L coincida con el criterio del contador (Registros contables SAS):
--  * facturas_compra.mes_servicio: mes al que se imputa el gasto (si es null, el de la fecha de la factura).
--  * tipos_gasto.fuente: de dónde sale el gasto de cada rubro en el P&L (facturas, tarjeta o ambas).
--  * cuentas manuales nuevas del P&L y cuentas que pasan a cargarse a mano.

ALTER TABLE public.facturas_compra ADD COLUMN IF NOT EXISTS mes_servicio text;
COMMENT ON COLUMN public.facturas_compra.mes_servicio IS 'YYYY-MM al que se imputa el gasto en el P&L; null = mes de fecha_factura';

ALTER TABLE public.tipos_gasto ADD COLUMN IF NOT EXISTS fuente text NOT NULL DEFAULT 'facturas';
ALTER TABLE public.tipos_gasto DROP CONSTRAINT IF EXISTS tipos_gasto_fuente_check;
ALTER TABLE public.tipos_gasto ADD CONSTRAINT tipos_gasto_fuente_check CHECK (fuente IN ('facturas', 'tarjeta', 'ambas'));
COMMENT ON COLUMN public.tipos_gasto.fuente IS 'Origen del gasto en el P&L: facturas de compra, cargos de tarjeta (solapa Ctas de gastos/PL) o ambas';

UPDATE public.tipos_gasto SET fuente = 'ambas'   WHERE nombre = 'Gtos de representacion - Meals';
UPDATE public.tipos_gasto SET fuente = 'tarjeta' WHERE nombre IN ('Licencias', 'Traslados', 'Hotel');

-- Cuentas del P&L sin dato en el sistema: se cargan a mano mes a mes.
UPDATE public.plan_cuentas SET origen = 'manual'
 WHERE categoria = 'resultado' AND nombre IN ('Retencion P&G prov BsAs IIBB', 'Gtos de Inscripcion SAS');

INSERT INTO public.plan_cuentas (categoria, subcategoria, nombre, orden, origen, codigo)
SELECT 'resultado', 'Gastos operativos', 'Otros no identificados', 23, 'manual', 524
 WHERE NOT EXISTS (SELECT 1 FROM public.plan_cuentas WHERE categoria = 'resultado' AND nombre = 'Otros no identificados');
INSERT INTO public.plan_cuentas (categoria, subcategoria, nombre, orden, origen, codigo)
SELECT 'resultado', 'Otros resultados', 'Diferencia de cambio', 5, 'manual', 405
 WHERE NOT EXISTS (SELECT 1 FROM public.plan_cuentas WHERE categoria = 'resultado' AND nombre = 'Diferencia de cambio');

-- Rubros cuyas facturas incluyen impuestos no recuperables como parte del gasto (ej. impuestos a los combustibles).
ALTER TABLE public.tipos_gasto ADD COLUMN IF NOT EXISTS incluye_otros_impuestos boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.tipos_gasto.incluye_otros_impuestos IS 'true = el gasto de la factura incluye otros_impuestos no recuperables (ej. impuestos a los combustibles)';
UPDATE public.tipos_gasto SET incluye_otros_impuestos = true WHERE nombre = 'Combustible';
