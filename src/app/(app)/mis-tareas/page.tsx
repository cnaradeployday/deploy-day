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

  // Tareas donde soy responsable directo — filtradas por mes
  const { data: directas } = await supabase
    .from('tasks')
    .select(`id, title, status, priority, due_date, estimated_hours, direct_hours,
      project:projects(id, name, client:clients(id, name)),
      direct_responsible:users!tasks_direct_responsible_id_fkey(id, full_name)`)
    .eq('direct_responsible_id', user?.id)
    .gte('due_date', primerDia)
    .lte('due_date', ultimoDia)
    .order('due_date', { ascending: true })

  // Tareas donde soy colaborador — filtradas por mes
  const { data: colaboraciones } = await supabase
    .from('task_collaborators')
    .select(`assigned_hours, task:tasks(id, title, status, priority, due_date, estimated_hours,
      project:projects(id, name, client:clients(id, name)),
      direct_responsible:users!tasks_direct_responsible_id_fkey(id, full_name))`)
    .eq('user_id', user?.id)

  // Filtrar colaboraciones por mes y mapear
  const colabTasks = (colaboraciones ?? [])
    .map((c: any) => c.task ? { ...c.task, my_assigned_hours: c.assigned_hours, es_colaborador: true } : null)
    .filter(Boolean)
    .filter((t: any) => t.due_date >= primerDia && t.due_date <= ultimoDia)

  // Tareas directas con my_assigned_hours = direct_hours
  const directasMapped = (directas ?? []).map(t => ({
    ...t,
    my_assigned_hours: (t as any).direct_hours ?? null,
    es_colaborador: false,
  }))

  // Unificar: si una tarea aparece en directas Y colaboraciones, mantener ambas
  // (puede ser responsable Y colaborador en teoría, pero lo más común es que sean distintas)
  const directasIds = new Set(directasMapped.map(t => t.id))
  const colabSinDuplicar = colabTasks.filter((t: any) => !directasIds.has(t.id))
  let allTasks = [...directasMapped, ...colabSinDuplicar]

  if (status) allTasks = allTasks.filter(t => t.status === status)
  if (priority) allTasks = allTasks.filter(t => t.priority === priority)
  if (proyecto) allTasks = allTasks.filter(t => (t.project as any)?.id === proyecto)
  if (cliente) allTasks = allTasks.filter(t => ((t.project as any)?.client as any)?.id === cliente)

  const taskIds = allTasks.map(t => t.id)

  // Mis horas cargadas en el mes
  const { data: timeEntries } = taskIds.length
    ? await supabase
        .from('time_entries')
        .select('task_id, hours_logged, user_id')
        .in('task_id', taskIds)
        .gte('entry_date', primerDia)
        .lte('entry_date', ultimoDia)
    : { data: [] }

  const misHorasPorTarea: Record<string, number> = {}
  timeEntries?.forEach(e => {
    if (e.user_id === user?.id) {
      misHorasPorTarea[e.task_id] = (misHorasPorTarea[e.task_id] ?? 0) + e.hours_logged
    }
  })

  const tareasConHoras = allTasks.map(t => ({
    ...t,
    hours_logged: Math.round((misHorasPorTarea[t.id] ?? 0) * 10) / 10,
  }))

  const proyectosUnicos = [...new Map(allTasks.map(t => [(t.project as any)?.id, t.project])).values()]
    .filter(Boolean).map((p: any) => ({ value: p.id, label: p.name }))

  const clientesUnicos = [...new Map(allTasks.map(t => [((t.project as any)?.client as any)?.id, (t.project as any)?.client])).values()]
    .filter(Boolean).map((c: any) => ({ value: c.id, label: c.name }))

  return (
    <MisTareasClient
      tareas={tareasConHoras}
      proyectos={proyectosUnicos}
      clientes={clientesUnicos}
      filters={{ status, priority, proyecto, cliente, mes }}
      mesActual={mesActual}
    />
  )
}
