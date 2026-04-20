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

  // Proyectos activos en el mes (por start_date/end_date)
  const { data: proyectos } = await supabase
    .from('projects')
    .select('id, name, sold_hours, start_date, end_date, client:clients(id, name)')
    .eq('is_active', true)
    .order('name')

  const proyectosDelMes = (proyectos ?? []).filter(p => {
    if (!p.start_date) return true // sin fecha = incluir siempre
    if (p.start_date > ultimoDia) return false
    if (p.end_date && p.end_date < primerDia) return false
    return true
  })

  const proyectoIds = proyectosDelMes.map(p => p.id)

  // Segmentos de horas vendidas del mes
  const { data: segmentos } = proyectoIds.length
    ? await supabase
        .from('project_hour_segments')
        .select('project_id, horas')
        .in('project_id', proyectoIds)
        .lte('desde', ultimoDia)
        .gte('hasta', primerDia)
    : { data: [] }

  // TODAS las tareas de los proyectos (sin filtrar por due_date)
  const { data: todasTareas } = proyectoIds.length
    ? await supabase
        .from('tasks')
        .select('id, estimated_hours, project_id, due_date')
        .in('project_id', proyectoIds)
    : { data: [] }

  const taskIds = (todasTareas ?? []).map(t => t.id)

  // Time entries del mes (independiente del due_date de la tarea)
  const { data: entries } = taskIds.length
    ? await supabase
        .from('time_entries')
        .select('task_id, hours_logged')
        .in('task_id', taskIds)
        .gte('entry_date', primerDia)
        .lte('entry_date', ultimoDia)
    : { data: [] }

  // Tareas del mes = las que tienen due_date en el mes (para horas estimadas)
  const tareasDelMes = (todasTareas ?? []).filter(t =>
    t.due_date && t.due_date >= primerDia && t.due_date <= ultimoDia
  )

  const clientes = [...new Map(
    proyectosDelMes.map(p => [(p.client as any)?.id, p.client])
  ).values()].filter(Boolean) as any[]

  // Horas vendidas por proyecto (segmento o sold_hours como fallback)
  const horasPorSegmento: Record<string, number> = {}
  ;(segmentos ?? []).forEach(s => {
    horasPorSegmento[s.project_id] = (horasPorSegmento[s.project_id] ?? 0) + s.horas
  })

  // Horas estimadas = suma de estimated_hours de tareas con due_date en el mes
  const horasEstimadasPorProyecto: Record<string, number> = {}
  tareasDelMes.forEach(t => {
    horasEstimadasPorProyecto[t.project_id] = (horasEstimadasPorProyecto[t.project_id] ?? 0) + (t.estimated_hours ?? 0)
  })

  // Horas consumidas = time_entries del mes, agrupadas por proyecto via tarea
  const taskToProject: Record<string, string> = {}
  ;(todasTareas ?? []).forEach(t => { taskToProject[t.id] = t.project_id })

  const consumidoPorProyecto: Record<string, number> = {}
  ;(entries ?? []).forEach(e => {
    const proyId = taskToProject[e.task_id]
    if (!proyId) return
    consumidoPorProyecto[proyId] = (consumidoPorProyecto[proyId] ?? 0) + e.hours_logged
  })

  // Incluir proyectos con cualquier actividad: vendidas, estimadas o consumidas
  const proyectosConActividad = proyectosDelMes.filter(p =>
    horasPorSegmento[p.id] !== undefined ||
    horasEstimadasPorProyecto[p.id] !== undefined ||
    consumidoPorProyecto[p.id] !== undefined ||
    (p.sold_hours ?? 0) > 0
  )

  const filas = proyectosConActividad.map(p => ({
    id: p.id,
    nombre: p.name,
    cliente: (p.client as any)?.name ?? '—',
    clienteId: (p.client as any)?.id ?? '',
    horasVendidas: horasPorSegmento[p.id] !== undefined
      ? Math.round(horasPorSegmento[p.id] * 10) / 10
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
