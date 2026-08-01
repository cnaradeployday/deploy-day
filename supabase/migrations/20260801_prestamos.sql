-- Modulo Contable (Fase 5): Prestamos y devengamiento mensual de intereses.
CREATE TABLE prestamos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acreedor text,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  plazo_meses integer NOT NULL,
  moneda text NOT NULL DEFAULT 'ARS',
  monto numeric NOT NULL,
  tasa_interes_anual numeric NOT NULL,
  notas text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE prestamos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prestamos_admin_only" ON prestamos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role)
  );

CREATE TABLE prestamo_devengamientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestamo_id uuid NOT NULL REFERENCES prestamos(id) ON DELETE CASCADE,
  mes date NOT NULL,
  monto numeric NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prestamo_id, mes)
);

ALTER TABLE prestamo_devengamientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prestamo_devengamientos_admin_only" ON prestamo_devengamientos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role)
  );
