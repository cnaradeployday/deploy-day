-- CRM: seguimiento de prospectos en proceso de cotizacion (modulo de Prospectacion)

CREATE TABLE prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Cliente: existente (vinculado) o alta rapida de un prospecto nuevo
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  prospect_name text NOT NULL,
  contact_email text,
  contact_phone text,

  -- Pipeline
  stage text NOT NULL DEFAULT 'contacto_inicial'
    CHECK (stage IN ('contacto_inicial', 'reunion_relevamiento', 'cotizacion_enviada', 'negociacion', 'ganado', 'perdido')),
  probability int NOT NULL DEFAULT 10 CHECK (probability BETWEEN 0 AND 100),
  expected_close_date date,
  service_type service_type NOT NULL DEFAULT 'otro',
  source text,
  responsible_id uuid REFERENCES users(id),
  next_action text,
  next_action_date date,
  lost_reason text,
  notes text,

  -- Valor del deal cotizado
  currency text NOT NULL DEFAULT 'ARS' CHECK (currency IN ('ARS', 'USD')),
  one_shot_amount numeric,
  monthly_fee numeric,
  estimated_months int,
  estimated_hours numeric,
  hourly_rate_service numeric,

  -- Costo de armar la cotizacion (para ROI de horas cotizando)
  quoting_hours numeric,
  quoting_hourly_rate numeric,

  won_at timestamptz,
  lost_at timestamptz,

  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prospects_stage ON prospects(stage);
CREATE INDEX idx_prospects_client_id ON prospects(client_id);
CREATE INDEX idx_prospects_responsible_id ON prospects(responsible_id);

CREATE TRIGGER trg_prospects_updated_at
  BEFORE UPDATE ON prospects
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prospects_select" ON prospects
  FOR SELECT USING (has_module_access('crm', 'read'));

CREATE POLICY "prospects_insert" ON prospects
  FOR INSERT WITH CHECK (has_module_access('crm', 'write'));

CREATE POLICY "prospects_update" ON prospects
  FOR UPDATE USING (has_module_access('crm', 'write'))
  WITH CHECK (has_module_access('crm', 'write'));

CREATE POLICY "prospects_delete" ON prospects
  FOR DELETE USING (has_module_access('crm', 'write'));
