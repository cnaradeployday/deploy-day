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

  // Tareas donde soy responsable — incluye project_id explícito para segmentos
  const { data: directas } = await supabase
    .from('tasks')
    .select(`
      id, title, status, priority, due_date, estimated_hours, direct_hours,
      project_id,
      project:projects(id, name, client:clients(id, name)),
      direct_responsible:users!tasks_direct_responsible_id_fkey(id, full_name)
    `)
    .eq('direct_responsible_id', user?.id)
    .not('status', 'in', '(presentado)')
    .order('due_date', { ascending: true, nullsFirst: false })

  // Tareas donde soy colaborador — incluye project_id explícito
  const { data: colaboraciones } = await supabase
    .from('task_collaborators')
    .select(`
      assigned_hours,
      task:tasks(
        id, title, status, priority, due_date, estimated_hours,
        project_id,
        project:projects(id, name, client:clients(id, name)),
        direct_responsible:users!tasks_direct_responsible_id_fkey(id, full_name)
      )
    `)
    .eq('user_id', user?.id)

  const colabTasks = (colaboraciones ?? [])
    .map((c: any) => c.task ? { ...c.task, my_assigned_hours: c.assigned_hours, es_colaborador: true } : null)
    .filter(Boolean)
    .filter((t: any) => t.status !== 'presentado')

  const directasMapped = (directas ?? []).map((t: any) => ({
    ...t,
    my_assigned_hours: t.direct_hours ?? null,
    es_colaborador: false,
  }))

  const directasIds = new Set(directasMapped.map((t: any) => t.id))
  const colabSinDuplicar = colabTasks.filter((t: any) => !directasIds.has(t.id))
  const allTasksRaw = [...directasMapped, ...colabSinDuplicar]

  // Recopilar project_ids — ahora sí disponibles en el resultado
  const proyectosIds = [...new Set(allTasksRaw.map((t: any) => t.project_id).filter(Boolean))]

  // Segmentos del mes para esos proyectos
  const { data: segmentosMes } = proyectosIds.length
    ? await supabase
        .from('project_hour_segments')
        .select('project_id, horas')
        .in('project_id', proyectosIds)
        .lte('desde', ultimoDia)
        .gte('hasta', primerDia)
    : { data: [] }

  const segPorProyecto: Record<string, number> = {}
  ;(segmentosMes ?? []).forEach((s: any) => {
    segPorProyecto[s.project_id] = (segPorProyecto[s.project_id] ?? 0) + s.horas
  })

  const allTasks = allTasksRaw
    .map((t: any) => ({ ...t, desde_segmento: false }))

  let tareasFiltered = [...allTasks]
  if (status)   tareasFiltered = tareasFiltered.filter((t: any) => t.status === status)
  if (priority) tareasFiltered = tareasFiltered.filter((t: any) => t.priority === priority)
  if (proyecto) tareasFiltered = tareasFiltered.filter((t: any) => t.project?.id === proyecto)
  if (cliente)  tareasFiltered = tareasFiltered.filter((t: any) => t.project?.client?.id === cliente)

  const taskIds = tareasFiltered.map((t: any) => t.id)

  const { data: timeEntries } = taskIds.length
    ? await supabase
        .from('time_entries').select('task_id, hours_logged, user_id')
        .in('task_id', taskIds)
        .gte('entry_date', primerDia).lte('entry_date', ultimoDia)
    : { data: [] }

  const misHorasPorTarea: Record<string, number> = {}
  timeEntries?.forEach((e: any) => {
    if (e.user_id === user?.id) {
      misHorasPorTarea[e.task_id] = (misHorasPorTarea[e.task_id] ?? 0) + e.hours_logged
    }
  })

  const tareasConHoras = tareasFiltered.map((t: any) => ({
    ...t,
    hours_logged: Math.round((misHorasPorTarea[t.id] ?? 0) * 10) / 10,
  }))

  const horasEstimadasDelMes = tareasFiltered
    .filter((t: any) => !t.desde_segmento && t.due_date >= primerDia && t.due_date <= ultimoDia)
    .reduce((s: number, t: any) => s + (t.my_assigned_hours ?? 0), 0)

  const proyectosUnicos = [...new Map(tareasFiltered.map((t: any) => [t.project?.id, t.project])).values()]
    .filter(Boolean).map((p: any) => ({ value: p.id, label: p.name }))

  const clientesUnicos = [...new Map(tareasFiltered.map((t: any) => [t.project?.client?.id, t.project?.client])).values()]
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
      userId={user?.id ?? ''}
    />
  )
}
