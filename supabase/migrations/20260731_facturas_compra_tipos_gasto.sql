-- Modulo Contable (Fase 2): Tipos de gasto (ABM) y Facturas de compra.

CREATE TABLE tipos_gasto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  nombre text NOT NULL,
  descripcion text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tipos_gasto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipos_gasto_admin_only" ON tipos_gasto
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role)
  );

INSERT INTO tipos_gasto (numero, nombre) VALUES
  ('1',  'Contrators - Servicios profesionales'),
  ('2',  'Contractors - CEO'),
  ('3',  'Gtos de representacion - Meals'),
  ('4',  'Calcos'),
  ('5',  'Licencias'),
  ('6',  'Combustible'),
  ('7',  'Bicicleta'),
  ('8',  'Monitor'),
  ('9',  'Proyector'),
  ('10', 'Pasajes'),
  ('11', 'Hotel'),
  ('12', 'Traslados'),
  ('13', 'Alquiler de oficina'),
  ('14', 'Reparacion y mantenimiento'),
  ('15', 'Mantenimiento de auto'),
  ('16', 'Silla'),
  ('17', 'Honorarios contables/impositivos'),
  ('18', 'Impuesto Deb y Cred (perdida)'),
  ('19', 'Ingresos Brutos'),
  ('20', 'Retencion P&G prov BsAs IIBB'),
  ('21', 'Comisiones bancarias'),
  ('22', 'Gtos de Inscripcion SAS');

CREATE TABLE facturas_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cuit text NOT NULL,
  numero_factura text NOT NULL,
  fecha_factura date NOT NULL,
  razon_social_proveedor text NOT NULL,
  fecha_pago date,
  monto_neto numeric NOT NULL DEFAULT 0,
  iva numeric NOT NULL DEFAULT 0,
  iibb numeric NOT NULL DEFAULT 0,
  otros_impuestos numeric NOT NULL DEFAULT 0,
  monto_total numeric GENERATED ALWAYS AS (monto_neto + iva + iibb + otros_impuestos) STORED,
  tipo_gasto_id uuid REFERENCES tipos_gasto(id),
  archivo_path text,
  archivo_nombre text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE facturas_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facturas_compra_admin_only" ON facturas_compra
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role)
  );

-- Bucket dedicado para adjuntos de facturas de compra (privado, solo admin).
INSERT INTO storage.buckets (id, name, public) VALUES ('facturas-compra', 'facturas-compra', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "facturas_compra_files_admin" ON storage.objects
  FOR ALL USING (
    bucket_id = 'facturas-compra' AND EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role
    )
  );
