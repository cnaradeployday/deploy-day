-- Reconstruido a partir del esquema real de Supabase (no habia archivo en el repo).
-- Funcion has_module_access(): centraliza el chequeo de "admin, o rol personalizado
-- con permiso del modulo" que hasta aca se repetia policy por policy. Se migran las
-- tablas de Contabilidad (menos facturas_clientes, que se resuelve en la migracion
-- del 07/08) para que un rol personalizado con permiso de Contabilidad pueda
-- ver/editar sin ser admin/gerente.

CREATE OR REPLACE FUNCTION public.has_module_access(p_module text, p_level text DEFAULT 'read')
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
    or exists (
      select 1
      from public.users u
      join public.role_permissions rp on rp.role_id = u.custom_role_id
      where u.id = auth.uid()
        and rp.module = p_module
        and (
          (p_level = 'write' and rp.can_write)
          or (p_level = 'read' and rp.can_read)
        )
    );
$function$;

DROP POLICY IF EXISTS facturas_compra_select ON public.facturas_compra;
DROP POLICY IF EXISTS facturas_compra_insert ON public.facturas_compra;
DROP POLICY IF EXISTS facturas_compra_update ON public.facturas_compra;
DROP POLICY IF EXISTS facturas_compra_delete ON public.facturas_compra;
CREATE POLICY facturas_compra_select ON public.facturas_compra FOR SELECT USING (has_module_access('contabilidad','read'));
CREATE POLICY facturas_compra_insert ON public.facturas_compra FOR INSERT WITH CHECK (has_module_access('contabilidad','write'));
CREATE POLICY facturas_compra_update ON public.facturas_compra FOR UPDATE USING (has_module_access('contabilidad','write')) WITH CHECK (has_module_access('contabilidad','write'));
CREATE POLICY facturas_compra_delete ON public.facturas_compra FOR DELETE USING (has_module_access('contabilidad','write'));

DROP POLICY IF EXISTS conciliacion_bancaria_select ON public.conciliacion_bancaria;
DROP POLICY IF EXISTS conciliacion_bancaria_insert ON public.conciliacion_bancaria;
DROP POLICY IF EXISTS conciliacion_bancaria_update ON public.conciliacion_bancaria;
DROP POLICY IF EXISTS conciliacion_bancaria_delete ON public.conciliacion_bancaria;
CREATE POLICY conciliacion_bancaria_select ON public.conciliacion_bancaria FOR SELECT USING (has_module_access('contabilidad','read'));
CREATE POLICY conciliacion_bancaria_insert ON public.conciliacion_bancaria FOR INSERT WITH CHECK (has_module_access('contabilidad','write'));
CREATE POLICY conciliacion_bancaria_update ON public.conciliacion_bancaria FOR UPDATE USING (has_module_access('contabilidad','write')) WITH CHECK (has_module_access('contabilidad','write'));
CREATE POLICY conciliacion_bancaria_delete ON public.conciliacion_bancaria FOR DELETE USING (has_module_access('contabilidad','write'));

DROP POLICY IF EXISTS tarjeta_credito_select ON public.tarjeta_credito;
DROP POLICY IF EXISTS tarjeta_credito_insert ON public.tarjeta_credito;
DROP POLICY IF EXISTS tarjeta_credito_update ON public.tarjeta_credito;
DROP POLICY IF EXISTS tarjeta_credito_delete ON public.tarjeta_credito;
CREATE POLICY tarjeta_credito_select ON public.tarjeta_credito FOR SELECT USING (has_module_access('contabilidad','read'));
CREATE POLICY tarjeta_credito_insert ON public.tarjeta_credito FOR INSERT WITH CHECK (has_module_access('contabilidad','write'));
CREATE POLICY tarjeta_credito_update ON public.tarjeta_credito FOR UPDATE USING (has_module_access('contabilidad','write')) WITH CHECK (has_module_access('contabilidad','write'));
CREATE POLICY tarjeta_credito_delete ON public.tarjeta_credito FOR DELETE USING (has_module_access('contabilidad','write'));

DROP POLICY IF EXISTS plan_cuentas_select ON public.plan_cuentas;
DROP POLICY IF EXISTS plan_cuentas_insert ON public.plan_cuentas;
DROP POLICY IF EXISTS plan_cuentas_update ON public.plan_cuentas;
DROP POLICY IF EXISTS plan_cuentas_delete ON public.plan_cuentas;
CREATE POLICY plan_cuentas_select ON public.plan_cuentas FOR SELECT USING (has_module_access('contabilidad','read'));
CREATE POLICY plan_cuentas_insert ON public.plan_cuentas FOR INSERT WITH CHECK (has_module_access('contabilidad','write'));
CREATE POLICY plan_cuentas_update ON public.plan_cuentas FOR UPDATE USING (has_module_access('contabilidad','write')) WITH CHECK (has_module_access('contabilidad','write'));
CREATE POLICY plan_cuentas_delete ON public.plan_cuentas FOR DELETE USING (has_module_access('contabilidad','write'));

DROP POLICY IF EXISTS plan_cuentas_saldos_select ON public.plan_cuentas_saldos;
DROP POLICY IF EXISTS plan_cuentas_saldos_insert ON public.plan_cuentas_saldos;
DROP POLICY IF EXISTS plan_cuentas_saldos_update ON public.plan_cuentas_saldos;
DROP POLICY IF EXISTS plan_cuentas_saldos_delete ON public.plan_cuentas_saldos;
CREATE POLICY plan_cuentas_saldos_select ON public.plan_cuentas_saldos FOR SELECT USING (has_module_access('contabilidad','read'));
CREATE POLICY plan_cuentas_saldos_insert ON public.plan_cuentas_saldos FOR INSERT WITH CHECK (has_module_access('contabilidad','write'));
CREATE POLICY plan_cuentas_saldos_update ON public.plan_cuentas_saldos FOR UPDATE USING (has_module_access('contabilidad','write')) WITH CHECK (has_module_access('contabilidad','write'));
CREATE POLICY plan_cuentas_saldos_delete ON public.plan_cuentas_saldos FOR DELETE USING (has_module_access('contabilidad','write'));

DROP POLICY IF EXISTS documentos_ia_importados_select ON public.documentos_ia_importados;
DROP POLICY IF EXISTS documentos_ia_importados_insert ON public.documentos_ia_importados;
DROP POLICY IF EXISTS documentos_ia_importados_update ON public.documentos_ia_importados;
DROP POLICY IF EXISTS documentos_ia_importados_delete ON public.documentos_ia_importados;
CREATE POLICY documentos_ia_importados_select ON public.documentos_ia_importados FOR SELECT USING (has_module_access('contabilidad','read'));
CREATE POLICY documentos_ia_importados_insert ON public.documentos_ia_importados FOR INSERT WITH CHECK (has_module_access('contabilidad','write'));
CREATE POLICY documentos_ia_importados_update ON public.documentos_ia_importados FOR UPDATE USING (has_module_access('contabilidad','write')) WITH CHECK (has_module_access('contabilidad','write'));
CREATE POLICY documentos_ia_importados_delete ON public.documentos_ia_importados FOR DELETE USING (has_module_access('contabilidad','write'));
