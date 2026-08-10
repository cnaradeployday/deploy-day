-- Modulo Contable (Fase 1): sociedad + IVA por factura de cliente.
-- clients.razon_social: nombre legal del cliente, separado de "company" (nombre comercial).
ALTER TABLE clients ADD COLUMN razon_social text;

-- facturas_clientes: sociedad que emite (SAS/LLC/MONO), CUIT snapshot y desglose neto/IVA.
-- Se agregan nullable primero para poder backfillear antes de exigir NOT NULL en sociedad.
ALTER TABLE facturas_clientes
  ADD COLUMN sociedad text CHECK (sociedad = ANY (ARRAY['SAS'::text, 'LLC'::text, 'MONO'::text])),
  ADD COLUMN cuit text,
  ADD COLUMN iva_pct numeric,
  ADD COLUMN importe_neto numeric,
  ADD COLUMN importe_iva numeric;

-- Backfill: sociedad y CUIT tomados del cliente vinculado a cada factura existente.
-- empresa_cobra del cliente usa MON/OTR; en la factura el dropdown pedido es SAS/LLC/MONO.
UPDATE facturas_clientes fc
SET sociedad = CASE c.empresa_cobra WHEN 'SAS' THEN 'SAS' WHEN 'LLC' THEN 'LLC' ELSE 'MONO' END,
    cuit = c.cuit
FROM clients c
WHERE c.id = fc.client_id AND fc.sociedad IS NULL;

ALTER TABLE facturas_clientes ALTER COLUMN sociedad SET DEFAULT 'MONO';
ALTER TABLE facturas_clientes ALTER COLUMN sociedad SET NOT NULL;
