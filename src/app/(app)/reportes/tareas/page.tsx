import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import TasksChart from './TasksChart'
import ReportFilters from '@/components/reportes/ReportFilters'

const STATUS_LABELS: Record<string, string> = {
  creado: 'Creado', estimado: 'Estimado', en_proceso: 'En proceso',
  terminado: 'Terminado', presentado: 'Presentado'
}

export default async function ReporteTareasPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (!['admin', 'gerente_operaciones'].includes(profile?.role ?? '')) redirect('/dashboard')

  const sp = await searchParams
  const { from, to, cliente, proyecto, colaborador } = sp

  const { data: clientes } = await supabase.from('clients').select('id, name').order('name')
  const { data: proyectosAll } = await supabase.from('projects').select('id, name, client_id').order('name')
  const { data: usuarios } = await supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name')

  let query = supabase.from('tasks').select(`
    id, status, priority, due_date,
    project:projects(id, name, client:clients(id, name)),
    direct_responsible:users!tasks_direct_responsible_id_fkey(id, full_name)
  `)

  if (proyecto) query = query.eq('project_id', proyecto)
  else if (cliente) {
    const clientProjects = proyectosAll?.filter(p => p.client_id === cliente).map(p => p.id) ?? []
    if (clientProjects.length) query = query.in('project_id', clientProjects)
  }
  if (colaborador) query = query.eq('direct_responsible_id', colaborador)
  if (from) query = query.gte('due_date', from)
  if (to) query = query.lte('due_date', to)

  const { data: tareas } = await query

  const byStatus = Object.entries(STATUS_LABELS).map(([s, label]) => ({
    name: label, value: tareas?.filter(t => t.status === s).length ?? 0
  }))
  const byPriority = ['baja','media','alta','critica'].map(p => ({
    name: p.charAt(0).toUpperCase() + p.slice(1),
    value: tareas?.filter(t => t.priority === p).length ?? 0
  }))
  const clientMap: Record<string, number> = {}
  tareas?.forEach(t => {
    const name = (t.project as any)?.client?.name ?? 'Sin cliente'
    clientMap[name] = (clientMap[name] ?? 0) + 1
  })
  const byClient = Object.entries(clientMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 8)

  const proyectosFiltrados = cliente
    ? proyectosAll?.filter(p => p.client_id === cliente)
    : proyectosAll

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/reportes" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Reportes
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Estado de tareas</h1>
      <ReportFilters
        clientes={clientes?.map(c => ({ value: c.id, label: c.name })) ?? []}
        proyectos={proyectosFiltrados?.map(p => ({ value: p.id, label: p.name })) ?? []}
        colaboradores={usuarios?.map(u => ({ value: u.id, label: u.full_name })) ?? []}
      />
      <TasksChart byStatus={byStatus} byPriority={byPriority} byClient={byClient} total={tareas?.length ?? 0} />
    </div>
  )
}
