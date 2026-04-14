import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, CheckSquare, Clock, Filter } from 'lucide-react'
import TareasTable from './TareasTable'

export default async function TareasPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const sp = await searchParams
  const { status, priority, cliente, proyecto, responsable } = sp

  const { data: clientes } = await supabase.from('clients').select('id, name').order('name')
  const { data: proyectosAll } = await supabase.from('projects').select('id, name, client_id').order('name')
  const { data: usuarios } = await supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name')

  let query = supabase
    .from('tasks')
    .select(`id, title, status, priority, due_date, estimated_hours,
      project:projects(id, name, client:clients(id, name)),
      direct_responsible:users!tasks_direct_responsible_id_fkey(id, full_name)`)
    .order('due_date', { ascending: true })

  if (status) query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)
  if (responsable) query = query.eq('direct_responsible_id', responsable)
  if (proyecto) query = query.eq('project_id', proyecto)
  else if (cliente) {
    const ids = proyectosAll?.filter(p => p.client_id === cliente).map(p => p.id) ?? []
    if (ids.length) query = query.in('project_id', ids)
  }

  const { data: tareas } = await query

  const taskIds = tareas?.map(t => t.id) ?? []
  const { data: timeEntries } = taskIds.length
    ? await supabase.from('time_entries').select('task_id, hours_logged').in('task_id', taskIds)
    : { data: [] }

  const horasPorTarea: Record<string, number> = {}
  timeEntries?.forEach(e => {
    horasPorTarea[e.task_id] = (horasPorTarea[e.task_id] ?? 0) + e.hours_logged
  })

  const tareasConHoras = tareas?.map(t => ({
    ...t,
    hours_logged: Math.round((horasPorTarea[t.id] ?? 0) * 10) / 10,
  })) ?? []

  const proyectosFiltrados = cliente ? proyectosAll?.filter(p => p.client_id === cliente) : proyectosAll

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Tareas</h1>
          <p className="text-sm text-gray-400 mt-0.5">{tareasConHoras.length} tareas</p>
        </div>
        <Link href="/tareas/nueva" className="flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
          <Plus size={15}/> Nueva tarea
        </Link>
      </div>

      <TareasTable
        tareas={tareasConHoras}
        clientes={clientes?.map(c => ({ value: c.id, label: c.name })) ?? []}
        proyectos={proyectosFiltrados?.map(p => ({ value: p.id, label: p.name })) ?? []}
        usuarios={usuarios?.map(u => ({ value: u.id, label: u.full_name })) ?? []}
        filters={{ status, priority, cliente, proyecto, responsable }}
      />
    </div>
  )
}
