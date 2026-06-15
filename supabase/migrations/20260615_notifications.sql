CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  metadata jsonb DEFAULT '{}',
  read_at timestamptz,
  dedup_key text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS notifications_user_created ON notifications(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedup ON notifications(user_id, dedup_key) WHERE dedup_key IS NOT NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());
