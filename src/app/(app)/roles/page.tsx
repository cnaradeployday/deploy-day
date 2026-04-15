import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RolesClient from './RolesClient'

const MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'proyectos', label: 'Proyectos' },
  { key: 'tareas', label: 'Tareas' },
  { key: 'mis_tareas', label: 'Mis tareas' },
  { key: 'chat', label: 'Chat' },
  { key: 'reportes_tareas', label: 'Reportes — Estado de tareas' },
  { key: 'reportes_horas', label: 'Reportes — Horas por proyecto' },
  { key: 'reportes_ocupacion', label: 'Reportes — Ocupación' },
  { key: 'reportes_rentabilidad', label: 'Reportes — Rentabilidad' },
  { key: 'solicitudes', label: 'Solicitudes de horas' },
  { key: 'liquidaciones', label: 'Liquidaciones' },
  { key: 'facturas_clientes', label: 'Facturas clientes' },
  { key: 'cotizaciones', label: 'Cotizaciones USD' },
  { key: 'equipo', label: 'Equipo' },
  { key: 'roles', label: 'Roles y permisos' },
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
