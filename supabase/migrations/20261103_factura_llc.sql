-- Modulo "+ Factura LLC": datos de facturacion del cliente (bloque BILL TO) y
-- el detalle + PDF de cada factura emitida por DEPLOY DAY LLC.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS direccion_facturacion text,
  ADD COLUMN IF NOT EXISTS id_fiscal text,
  ADD COLUMN IF NOT EXISTS id_fiscal_label text NOT NULL DEFAULT 'Ruc';

ALTER TABLE public.facturas_clientes
  ADD COLUMN IF NOT EXISTS factura_llc jsonb,
  ADD COLUMN IF NOT EXISTS archivo_path text;
