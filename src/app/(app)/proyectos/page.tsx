import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Pencil } from 'lucide-react'
import ProyectosClient from './ProyectosClient'

export default async function ProyectosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('users').select('role, custom_role_id').eq('id', user?.id ?? '').single()

  const isAdmin = ['admin', 'gerente_operaciones'].includes(profile?.role ?? '')
  let canDelete = isAdmin
  if (!canDelete && profile?.custom_role_id) {
    const { data: perm } = await supabase
      .from('role_permissions').select('can_delete')
      .eq('role_id', profile.custom_role_id).eq('module', 'proyectos').single()
    canDelete = perm?.can_delete ?? false
  }

  const { data: proyectos } = await supabase
    .from('projects')
    .select('id, name, service_type, sold_hours, is_active, start_date, end_date, client:clients(id, name)')
    .order('name')

  const clientes = [...new Map(
    (proyectos ?? []).map(p => [(p.client as any)?.id, p.client])
  ).values()].filter(Boolean) as any[]

  return (
    <ProyectosClient
      proyectos={proyectos ?? []}
      clientes={clientes}
      isAdmin={isAdmin}
      canDelete={canDelete}
    />
  )
}
