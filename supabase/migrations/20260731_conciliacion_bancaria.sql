-- Modulo Contable (Fase 3): ABM Extractos bancarios (descripcion <-> clasificacion) y Conciliacion bancaria.

CREATE TABLE banco_clasificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descripcion text NOT NULL UNIQUE,
  clasificacion text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE banco_clasificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "banco_clasificaciones_admin_only" ON banco_clasificaciones
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role)
  );

CREATE TABLE conciliacion_bancaria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  descripcion text NOT NULL,
  credito_debito numeric NOT NULL,
  saldo numeric NOT NULL,
  clasificacion_id uuid REFERENCES banco_clasificaciones(id),
  clasificacion text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE conciliacion_bancaria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conciliacion_bancaria_admin_only" ON conciliacion_bancaria
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role)
  );
