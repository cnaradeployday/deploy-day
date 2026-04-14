import { createClient } from '@/lib/supabase/server'
import TareasTable from '@/app/(app)/tareas/TareasTable'

export default async function MisTareasPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const sp = await searchParams
  const { status, priority, proyecto } = sp

  const { data: directas } = await supabase
    .from('tasks')
    .select(`id, title, status, priority, due_date, estimated_hours,
      project:projects(id, name, client:clients(id, name)),
      direct_responsible:users!tasks_direct_responsible_id_fkey(id, full_name)`)
    .eq('direct_responsible_id', user?.id)
    .not('status', 'in', '("presentado")')
    .order('due_date', { ascending: true })

  const { data: colaboraciones } = await supabase
    .from('task_collaborators')
    .select(`task:tasks(id, title, status, priority, due_date, estimated_hours,
      project:projects(id, name, client:clients(id, name)),
      direct_responsible:users!tasks_direct_responsible_id_fkey(id, full_name))`)
    .eq('user_id', user?.id)

  const colabTasks = colaboraciones?.map((c: any) => c.task).filter(Boolean) ?? []
  const allTasks = [...(directas ?? []), ...colabTasks]
  let uniqueTasks = allTasks.filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i)

  if (status) uniqueTasks = uniqueTasks.filter(t => t.status === status)
  if (priority) uniqueTasks = uniqueTasks.filter(t => t.priority === priority)
  if (proyecto) uniqueTasks = uniqueTasks.filter(t => t.project?.id === proyecto)

  const taskIds = uniqueTasks.map(t => t.id)
  const { data: timeEntries } = taskIds.length
    ? await supabase.from('time_entries').select('task_id, hours_logged').in('task_id', taskIds)
    : { data: [] }

  const horasPorTarea: Record<string, number> = {}
  timeEntries?.forEach(e => {
    horasPorTarea[e.task_id] = (horasPorTarea[e.task_id] ?? 0) + e.hours_logged
  })

  const tareasConHoras = uniqueTasks.map(t => ({
    ...t,
    hours_logged: Math.round((horasPorTarea[t.id] ?? 0) * 10) / 10,
  }))

  const proyectosUnicos = [...new Map(uniqueTasks.map(t => [t.project?.id, t.project])).values()]
    .filter(Boolean).map(p => ({ value: p.id, label: p.name }))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Mis tareas</h1>
        <p className="text-sm text-gray-400 mt-0.5">{tareasConHoras.length} tareas asignadas</p>
      </div>
      <TareasTable
        tareas={tareasConHoras}
        clientes={[]}
        proyectos={proyectosUnicos}
        usuarios={[]}
        filters={{ status, priority, proyecto }}
        hideColumns={['client', 'responsible']}
      />
    </div>
  )
}
