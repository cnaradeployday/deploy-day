import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RolesClient from './RolesClient'

const MODULES = [
  { key: 'dashboard',             label: 'Dashboard' },
  { key: 'clientes',              label: 'Clientes' },
  { key: 'proyectos',             label: 'Proyectos' },
  { key: 'proyectos_mes',         label: 'Proyectos del mes' },
  { key: 'tareas',                label: 'Tareas' },
  { key: 'crear_tareas',          label: 'Crear tareas' },
  { key: 'mis_tareas',            label: 'Mis tareas' },
  { key: 'ver_horas_estimadas_mis_tareas', label: 'Ver horas estimadas en Mis tareas' },
  { key: 'mis_horas',             label: 'Mis horas' },
  { key: 'cronometros',           label: 'Cronómetros activos' },
  { key: 'chat',                  label: 'Chat' },
  { key: 'mi_pizarra',            label: 'Mi pizarra' },
  { key: 'pizarron',              label: 'Pizarrón' },
  { key: 'resumen_mes',           label: 'Resumen del mes' },
  { key: 'reportes_tareas',       label: 'Reportes — Estado de tareas' },
  { key: 'reportes_horas',        label: 'Reportes — Horas por proyecto' },
  { key: 'reportes_ocupacion',    label: 'Reportes — Ocupación' },
  { key: 'reportes_rentabilidad', label: 'Reportes — Rentabilidad' },
  { key: 'solicitudes',           label: 'Solicitudes de horas' },
  { key: 'facturacion',           label: 'Facturación' },
  { key: 'liquidaciones',         label: 'Liquidaciones' },
  { key: 'facturas_clientes',     label: 'Facturas clientes' },
  { key: 'resumen_facturas',      label: 'Resumen facturas' },
  { key: 'cotizaciones',          label: 'Cotizaciones USD' },
  { key: 'equipo',                label: 'Equipo' },
  { key: 'roles',                 label: 'Roles y permisos' },
  { key: 'logs',                  label: 'Logs de actividad' },
  { key: 'ocupacion_equipo',      label: 'Ocupación del equipo' },
  { key: 'cargar_horas_otros',    label: 'Cargar horas en nombre de otros' },
  { key: 'online_users',          label: 'Ver usuarios online' },
  { key: 'news',                  label: 'Anuncios (crear/gestionar)' },
]

export default async function RolesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: roles } = await supabase.from('roles').select('*').order('created_at')
  const { data: permissions } = await supabase.from('role_permissions').select('*')
  const { data: users } = await supabase.from('users').select('id, full_name, role, custom_role_id').order('full_name')

  return (
    <RolesClient
      roles={roles ?? []}
      permissions={permissions ?? []}
      modules={MODULES}
      users={users ?? []}
    />
  )
}
