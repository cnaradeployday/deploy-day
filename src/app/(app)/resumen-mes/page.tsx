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

  // Proyectos activos
  const { data: proyectos } = await supabase
    .from('projects')
    .select('id, name, sold_hours, client:clients(id, name)')
    .eq('is_active', true)
    .order('name')

  const proyectoIds = (proyectos ?? []).map(p => p.id)

  // Segmentos que se superponen con el mes seleccionado
  // Un segmento aplica si su rango intersecta con [primerDia, ultimoDia]
  const { data: segmentos } = proyectoIds.length
    ? await supabase
        .from('project_hour_segments')
        .select('project_id, horas, desde, hasta')
        .in('project_id', proyectoIds)
        .lte('desde', ultimoDia)   // empieza antes o durante el mes
        .gte('hasta', primerDia)   // termina después o durante el mes
    : { data: [] }

  // Tareas del mes con horas estimadas
  // Solo tareas que vencen dentro del mes (para que estimated_hours sea del mes, no del proyecto completo)
  const { data: tareas } = proyectoIds.length
    ? await supabase
        .from('tasks')
        .select('id, estimated_hours, project_id, due_date')
        .in('project_id', proyectoIds)
        .gte('due_date', primerDia)
        .lte('due_date', ultimoDia)
    : { data: [] }

  // Time entries del mes (horas consumidas)
  const taskIds = (tareas ?? []).map(t => t.id)
  const { data: entries } = taskIds.length
    ? await supabase.from('time_entries').select('task_id, hours_logged')
        .in('task_id', taskIds)
        .gte('entry_date', primerDia)
        .lte('entry_date', ultimoDia)
    : { data: [] }

  // Clientes únicos para el filtro
  const clientes = [...new Map(
    (proyectos ?? []).map(p => [(p.client as any)?.id, p.client])
  ).values()].filter(Boolean) as any[]

  // Horas vendidas del mes = suma de horas de segmentos que intersectan el mes
  // Si no hay segmentos, cae a 0 (no mostramos sold_hours del proyecto completo)
  const horasVendidasMesPorProyecto: Record<string, number> = {}
  ;(segmentos ?? []).forEach(s => {
    horasVendidasMesPorProyecto[s.project_id] = (horasVendidasMesPorProyecto[s.project_id] ?? 0) + s.horas
  })

  // Horas estimadas por proyecto
  const horasEstimadasPorProyecto: Record<string, number> = {}
  ;(tareas ?? []).forEach(t => {
    horasEstimadasPorProyecto[t.project_id] = (horasEstimadasPorProyecto[t.project_id] ?? 0) + (t.estimated_hours ?? 0)
  })

  // Horas consumidas por proyecto en el mes
  const consumidoPorTask: Record<string, number> = {}
  ;(entries ?? []).forEach(e => {
    consumidoPorTask[e.task_id] = (consumidoPorTask[e.task_id] ?? 0) + e.hours_logged
  })
  const consumidoPorProyecto: Record<string, number> = {}
  ;(tareas ?? []).forEach(t => {
    consumidoPorProyecto[t.project_id] = (consumidoPorProyecto[t.project_id] ?? 0) + (consumidoPorTask[t.id] ?? 0)
  })

  // Solo mostrar proyectos que tienen segmento en el mes
  const filasConSegmento = (proyectos ?? []).filter(p => horasVendidasMesPorProyecto[p.id] !== undefined)

  const filas = filasConSegmento.map(p => ({
    id: p.id,
    nombre: p.name,
    cliente: (p.client as any)?.name ?? '—',
    clienteId: (p.client as any)?.id ?? '',
    horasVendidas: Math.round((horasVendidasMesPorProyecto[p.id] ?? 0) * 10) / 10,
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
