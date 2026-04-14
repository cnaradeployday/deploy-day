import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import MisTareasClient from './MisTareasClient'

export default async function MisTareasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: directas } = await supabase
    .from('tasks')
    .select(`id, title, status, priority, due_date, estimated_hours,
      project:projects(name, client:clients(name))`)
    .eq('direct_responsible_id', user?.id)
    .not('status', 'in', '("presentado")')
    .order('due_date', { ascending: true })

  const { data: colaboraciones } = await supabase
    .from('task_collaborators')
    .select(`task:tasks(id, title, status, priority, due_date, estimated_hours,
      project:projects(name, client:clients(name)))`)
    .eq('user_id', user?.id)

  const colabTasks = colaboraciones?.map((c: any) => c.task).filter(Boolean) ?? []
  const allTasks = [...(directas ?? []), ...colabTasks]
  const uniqueTasks = allTasks.filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i)

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

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Mis tareas</h1>
        <p className="text-sm text-gray-400 mt-0.5">{tareasConHoras.length} tareas asignadas</p>
      </div>
      <MisTareasClient tareas={tareasConHoras} />
    </div>
  )
}
