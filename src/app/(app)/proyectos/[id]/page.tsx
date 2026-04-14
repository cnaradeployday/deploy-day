import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Clock, CheckSquare } from 'lucide-react'

const statusColors: Record<string, string> = {
  creado: 'bg-gray-100 text-gray-500',
  estimado: 'bg-blue-50 text-blue-600',
  en_proceso: 'bg-amber-50 text-amber-600',
  terminado: 'bg-green-50 text-green-600',
  presentado: 'bg-purple-50 text-purple-600',
}
const statusLabels: Record<string, string> = {
  creado: 'Creado', estimado: 'Estimado', en_proceso: 'En proceso', terminado: 'Terminado', presentado: 'Presentado'
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

  const totalEstimado = tareas?.reduce((sum, t) => sum + (t.estimated_hours ?? 0), 0) ?? 0
  const pct = proyecto.sold_hours > 0 ? Math.min(100, (totalEstimado / proyecto.sold_hours) * 100) : 0

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/proyectos" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15} /> Proyectos
      </Link>

      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-gray-400 mb-1">{(proyecto.client as any)?.name}</p>
          <h1 className="text-xl font-semibold text-gray-900">{proyecto.name}</h1>
        </div>
        <Link href={`/tareas/nueva?proyecto=${id}`} className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">
          <Plus size={15} /> Nueva tarea
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Horas vendidas', value: `${proyecto.sold_hours}h` },
          { label: 'Horas estimadas', value: `${totalEstimado}h` },
          { label: 'Horas disponibles', value: `${proyecto.sold_hours - totalEstimado}h` },
          { label: 'Tareas', value: tareas?.length ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-lg font-semibold text-gray-900 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 mb-6">
        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
          <span>Uso de horas estimadas</span>
          <span>{Math.round(pct)}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-amber-400' : 'bg-green-400'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><CheckSquare size={15}/>Tareas</h2>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {!tareas?.length ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-sm">Sin tareas aún</p>
            <Link href={`/tareas/nueva?proyecto=${id}`} className="text-sm text-black underline mt-1 inline-block">Crear primera tarea</Link>
          </div>
        ) : tareas.map(t => (
          <Link key={t.id} href={`/tareas/${t.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-900">{t.title}</p>
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                {(t.direct_responsible as any)?.full_name && <span>{(t.direct_responsible as any).full_name}</span>}
                {t.due_date && <span className="flex items-center gap-1"><Clock size={10}/>{new Date(t.due_date).toLocaleDateString('es-AR')}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {t.estimated_hours && <span className="text-xs text-gray-400">{t.estimated_hours}h</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[t.priority]}`}>{t.priority}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[t.status]}`}>{statusLabels[t.status]}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
