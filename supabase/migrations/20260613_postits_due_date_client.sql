-- Agregar fecha de vencimiento y cliente a post-its
ALTER TABLE postits ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE postits ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

-- Poner fecha de vencimiento 15/06/2026 a todos los post-its existentes
UPDATE postits SET due_date = '2026-06-15' WHERE due_date IS NULL;
