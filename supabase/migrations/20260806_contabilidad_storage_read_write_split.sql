-- Reconstruido a partir del esquema real de Supabase (no habia archivo en el repo).
-- Separa las politicas de storage de los buckets de Contabilidad en read/write
-- via has_module_access(), en linea con la migracion de RLS del mismo dia.

DROP POLICY IF EXISTS facturas_compra_files_select ON storage.objects;
DROP POLICY IF EXISTS facturas_compra_files_insert ON storage.objects;
DROP POLICY IF EXISTS facturas_compra_files_update ON storage.objects;
DROP POLICY IF EXISTS facturas_compra_files_delete ON storage.objects;
CREATE POLICY facturas_compra_files_select ON storage.objects FOR SELECT USING (bucket_id = 'facturas-compra' AND has_module_access('contabilidad','read'));
CREATE POLICY facturas_compra_files_insert ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'facturas-compra' AND has_module_access('contabilidad','write'));
CREATE POLICY facturas_compra_files_update ON storage.objects FOR UPDATE USING (bucket_id = 'facturas-compra' AND has_module_access('contabilidad','write')) WITH CHECK (bucket_id = 'facturas-compra' AND has_module_access('contabilidad','write'));
CREATE POLICY facturas_compra_files_delete ON storage.objects FOR DELETE USING (bucket_id = 'facturas-compra' AND has_module_access('contabilidad','write'));

DROP POLICY IF EXISTS documentos_ia_files_select ON storage.objects;
DROP POLICY IF EXISTS documentos_ia_files_insert ON storage.objects;
DROP POLICY IF EXISTS documentos_ia_files_update ON storage.objects;
DROP POLICY IF EXISTS documentos_ia_files_delete ON storage.objects;
CREATE POLICY documentos_ia_files_select ON storage.objects FOR SELECT USING (bucket_id = 'documentos-ia' AND has_module_access('contabilidad','read'));
CREATE POLICY documentos_ia_files_insert ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documentos-ia' AND has_module_access('contabilidad','write'));
CREATE POLICY documentos_ia_files_update ON storage.objects FOR UPDATE USING (bucket_id = 'documentos-ia' AND has_module_access('contabilidad','write')) WITH CHECK (bucket_id = 'documentos-ia' AND has_module_access('contabilidad','write'));
CREATE POLICY documentos_ia_files_delete ON storage.objects FOR DELETE USING (bucket_id = 'documentos-ia' AND has_module_access('contabilidad','write'));
