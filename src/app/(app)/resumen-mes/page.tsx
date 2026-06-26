import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import ResumenMesClient from './ResumenMesClient'

function getAdmin() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

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
    .select('id, name, sold_hours, start_date, end_date, client:clients(id, name)')
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

  const { data: todasTareas } = proyectoIds.length
    ? await supabase
        .from('tasks')
        .select('id, estimated_hours, project_id, due_date')
        .in('project_id', proyectoIds)
        .not('status', 'in', '(presentado)')
    : { data: [] }

  const taskIds = (todasTareas ?? []).map(t => t.id)

  const { data: entries } = taskIds.length
    ? await getAdmin()
        .from('time_entries')
        .select('task_id, hours_logged')
        .in('task_id', taskIds)
        .gte('entry_date', primerDia)
        .lte('entry_date', ultimoDia)
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
    t.due_date && t.due_date >= primerDia && t.due_date <= ultimoDia
  )
  tareasConDueEnMes.forEach(t => {
    horasEstimadasPorProyecto[t.project_id] = (horasEstimadasPorProyecto[t.project_id] ?? 0) + (t.estimated_hours ?? 0)
  })
  // Sin fallback a segmentos - estimadas vienen SOLO de tareas con due_date en el mes

  const taskToProject: Record<string, string> = {}
  ;(todasTareas ?? []).forEach(t => { taskToProject[t.id] = t.project_id })

  const consumidoPorProyecto: Record<string, number> = {}
  ;(entries ?? []).forEach((e: any) => {
    const proyId = taskToProject[e.task_id]
    if (!proyId) return
    consumidoPorProyecto[proyId] = (consumidoPorProyecto[proyId] ?? 0) + e.hours_logged
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
