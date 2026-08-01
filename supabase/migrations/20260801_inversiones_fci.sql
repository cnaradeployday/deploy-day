-- Modulo Contable (Fase 6): Inversiones - Fondo Comun de Inversion.
CREATE TABLE inversiones_fci_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  operacion text NOT NULL CHECK (operacion IN ('SUSCRIPCION', 'RESCATE')),
  cantidad_cuotas numeric NOT NULL,
  tc_fondo numeric NOT NULL,
  monto numeric NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inversiones_fci_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inversiones_fci_movimientos_admin_only" ON inversiones_fci_movimientos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role)
  );

CREATE TABLE inversiones_fci_cierres_mensuales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes date NOT NULL UNIQUE,
  tc_fondo numeric NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inversiones_fci_cierres_mensuales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inversiones_fci_cierres_mensuales_admin_only" ON inversiones_fci_cierres_mensuales
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role)
  );
