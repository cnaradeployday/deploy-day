import { createClient } from '@/lib/supabase/server'
import MisTareasClient from './MisTareasClient'

export default async function MisTareasPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const sp = await searchParams
  const { status, priority, proyecto, cliente } = sp

  const { data: directas } = await supabase
    .from('tasks')
    .select(`id, title, status, priority, due_date, estimated_hours,
      project:projects(id, name, client:clients(id, name)),
      direct_responsible:users!tasks_direct_responsible_id_fkey(id, full_name)`)
    .eq('direct_responsible_id', user?.id)
    .order('due_date', { ascending: true })

  const { data: colaboraciones } = await supabase
    .from('task_collaborators')
    .select(`task:tasks(id, title, status, priority, due_date, estimated_hours,
      project:projects(id, name, client:clients(id, name)),
      direct_responsible:users!tasks_direct_responsible_id_fkey(id, full_name))`)
    .eq('user_id', user?.id)

  const colabTasks = (colaboraciones ?? []).map((c: any) => c.task).filter(Boolean)
  let allTasks = [...(directas ?? []), ...colabTasks]
  allTasks = allTasks.filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i)

  if (status) allTasks = allTasks.filter(t => t.status === status)
  if (priority) allTasks = allTasks.filter(t => t.priority === priority)
  if (proyecto) allTasks = allTasks.filter(t => t.project?.id === proyecto)
  if (cliente) allTasks = allTasks.filter(t => (t.project?.client as any)?.id === cliente)

  const taskIds = allTasks.map(t => t.id)
  const { data: timeEntries } = taskIds.length
    ? await supabase.from('time_entries').select('task_id, hours_logged').in('task_id', taskIds)
    : { data: [] }

  const horasPorTarea: Record<string, number> = {}
  timeEntries?.forEach(e => {
    horasPorTarea[e.task_id] = (horasPorTarea[e.task_id] ?? 0) + e.hours_logged
  })

  const tareasConHoras = allTasks.map(t => ({
    ...t,
    hours_logged: Math.round((horasPorTarea[t.id] ?? 0) * 10) / 10,
  }))

  const proyectosUnicos = [...new Map(allTasks.map(t => [t.project?.id, t.project])).values()]
    .filter(Boolean).map((p: any) => ({ value: p.id, label: p.name }))

  const clientesUnicos = [...new Map(allTasks.map(t => [(t.project?.client as any)?.id, t.project?.client])).values()]
    .filter(Boolean).map((c: any) => ({ value: c.id, label: c.name }))

  return (
    <MisTareasClient
      tareas={tareasConHoras}
      proyectos={proyectosUnicos}
      clientes={clientesUnicos}
      filters={{ status, priority, proyecto, cliente }}
    />
  )
}
