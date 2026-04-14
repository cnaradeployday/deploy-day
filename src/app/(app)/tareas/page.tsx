import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, CheckSquare, Clock } from 'lucide-react'

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

export default async function TareasPage() {
  const supabase = await createClient()
  const { data: tareas } = await supabase
    .from('tasks')
    .select(`id, title, status, priority, due_date, estimated_hours,
      project:projects(name, client:clients(name)),
      direct_responsible:users!tasks_direct_responsible_id_fkey(full_name)`)
    .order('due_date', { ascending: true })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Tareas</h1>
          <p className="text-sm text-gray-400 mt-0.5">{tareas?.length ?? 0} tareas</p>
        </div>
        <Link href="/tareas/nueva" className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
          <Plus size={15} /> Nueva tarea
        </Link>
      </div>

      {!tareas?.length ? (
        <div className="text-center py-20 text-gray-400">
          <CheckSquare size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay tareas aún</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {tareas.map(t => (
            <Link key={t.id} href={`/tareas/${t.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {(t.project as any)?.client?.name} · {(t.project as any)?.name}
                  {(t.direct_responsible as any)?.full_name && ` · ${(t.direct_responsible as any).full_name}`}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                {t.due_date && (
                  <span className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
                    <Clock size={10}/>{new Date(t.due_date).toLocaleDateString('es-AR')}
                  </span>
                )}
                {t.estimated_hours && <span className="text-xs text-gray-400">{t.estimated_hours}h</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[t.priority]}`}>{t.priority}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[t.status]}`}>{statusLabels[t.status]}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
