import { createClient } from '@/lib/supabase/server'
import MisTareasClient from './MisTareasClient'

export default async function MisTareasPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const sp = await searchParams
  const { status, priority, proyecto, cliente } = sp

  const mesActual = new Date().toISOString().slice(0, 7)

  // Support multi-month: ?meses=2025-04,2025-05 or legacy ?mes=2025-05
  const mesStr = sp.meses ?? sp.mes ?? mesActual
  const mesArray = [...new Set(mesStr.split(',').filter(Boolean))]

  // Derive date range covering all selected months
  const allFirstDays = mesArray.map(m => {
    const [y, mo] = m.split('-').map(Number)
    return new Date(y, mo - 1, 1).toISOString().split('T')[0]
  })
  const allLastDays = mesArray.map(m => {
    const [y, mo] = m.split('-').map(Number)
    return new Date(y, mo, 0).toISOString().split('T')[0]
  })
  const primerDia = [...allFirstDays].sort()[0]
  const ultimoDia = [...allLastDays].sort().reverse()[0]

  const { data: profile } = await supabase
    .from('users').select('role, custom_role_id').eq('id', user?.id ?? '').single()

  const isAdmin = ['admin', 'gerente_operaciones'].includes(profile?.role ?? '')
  let canCreateTask = isAdmin
  let showHorasEstimadas = true

  if (profile?.custom_role_id) {
    const { data: perms } = await supabase
      .from('role_permissions').select('module, can_read')
      .eq('role_id', profile.custom_role_id)

    if (perms) {
      if (!canCreateTask) canCreateTask = perms.some(p => p.module === 'crear_tareas' && p.can_read)
      // Hide horas estimadas unless role has explicit permission
      const showPerm = perms.find(p => p.module === 'ver_horas_estimadas')
      if (showPerm) showHorasEstimadas = showPerm.can_read
      else showHorasEstimadas = isAdmin
    } else {
      showHorasEstimadas = isAdmin
    }
  } else {
    showHorasEstimadas = isAdmin
  }

  // Tareas donde soy responsable
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

  // Tareas donde soy colaborador
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

  // Filter by selected months (client-side compatible — pass all tasks)
  let tareasFiltered = allTasksRaw.filter((t: any) =>
    t.due_date && mesArray.some(m => t.due_date.startsWith(m))
  )

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

  const horasEstimadasDelMes = tareasFiltered.reduce((s: number, t: any) => s + (t.my_assigned_hours ?? 0), 0)

  const proyectosUnicos = [...new Map(tareasFiltered.map((t: any) => [t.project?.id, t.project])).values()]
    .filter(Boolean).map((p: any) => ({ value: p.id, label: p.name }))

  const clientesUnicos = [...new Map(tareasFiltered.map((t: any) => [t.project?.client?.id, t.project?.client])).values()]
    .filter(Boolean).map((c: any) => ({ value: c.id, label: c.name }))

  // All months available: past 5 + current + next
  const now = new Date()
  const availableMeses: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    availableMeses.push(d.toISOString().slice(0, 7))
  }
  availableMeses.push(new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 7))

  return (
    <MisTareasClient
      tareas={tareasConHoras}
      proyectos={proyectosUnicos}
      clientes={clientesUnicos}
      filters={{ status, priority, proyecto, cliente, meses: mesStr }}
      mesActual={mesActual}
      canCreateTask={canCreateTask}
      horasEstimadasDelMes={Math.round(horasEstimadasDelMes * 10) / 10}
      showHorasEstimadas={showHorasEstimadas}
      availableMeses={availableMeses}
    />
  )
}
