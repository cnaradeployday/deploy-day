-- Run this in the Supabase SQL editor to enable the Performance equipo feature
CREATE TABLE IF NOT EXISTS performance_reviews (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month       TEXT NOT NULL,  -- format: 'YYYY-MM'
  creatividad  SMALLINT CHECK (creatividad  BETWEEN 1 AND 5),
  facturacion  SMALLINT CHECK (facturacion  BETWEEN 1 AND 5),
  velocidad    SMALLINT CHECK (velocidad    BETWEEN 1 AND 5),
  predisposicion SMALLINT CHECK (predisposicion BETWEEN 1 AND 5),
  conocimiento SMALLINT CHECK (conocimiento BETWEEN 1 AND 5),
  calidad      SMALLINT CHECK (calidad      BETWEEN 1 AND 5),
  reviewed_by  UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, month)
);

ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON performance_reviews
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
