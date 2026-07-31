-- Modulo Contable (Fase 4): Tarjeta de credito.
CREATE TABLE tarjeta_credito (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  proveedor text NOT NULL,
  cuota text,
  tipo_gasto_id uuid REFERENCES tipos_gasto(id),
  clasificacion text,
  pesos numeric,
  dolares numeric,
  comprobante text,
  solapa text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tarjeta_credito ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tarjeta_credito_admin_only" ON tarjeta_credito
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role)
  );
