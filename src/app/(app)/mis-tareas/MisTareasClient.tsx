'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Clock, ChevronRight, Trash2 } from 'lucide-react'

const statusColors: Record<string, string> = {
  creado: 'bg-gray-100 text-gray-500', estimado: 'bg-blue-50 text-blue-600',
  en_proceso: 'bg-amber-50 text-amber-600', terminado: 'bg-green-50 text-green-600',
}
const statusLabels: Record<string, string> = {
  creado: 'Creado', estimado: 'Estimado', en_proceso: 'En proceso', terminado: 'Terminado',
}
const nextStatus: Record<string, { status: string; label: string }> = {
  estimado: { status: 'en_proceso', label: 'Iniciar' },
  en_proceso: { status: 'terminado', label: 'Terminar' },
}

export default function MisTareasClient({ tareas }: { tareas: any[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  const enProceso = tareas.filter(t => t.status === 'en_proceso')
  const pendientes = tareas.filter(t => ['creado','estimado'].includes(t.status))
  const terminadas = tareas.filter(t => t.status === 'terminado')

  async function advanceStatus(taskId: string, newStatus: string) {
    setLoading(taskId)
    await createClient().from('tasks').update({ status: newStatus }).eq('id', taskId)
    router.refresh()
    setLoading(null)
  }

  async function deleteTask(taskId: string) {
    if (!confirm('¿Eliminar esta tarea?')) return
    setLoading(taskId)
    await createClient().from('tasks').delete().eq('id', taskId)
    router.refresh()
    setLoading(null)
  }

  const TaskCard = ({ t }: { t: any }) => {
    const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'terminado'
    const next = nextStatus[t.status]
    const pct = t.estimated_hours ? Math.round((t.hours_logged / t.estimated_hours) * 100) : null

    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-start justify-between mb-1">
          <Link href={`/tareas/${t.id}`} className="text-sm font-medium text-gray-900 hover:text-[#1B9BF0] flex-1 pr-2">
            {t.title}
          </Link>
          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${statusColors[t.status]}`}>
            {statusLabels[t.status]}
          </span>
        </div>
        <p className="text-xs text-gray-400 mb-3">{t.project?.client?.name} · {t.project?.name}</p>

        <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
          {t.due_date && (
            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500' : ''}`}>
              <Clock size={10}/>
              {new Date(t.due_date).toLocaleDateString('es-AR', { day:'numeric', month:'short' })}
              {isOverdue && ' · Vencida'}
            </span>
          )}
          {t.estimated_hours && (
            <span>{t.hours_logged}h / {t.estimated_hours}h</span>
          )}
        </div>

        {pct !== null && (
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div className={`h-full rounded-full ${pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-amber-400' : 'bg-[#1B9BF0]'}`}
              style={{ width: `${Math.min(100, pct)}%` }}/>
          </div>
        )}

        <div className="flex items-center gap-2">
          {next && (
            <button onClick={() => advanceStatus(t.id, next.status)} disabled={loading === t.id}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl text-xs font-semibold transition-all disabled:opacity-50">
              <CheckCircle size={13}/> {next.label}
            </button>
          )}
          <Link href={`/tareas/${t.id}`}
            className="flex items-center justify-center gap-1 px-3 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50">
            Ver <ChevronRight size={12}/>
          </Link>
          <button onClick={() => deleteTask(t.id)} disabled={loading === t.id}
            className="p-1.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
            <Trash2 size={14}/>
          </button>
        </div>
      </div>
    )
  }

  const Section = ({ title, tasks, dot }: { title: string; tasks: any[]; dot: string }) => (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dot}`}/>
        {title} <span className="text-gray-400 font-normal">({tasks.length})</span>
      </h2>
      {!tasks.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-6 text-center text-sm text-gray-400">
          Sin tareas en esta categoría
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(t => <TaskCard key={t.id} t={t}/>)}
        </div>
      )}
    </div>
  )

  return (
    <div>
      <Section title="En proceso" tasks={enProceso} dot="bg-amber-400"/>
      <Section title="Pendientes" tasks={pendientes} dot="bg-blue-400"/>
      <Section title="Terminadas" tasks={terminadas} dot="bg-green-400"/>
    </div>
  )
}
