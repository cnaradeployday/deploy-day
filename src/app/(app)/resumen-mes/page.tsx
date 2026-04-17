import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ResumenMesClient from './ResumenMesClient'

export default async function ResumenMesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('role, custom_role_id').eq('id', user.id).single()

  const isAdmin = ['admin', 'gerente_operaciones'].includes(profile?.role ?? '')
  let canAccess = isAdmin
  if (!canAccess && profile?.custom_role_id) {
    const { data: perm } = await supabase
      .from('role_permissions').select('can_read')
      .eq('role_id', profile.custom_role_id).eq('module', 'resumen_mes').single()
    canAccess = perm?.can_read ?? false
  }
  if (!canAccess) redirect('/dashboard')

  const sp = await searchParams
  const mesActual = new Date().toISOString().slice(0, 7)
  const mes = sp.mes ?? mesActual
  const filterCliente = sp.cliente ?? ''

  const [anio, mesNum] = mes.split('-').map(Number)
  const desde = new Date(anio, mesNum - 1, 1).toISOString().split('T')[0]
  const hasta = new Date(anio, mesNum, 0).toISOString().split('T')[0]

  const { data: proyectos } = await supabase
    .from('projects')
    .select('id, name, sold_hours, client:clients(id, name)')
    .eq('is_active', true)
    .order('name')

  const proyectoIds = (proyectos ?? []).map(p => p.id)
  const { data: tareas } = proyectoIds.length
    ? await supabase.from('tasks').select('id, estimated_hours, project_id').in('project_id', proyectoIds)
    : { data: [] }

  const taskIds = (tareas ?? []).map(t => t.id)
  const { data: entries } = taskIds.length
    ? await supabase.from('time_entries').select('task_id, hours_logged')
        .in('task_id', taskIds).gte('entry_date', desde).lte('entry_date', hasta)
    : { data: [] }

  const clientes = [...new Map(
    (proyectos ?? []).map(p => [(p.client as any)?.id, p.client])
  ).values()].filter(Boolean) as any[]

  const horasEstimadasPorProyecto: Record<string, number> = {}
  ;(tareas ?? []).forEach(t => {
    horasEstimadasPorProyecto[t.project_id] = (horasEstimadasPorProyecto[t.project_id] ?? 0) + (t.estimated_hours ?? 0)
  })

  const consumidoPorTask: Record<string, number> = {}
  ;(entries ?? []).forEach(e => {
    consumidoPorTask[e.task_id] = (consumidoPorTask[e.task_id] ?? 0) + e.hours_logged
  })

  const consumidoPorProyecto: Record<string, number> = {}
  ;(tareas ?? []).forEach(t => {
    consumidoPorProyecto[t.project_id] = (consumidoPorProyecto[t.project_id] ?? 0) + (consumidoPorTask[t.id] ?? 0)
  })

  const filas = (proyectos ?? []).map(p => ({
    id: p.id,
    nombre: p.name,
    cliente: (p.client as any)?.name ?? '—',
    clienteId: (p.client as any)?.id ?? '',
    horasVendidas: p.sold_hours ?? 0,
    horasEstimadas: Math.round((horasEstimadasPorProyecto[p.id] ?? 0) * 10) / 10,
    horasConsumidas: Math.round((consumidoPorProyecto[p.id] ?? 0) * 10) / 10,
  }))

  return (
    <ResumenMesClient
      filas={filas}
      mes={mes}
      mesActual={mesActual}
      clientes={clientes}
      filterCliente={filterCliente}
    />
  )
}
