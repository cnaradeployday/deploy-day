-- Agregar fecha de vencimiento y cliente a post-its
ALTER TABLE postits ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE postits ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
