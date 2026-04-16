import { createClient } from '@/lib/supabase/server'
import MisTareasClient from './MisTareasClient'

export default async function MisTareasPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const sp = await searchParams
  const { status, priority, proyecto, cliente } = sp

  const { data: directas } = await supabase
    .from('tasks')
    .select(`id, title, status, priority, due_date, estimated_hours, direct_hours,
      project:projects(id, name, client:clients(id, name)),
      direct_responsible:users!tasks_direct_responsible_id_fkey(id, full_name)`)
    .eq('direct_responsible_id', user?.id)
    .order('due_date', { ascending: true })

  const { data: colaboraciones } = await supabase
    .from('task_collaborators')
    .select(`assigned_hours, task:tasks(id, title, status, priority, due_date, estimated_hours,
      project:projects(id, name, client:clients(id, name)),
      direct_responsible:users!tasks_direct_responsible_id_fkey(id, full_name))`)
    .eq('user_id', user?.id)

  const colabTasks = (colaboraciones ?? [])
    .map((c: any) => c.task ? { ...c.task, my_assigned_hours: c.assigned_hours } : null)
    .filter(Boolean)

  const directasMapped = (directas ?? []).map(t => ({
    ...t,
    my_assigned_hours: (t as any).direct_hours ?? null,
  }))

  let allTasks = [...directasMapped, ...colabTasks]
  allTasks = allTasks.filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i)

  if (status) allTasks = allTasks.filter(t => t.status === status)
  if (priority) allTasks = allTasks.filter(t => t.priority === priority)
  if (proyecto) allTasks = allTasks.filter(t => (t.project as any)?.id === proyecto)
  if (cliente) allTasks = allTasks.filter(t => ((t.project as any)?.client as any)?.id === cliente)

  const taskIds = allTasks.map(t => t.id)
  const { data: timeEntries } = taskIds.length
    ? await supabase.from('time_entries').select('task_id, hours_logged, user_id').in('task_id', taskIds)
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
      filters={{ status, priority, proyecto, cliente }}
    />
  )
}
