-- Reconstruido a partir del esquema real de Supabase (no habia archivo en el repo).
-- Registro de importaciones por IA (PDF -> registros de Contabilidad): que archivo
-- se subio, a que seccion pertenece y cuantos registros genero.

CREATE TABLE public.documentos_ia_importados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seccion text NOT NULL CHECK (seccion = ANY (ARRAY[
    'facturas_compra','facturas_clientes','tarjeta_credito',
    'fondo_comun_inversion','conciliacion_bancaria'
  ])),
  archivo_nombre text NOT NULL,
  archivo_path text NOT NULL,
  cantidad_registros integer,
  referencia_id uuid,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documentos_ia_importados ENABLE ROW LEVEL SECURITY;

CREATE POLICY documentos_ia_importados_select ON public.documentos_ia_importados
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY documentos_ia_importados_insert ON public.documentos_ia_importados
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY documentos_ia_importados_update ON public.documentos_ia_importados
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY documentos_ia_importados_delete ON public.documentos_ia_importados
  FOR DELETE USING (auth.uid() IS NOT NULL);

INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-ia', 'documentos-ia', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY documentos_ia_files_select ON storage.objects
  FOR SELECT USING (bucket_id = 'documentos-ia' AND auth.uid() IS NOT NULL);

CREATE POLICY documentos_ia_files_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documentos-ia' AND auth.uid() IS NOT NULL);

CREATE POLICY documentos_ia_files_update ON storage.objects
  FOR UPDATE USING (bucket_id = 'documentos-ia' AND auth.uid() IS NOT NULL);

CREATE POLICY documentos_ia_files_delete ON storage.objects
  FOR DELETE USING (bucket_id = 'documentos-ia' AND auth.uid() IS NOT NULL);
