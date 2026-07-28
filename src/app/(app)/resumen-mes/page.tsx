import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
    .select('id, name, sold_hours, start_date, end_date, client:clients(id, name, mood)')
    .eq('is_active', true)
    .order('name')

  const proyectosDelMes = (proyectos ?? []).filter(p => {
    if (!p.start_date) return true
    if (p.start_date > ultimoDia) return false
    if (p.end_date && p.end_date < primerDia) return false
    return true
  })

  const proyectoIds = proyectosDelMes.map(p => p.id)

  const { data: segmentos } = proyectoIds.length
    ? await supabase
        .from('project_hour_segments')
        .select('project_id, horas')
        .in('project_id', proyectoIds)
        .lte('desde', ultimoDia)
        .gte('hasta', primerDia)
    : { data: [] }

  // Sin filtro de status: las horas usadas (consumidoPorProyecto) tienen que contar
  // el trabajo real logueado, incluidas tareas ya presentadas/finalizadas.
  const { data: todasTareas } = proyectoIds.length
    ? await supabase
        .from('tasks')
        .select('id, estimated_hours, project_id, due_date, status')
        .in('project_id', proyectoIds)
    : { data: [] }

  const taskIds = (todasTareas ?? []).map(t => t.id)

  // Horas de todo el equipo, no solo las del usuario actual — usar admin client para saltar RLS.
  // Sumado agrupado por tarea en Postgres (RPC), evitando el límite de 1000 filas por consulta.
  const adminSupabase = createAdminClient()
  const { data: entries } = taskIds.length
    ? await adminSupabase.rpc('sum_hours_by_task', { p_task_ids: taskIds, p_from: primerDia, p_to: ultimoDia })
    : { data: [] }

  const clientes = [...new Map(
    proyectosDelMes.map(p => [(p.client as any)?.id, p.client])
  ).values()].filter(Boolean) as any[]

  const horasPorSegmento: Record<string, number> = {}
  ;(segmentos ?? []).forEach((s: any) => {
    horasPorSegmento[s.project_id] = (horasPorSegmento[s.project_id] ?? 0) + s.horas
  })

  const horasEstimadasPorProyecto: Record<string, number> = {}
  const tareasConDueEnMes = (todasTareas ?? []).filter(t =>
    t.due_date && t.due_date >= primerDia && t.due_date <= ultimoDia &&
    !['presentado', 'finalizado'].includes(t.status)
  )
  tareasConDueEnMes.forEach(t => {
    horasEstimadasPorProyecto[t.project_id] = (horasEstimadasPorProyecto[t.project_id] ?? 0) + (t.estimated_hours ?? 0)
  })
  // Sin fallback a segmentos - estimadas vienen SOLO de tareas con due_date en el mes,
  // y se excluyen las ya presentadas/finalizadas (no tiene sentido "estimar" trabajo ya cerrado)

  const taskToProject: Record<string, string> = {}
  ;(todasTareas ?? []).forEach(t => { taskToProject[t.id] = t.project_id })

  const consumidoPorProyecto: Record<string, number> = {}
  ;(entries ?? []).forEach((e: { task_id: string; total_hours: number }) => {
    const proyId = taskToProject[e.task_id]
    if (!proyId) return
    consumidoPorProyecto[proyId] = (consumidoPorProyecto[proyId] ?? 0) + e.total_hours
  })

  const proyectosConActividad = proyectosDelMes.filter(p =>
    horasPorSegmento[p.id] !== undefined ||
    horasEstimadasPorProyecto[p.id] !== undefined ||
    consumidoPorProyecto[p.id] !== undefined
  )

  const filas = proyectosConActividad.map(p => ({
    id: p.id,
    nombre: p.name,
    cliente: (p.client as any)?.name ?? '—',
    clienteId: (p.client as any)?.id ?? '',
    clienteMood: (p.client as any)?.mood ?? null,
    horasVendidas: horasPorSegmento[p.id] !== undefined
      ? Math.round(horasPorSegmento[p.id] * 10) / 10
      : (p.sold_hours ?? 0),
    horasEstimadas: Math.round((horasEstimadasPorProyecto[p.id] ?? 0) * 10) / 10,
    horasConsumidas: Math.round((consumidoPorProyecto[p.id] ?? 0) * 10) / 10,
  }))

  // Meses disponibles desde segmentos reales
  const { data: todosSegmentos } = await supabase
    .from('project_hour_segments')
    .select('desde')
    .order('desde', { ascending: false })

  const mesesDisponibles = [...new Set(
    (todosSegmentos ?? []).map((s: any) => s.desde?.slice(0, 7)).filter(Boolean)
  )].sort().reverse() as string[]

  if (!mesesDisponibles.includes(mesActual)) mesesDisponibles.unshift(mesActual)

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
