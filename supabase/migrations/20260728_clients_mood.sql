ALTER TABLE clients ADD COLUMN mood text CHECK (mood = ANY (ARRAY['muy_feliz'::text, 'feliz'::text, 'neutral'::text, 'enojado'::text, 'muy_enojado'::text]));
COMMENT ON COLUMN clients.mood IS 'Humor del cliente, cargado y actualizado a mano. Se ve en Resumen del mes.';
