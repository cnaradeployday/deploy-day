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
  const primerDia = new Date(anio, mesNum - 1, 1).toISOString().split('T')[0]
  const ultimoDia = new Date(anio, mesNum, 0).toISOString().split('T')[0]

  const { data: proyectos } = await supabase
    .from('projects')
    .select('id, name, sold_hours, client:clients(id, name)')
    .eq('is_active', true)
    .order('name')

  const proyectoIds = (proyectos ?? []).map(p => p.id)

  const { data: segmentos } = proyectoIds.length
    ? await supabase
        .from('project_hour_segments')
        .select('project_id, horas, desde, hasta')
        .in('project_id', proyectoIds)
        .lte('desde', ultimoDia)
        .gte('hasta', primerDia)
    : { data: [] }

  const { data: tareasDelMes } = proyectoIds.length
    ? await supabase
        .from('tasks')
        .select('id, estimated_hours, project_id')
        .in('project_id', proyectoIds)
        .gte('due_date', primerDia)
        .lte('due_date', ultimoDia)
    : { data: [] }

  const taskIds = (tareasDelMes ?? []).map(t => t.id)
  const { data: entries } = taskIds.length
    ? await supabase
        .from('time_entries')
        .select('task_id, hours_logged')
        .in('task_id', taskIds)
        .gte('entry_date', primerDia)
        .lte('entry_date', ultimoDia)
    : { data: [] }

  const clientes = [...new Map(
    (proyectos ?? []).map(p => [(p.client as any)?.id, p.client])
  ).values()].filter(Boolean) as any[]

  const horasVendidasPorProyecto: Record<string, number> = {}
  ;(segmentos ?? []).forEach(s => {
    horasVendidasPorProyecto[s.project_id] = (horasVendidasPorProyecto[s.project_id] ?? 0) + s.horas
  })

  const horasEstimadasPorProyecto: Record<string, number> = {}
  ;(tareasDelMes ?? []).forEach(t => {
    horasEstimadasPorProyecto[t.project_id] = (horasEstimadasPorProyecto[t.project_id] ?? 0) + (t.estimated_hours ?? 0)
  })

  const consumidoPorTask: Record<string, number> = {}
  ;(entries ?? []).forEach(e => {
    consumidoPorTask[e.task_id] = (consumidoPorTask[e.task_id] ?? 0) + e.hours_logged
  })
  const consumidoPorProyecto: Record<string, number> = {}
  ;(tareasDelMes ?? []).forEach(t => {
    consumidoPorProyecto[t.project_id] = (consumidoPorProyecto[t.project_id] ?? 0) + (consumidoPorTask[t.id] ?? 0)
  })

  const proyectosConActividad = (proyectos ?? []).filter(p =>
    horasEstimadasPorProyecto[p.id] !== undefined ||
    horasVendidasPorProyecto[p.id] !== undefined
  )

  const filas = proyectosConActividad.map(p => ({
    id: p.id,
    nombre: p.name,
    cliente: (p.client as any)?.name ?? '—',
    clienteId: (p.client as any)?.id ?? '',
    horasVendidas: horasVendidasPorProyecto[p.id] !== undefined
      ? Math.round((horasVendidasPorProyecto[p.id]) * 10) / 10
      : (p.sold_hours ?? 0),
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
