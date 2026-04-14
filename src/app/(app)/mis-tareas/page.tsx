import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Clock, CheckSquare } from 'lucide-react'

const statusColors: Record<string, string> = {
  creado: 'bg-gray-100 text-gray-500', estimado: 'bg-blue-50 text-blue-600',
  en_proceso: 'bg-amber-50 text-amber-600', terminado: 'bg-green-50 text-green-600',
  presentado: 'bg-purple-50 text-purple-600',
}
const statusLabels: Record<string, string> = {
  creado: 'Creado', estimado: 'Estimado', en_proceso: 'En proceso',
  terminado: 'Terminado', presentado: 'Presentado'
}

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

  const enProceso = uniqueTasks.filter(t => t.status === 'en_proceso')
  const pendientes = uniqueTasks.filter(t => ['creado', 'estimado'].includes(t.status))
  const terminadas = uniqueTasks.filter(t => t.status === 'terminado')

  const Section = ({ title, tasks, icon }: { title: string; tasks: any[]; icon: React.ReactNode }) => (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">{icon}{title} <span className="text-gray-400 font-normal">({tasks.length})</span></h2>
      {!tasks.length ? (
        <p className="text-sm text-gray-400 py-4 text-center bg-white rounded-xl border border-gray-200">Sin tareas en esta categoría</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {tasks.map(t => (
            <Link key={t.id} href={`/tareas/${t.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
              <div>
                <p className="text-sm font-medium text-gray-900">{t.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t.project?.client?.name} · {t.project?.name}</p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                {t.due_date && <span className="hidden sm:flex items-center gap-1 text-xs text-gray-400"><Clock size={10}/>{new Date(t.due_date).toLocaleDateString('es-AR')}</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[t.status]}`}>{statusLabels[t.status]}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Mis tareas</h1>
        <p className="text-sm text-gray-400 mt-0.5">{uniqueTasks.length} tareas asignadas</p>
      </div>
      <Section title="En proceso" tasks={enProceso} icon={<span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>} />
      <Section title="Pendientes" tasks={pendientes} icon={<span className="w-2 h-2 rounded-full bg-blue-400 inline-block"/>} />
      <Section title="Terminadas" tasks={terminadas} icon={<CheckSquare size={14} className="text-green-500"/>} />
    </div>
  )
}
