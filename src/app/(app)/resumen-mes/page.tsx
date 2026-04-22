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

  // Proyectos activos en el mes (por fechas del proyecto)
  const { data: proyectos } = await supabase
    .from('projects')
    .select('id, name, sold_hours, start_date, end_date, client:clients(id, name)')
    .eq('is_active', true)
    .order('name')

  const proyectosDelMes = (proyectos ?? []).filter(p => {
    if (!p.start_date) return true
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
        .not('status', 'in', '(presentado)')
    : { data: [] }

  const taskIds = (todasTareas ?? []).map(t => t.id)

  // Time entries del mes (por entry_date, no por due_date)
  const { data: entries } = taskIds.length
    ? await supabase
        .from('time_entries')
        .select('task_id, hours_logged')
        .in('task_id', taskIds)
        .gte('entry_date', primerDia)
        .lte('entry_date', ultimoDia)
    : { data: [] }

  const clientes = [...new Map(
    proyectosDelMes.map(p => [(p.client as any)?.id, p.client])
  ).values()].filter(Boolean) as any[]

  // Horas vendidas: segmento del mes o sold_hours como fallback
  const horasPorSegmento: Record<string, number> = {}
  ;(segmentos ?? []).forEach((s: any) => {
    horasPorSegmento[s.project_id] = (horasPorSegmento[s.project_id] ?? 0) + s.horas
  })

  // Horas estimadas del mes por proyecto:
  // Para tareas con due_date en el mes → usar estimated_hours
  // Para tareas sin due_date en el mes pero con segmento → usar horas del segmento
  const horasEstimadasPorProyecto: Record<string, number> = {}
  const tareasConDueEnMes = (todasTareas ?? []).filter(t =>
    t.due_date && t.due_date >= primerDia && t.due_date <= ultimoDia
  )
  tareasConDueEnMes.forEach(t => {
    horasEstimadasPorProyecto[t.project_id] = (horasEstimadasPorProyecto[t.project_id] ?? 0) + (t.estimated_hours ?? 0)
  })
  // Para proyectos con segmento pero sin tareas en el mes, usar horas del segmento como estimadas
  Object.entries(horasPorSegmento).forEach(([proyId, horas]) => {
    if (horasEstimadasPorProyecto[proyId] === undefined) {
      horasEstimadasPorProyecto[proyId] = horas
    }
  })

  // Horas consumidas: time_entries del mes agrupadas por proyecto
  const taskToProject: Record<string, string> = {}
  ;(todasTareas ?? []).forEach(t => { taskToProject[t.id] = t.project_id })

  const consumidoPorProyecto: Record<string, number> = {}
  ;(entries ?? []).forEach((e: any) => {
    const proyId = taskToProject[e.task_id]
    if (!proyId) return
    consumidoPorProyecto[proyId] = (consumidoPorProyecto[proyId] ?? 0) + e.hours_logged
  })

  // Incluir proyectos con cualquier actividad en el mes
  const proyectosConActividad = proyectosDelMes.filter(p =>
    horasPorSegmento[p.id] !== undefined ||
    horasEstimadasPorProyecto[p.id] !== undefined ||
    consumidoPorProyecto[p.id] !== undefined
  )

  // Meses disponibles basados en segmentos existentes
  const { data: todosSegmentos } = await supabase
    .from('project_hour_segments')
    .select('desde')
    .order('desde', { ascending: false })

  const mesesDisponibles = [...new Set(
    (todosSegmentos ?? []).map(s => s.desde?.slice(0, 7)).filter(Boolean)
  )].sort().reverse() as string[]

  // Asegurar que el mes actual siempre esté
  if (!mesesDisponibles.includes(mesActual)) mesesDisponibles.unshift(mesActual)

  // Meses disponibles basados en segmentos existentes
  const { data: todosSegmentos } = await supabase
    .from('project_hour_segments')
    .select('desde')
    .order('desde', { ascending: false })

  const mesesDisponibles = [...new Set(
    (todosSegmentos ?? []).map(s => s.desde?.slice(0, 7)).filter(Boolean)
  )].sort().reverse() as string[]

  // Asegurar que el mes actual siempre esté
  if (!mesesDisponibles.includes(mesActual)) mesesDisponibles.unshift(mesActual)

  // Meses disponibles basados en segmentos existentes
  const { data: todosSegmentos } = await supabase
    .from('project_hour_segments')
    .select('desde')
    .order('desde', { ascending: false })

  const mesesDisponibles = [...new Set(
    (todosSegmentos ?? []).map(s => s.desde?.slice(0, 7)).filter(Boolean)
  )].sort().reverse() as string[]

  // Asegurar que el mes actual siempre esté
  if (!mesesDisponibles.includes(mesActual)) mesesDisponibles.unshift(mesActual)

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
      mesesDisponibles={mesesDisponibles}
    />
  )
}
