CREATE TABLE IF NOT EXISTS postit_shares (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  postit_id uuid REFERENCES postits(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  shared_by_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  seen_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(postit_id, user_id)
);

ALTER TABLE postit_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own shares" ON postit_shares
  FOR SELECT USING (user_id = auth.uid() OR shared_by_id = auth.uid());

CREATE POLICY "users can share" ON postit_shares
  FOR INSERT WITH CHECK (shared_by_id = auth.uid());

CREATE POLICY "users can mark seen" ON postit_shares
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "owner can delete shares" ON postit_shares
  FOR DELETE USING (shared_by_id = auth.uid());
