-- facturas_clientes seguia con la politica admin-only original y quedo afuera
-- cuando el resto de las tablas de Contabilidad (facturas_compra, tarjeta_credito,
-- plan_cuentas, prestamos, etc.) pasaron a usar has_module_access(). Un usuario
-- con rol personalizado con permiso de Contabilidad (ej. "Contador") ve las
-- paginas (Subdiario de Cliente, Balance Sheet, P&L) pero no las facturas, porque
-- el SELECT se bloqueaba en RLS antes de llegar a la UI.

DROP POLICY IF EXISTS "facturas_clientes_admin_only" ON facturas_clientes;

CREATE POLICY "facturas_clientes_select" ON facturas_clientes
  FOR SELECT USING (has_module_access('contabilidad', 'read'));

CREATE POLICY "facturas_clientes_insert" ON facturas_clientes
  FOR INSERT WITH CHECK (has_module_access('contabilidad', 'write'));

CREATE POLICY "facturas_clientes_update" ON facturas_clientes
  FOR UPDATE USING (has_module_access('contabilidad', 'write'))
  WITH CHECK (has_module_access('contabilidad', 'write'));

CREATE POLICY "facturas_clientes_delete" ON facturas_clientes
  FOR DELETE USING (has_module_access('contabilidad', 'write'));
