-- Modulo Contable: Inversiones - Plazo fijo (ABM: alta, edicion y baja).
CREATE TABLE inversiones_plazo_fijo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad text NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_vencimiento date NOT NULL,
  monto numeric NOT NULL,
  tna numeric NOT NULL,
  monto_vencimiento numeric,
  estado text NOT NULL DEFAULT 'VIGENTE' CHECK (estado IN ('VIGENTE', 'RENOVADO', 'CANCELADO')),
  notas text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inversiones_plazo_fijo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inversiones_plazo_fijo_select" ON inversiones_plazo_fijo
  FOR SELECT USING (has_module_access('contabilidad', 'read'));

CREATE POLICY "inversiones_plazo_fijo_insert" ON inversiones_plazo_fijo
  FOR INSERT WITH CHECK (has_module_access('contabilidad', 'write'));

CREATE POLICY "inversiones_plazo_fijo_update" ON inversiones_plazo_fijo
  FOR UPDATE USING (has_module_access('contabilidad', 'write'))
  WITH CHECK (has_module_access('contabilidad', 'write'));

CREATE POLICY "inversiones_plazo_fijo_delete" ON inversiones_plazo_fijo
  FOR DELETE USING (has_module_access('contabilidad', 'write'));
