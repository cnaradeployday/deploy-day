import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Clock, CheckSquare, Pencil } from 'lucide-react'
import ProyectoSegmentos from './ProyectoSegmentos'

const statusColors: Record<string, string> = {
  creado: 'bg-gray-100 text-gray-500', estimado: 'bg-blue-50 text-blue-600',
  en_proceso: 'bg-amber-50 text-amber-600', terminado: 'bg-green-50 text-green-600',
  presentado: 'bg-purple-50 text-purple-600',
}
const statusLabels: Record<string, string> = {
  creado: 'Creado', estimado: 'Estimado', en_proceso: 'En proceso',
  terminado: 'Terminado', presentado: 'Presentado'
}
const priorityColors: Record<string, string> = {
  baja: 'bg-gray-100 text-gray-400', media: 'bg-blue-50 text-blue-500',
  alta: 'bg-amber-50 text-amber-600', critica: 'bg-red-50 text-red-600'
}

export default async function ProyectoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: proyecto } = await supabase
    .from('projects')
    .select('*, client:clients(id, name)')
    .eq('id', id).single()
  if (!proyecto) notFound()

  const { data: tareas } = await supabase
    .from('tasks')
    .select('id, title, status, priority, due_date, estimated_hours, direct_responsible:users!tasks_direct_responsible_id_fkey(full_name)')
    .eq('project_id', id)
    .order('due_date', { ascending: true })

  const { data: segmentos } = await supabase
    .from('project_hour_segments')
    .select('*')
    .eq('project_id', id)
    .order('desde', { ascending: true })

  // Horas consumidas reales (time_entries de todas las tareas del proyecto)
  const taskIds = (tareas ?? []).map(t => t.id)
  const { data: timeEntries } = taskIds.length
    ? await supabase.from('time_entries').select('task_id, hours_logged, entry_date').in('task_id', taskIds)
    : { data: [] }
  const totalConsumido = Math.round(((timeEntries ?? []).reduce((s, e) => s + e.hours_logged, 0)) * 10) / 10

  const { data: profile } = await supabase.auth.getUser()
    .then(({ data }) => supabase.from('users').select('role').eq('id', data.user?.id ?? '').single())

  const isAdmin = ['admin','gerente_operaciones'].includes(profile?.role ?? '')

  const totalEstimado = tareas?.reduce((sum, t) => sum + (t.estimated_hours ?? 0), 0) ?? 0
  const totalSegmentos = segmentos?.reduce((s, seg) => s + seg.horas, 0) ?? 0
  const pct = proyecto.sold_hours > 0 ? Math.min(100, (totalEstimado / proyecto.sold_hours) * 100) : 0

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/proyectos" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Proyectos
      </Link>

      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-gray-400 mb-1">{(proyecto.client as any)?.name}</p>
          <h1 className="text-xl font-semibold text-gray-900">{proyecto.name}</h1>
        </div>
        <Link href={'/tareas/nueva?proyecto=' + id}
          className="flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
          <Plus size={15}/> Nueva tarea
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Horas vendidas', value: proyecto.sold_hours + 'h' },
          { label: 'Horas estimadas', value: totalEstimado + 'h' },
          { label: 'Horas consumidas', value: totalConsumido + 'h' },
          { label: 'Tareas', value: tareas?.length ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-lg font-semibold text-gray-900 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 mb-4">
        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
          <span>Uso de horas</span><span>{Math.round(pct)}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={'h-full rounded-full ' + (pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-amber-400' : 'bg-[#1B9BF0]')}
            style={{ width: pct + '%' }}/>
        </div>
      </div>

      {isAdmin && (
        <ProyectoSegmentos
          projectId={id}
          segmentos={segmentos ?? []}
          soldHours={proyecto.sold_hours}
          totalSegmentos={totalSegmentos}
          timeEntries={timeEntries ?? []}
          taskIds={taskIds}
        />
      )}

      <div className="flex items-center justify-between mb-3 mt-4">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <CheckSquare size={15}/> Tareas
        </h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {!tareas?.length ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-sm">Sin tareas aún</p>
            <Link href={'/tareas/nueva?proyecto=' + id} className="text-sm text-[#1B9BF0] underline mt-1 inline-block">Crear primera tarea</Link>
          </div>
        ) : tareas.map(t => (
          <Link key={t.id} href={'/tareas/' + t.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-900">{t.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {(t.direct_responsible as any)?.full_name}
                {t.due_date && ' · ' + new Date(t.due_date).toLocaleDateString('es-AR', { day:'numeric', month:'short' })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {t.estimated_hours && <span className="text-xs text-gray-400">{t.estimated_hours}h</span>}
              <span className={'text-xs px-2 py-0.5 rounded-full ' + priorityColors[t.priority]}>{t.priority}</span>
              <span className={'text-xs px-2 py-0.5 rounded-full ' + statusColors[t.status]}>{statusLabels[t.status]}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
