import { createClient } from '@/lib/supabase/server'
import MisTareasClient from './MisTareasClient'

export default async function MisTareasPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const sp = await searchParams
  const { status, priority, proyecto, cliente } = sp

  const mesActual = new Date().toISOString().slice(0, 7)
  const mes = sp.mes ?? mesActual
  const [anio, mesNum] = mes.split('-').map(Number)
  const primerDia = new Date(anio, mesNum - 1, 1).toISOString().split('T')[0]
  const ultimoDia = new Date(anio, mesNum, 0).toISOString().split('T')[0]

  const { data: profile } = await supabase
    .from('users').select('role, custom_role_id').eq('id', user?.id ?? '').single()

  const isAdmin = ['admin', 'gerente_operaciones'].includes(profile?.role ?? '')
  let canCreateTask = isAdmin
  if (!canCreateTask && profile?.custom_role_id) {
    const { data: perm } = await supabase
      .from('role_permissions').select('can_read')
      .eq('role_id', profile.custom_role_id).eq('module', 'crear_tareas').single()
    canCreateTask = perm?.can_read ?? false
  }

  // Todas las tareas activas asignadas al usuario
  const { data: directas } = await supabase
    .from('tasks')
    .select(`id, title, status, priority, due_date, estimated_hours, direct_hours, project_id,
      project:projects(id, name, client:clients(id, name)),
      direct_responsible:users!tasks_direct_responsible_id_fkey(id, full_name)`)
    .eq('direct_responsible_id', user?.id)
    .not('status', 'in', '(presentado)')
    .order('due_date', { ascending: true, nullsFirst: false })

  const { data: colaboraciones } = await supabase
    .from('task_collaborators')
    .select(`assigned_hours, task:tasks(id, title, status, priority, due_date, estimated_hours, project_id,
      project:projects(id, name, client:clients(id, name)),
      direct_responsible:users!tasks_direct_responsible_id_fkey(id, full_name))`)
    .eq('user_id', user?.id)

  const colabTasks = (colaboraciones ?? [])
    .map((c: any) => c.task ? { ...c.task, my_assigned_hours: c.assigned_hours, es_colaborador: true } : null)
    .filter(Boolean)
    .filter((t: any) => t.status !== 'presentado')

  const directasMapped = (directas ?? []).map(t => ({
    ...t,
    my_assigned_hours: (t as any).direct_hours ?? null,
    es_colaborador: false,
  }))

  const directasIds = new Set(directasMapped.map(t => t.id))
  const colabSinDuplicar = colabTasks.filter((t: any) => !directasIds.has(t.id))
  const allTasksRaw = [...directasMapped, ...colabSinDuplicar]

  // Obtener segmentos de los proyectos de las tareas para el mes actual
  const proyectosIds = [...new Set(allTasksRaw.map(t => (t as any).project_id).filter(Boolean))]
  const { data: segmentosMes } = proyectosIds.length
    ? await supabase
        .from('project_hour_segments')
        .select('project_id, horas, desde, hasta')
        .in('project_id', proyectosIds)
        .lte('desde', ultimoDia)
        .gte('hasta', primerDia)
    : { data: [] }

  // Mapa: project_id → horas del segmento del mes
  const segmentosPorProyecto: Record<string, number> = {}
  ;(segmentosMes ?? []).forEach(s => {
    segmentosPorProyecto[s.project_id] = (segmentosPorProyecto[s.project_id] ?? 0) + s.horas
  })

  // Una tarea aparece en el mes si:
  // 1. Su due_date está en el mes, O
  // 2. Su proyecto tiene un segmento en el mes Y la tarea no está terminada/presentada
  const allTasks = allTasksRaw.filter(t => {
    const dueEnMes = t.due_date && t.due_date >= primerDia && t.due_date <= ultimoDia
    const proyectoEnMes = segmentosPorProyecto[(t as any).project_id] !== undefined
    return dueEnMes || proyectoEnMes
  }).map(t => {
    // Si la tarea viene de segmento (no tiene due_date en el mes),
    // mostrar las horas del segmento del proyecto como referencia
    const dueEnMes = t.due_date && t.due_date >= primerDia && t.due_date <= ultimoDia
    const horasSegmento = segmentosPorProyecto[(t as any).project_id]
    return {
      ...t,
      // Si tiene due_date en el mes, usar my_assigned_hours normal
      // Si viene por segmento, mostrar horas del segmento
      my_assigned_hours: dueEnMes
        ? (t as any).my_assigned_hours
        : horasSegmento ?? (t as any).my_assigned_hours,
      // Marcar si viene de segmento para mostrar distintivo
      desde_segmento: !dueEnMes && horasSegmento !== undefined,
    }
  })

  // Aplicar filtros del usuario
  let tareasFiltered = [...allTasks]
  if (status) tareasFiltered = tareasFiltered.filter(t => t.status === status)
  if (priority) tareasFiltered = tareasFiltered.filter(t => t.priority === priority)
  if (proyecto) tareasFiltered = tareasFiltered.filter(t => (t.project as any)?.id === proyecto)
  if (cliente) tareasFiltered = tareasFiltered.filter(t => ((t.project as any)?.client as any)?.id === cliente)

  const taskIds = tareasFiltered.map(t => t.id)

  // Horas cargadas en el mes por entry_date
  const { data: timeEntries } = taskIds.length
    ? await supabase
        .from('time_entries').select('task_id, hours_logged, user_id')
        .in('task_id', taskIds)
        .gte('entry_date', primerDia).lte('entry_date', ultimoDia)
    : { data: [] }

  const misHorasPorTarea: Record<string, number> = {}
  timeEntries?.forEach(e => {
    if (e.user_id === user?.id) {
      misHorasPorTarea[e.task_id] = (misHorasPorTarea[e.task_id] ?? 0) + e.hours_logged
    }
  })

  const tareasConHoras = tareasFiltered.map(t => ({
    ...t,
    hours_logged: Math.round((misHorasPorTarea[t.id] ?? 0) * 10) / 10,
  }))

  // KPI horas estimadas = suma de my_assigned_hours de las tareas del mes
  const horasEstimadasDelMes = tareasFiltered
    .reduce((s, t) => s + ((t as any).my_assigned_hours ?? 0), 0)

  const proyectosUnicos = [...new Map(tareasFiltered.map(t => [(t.project as any)?.id, t.project])).values()]
    .filter(Boolean).map((p: any) => ({ value: p.id, label: p.name }))

  const clientesUnicos = [...new Map(tareasFiltered.map(t => [((t.project as any)?.client as any)?.id, (t.project as any)?.client])).values()]
    .filter(Boolean).map((c: any) => ({ value: c.id, label: c.name }))

  return (
    <MisTareasClient
      tareas={tareasConHoras}
      proyectos={proyectosUnicos}
      clientes={clientesUnicos}
      filters={{ status, priority, proyecto, cliente, mes }}
      mesActual={mesActual}
      canCreateTask={canCreateTask}
      horasEstimadasDelMes={Math.round(horasEstimadasDelMes * 10) / 10}
    />
  )
}
