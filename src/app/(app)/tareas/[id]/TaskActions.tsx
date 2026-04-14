'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Clock } from 'lucide-react'

const transitions: Record<string, { next: string; label: string }> = {
  creado: { next: 'estimado', label: 'Marcar como estimado' },
  estimado: { next: 'en_proceso', label: 'Iniciar tarea' },
  en_proceso: { next: 'terminado', label: 'Marcar como terminado' },
  terminado: { next: 'presentado', label: 'Marcar como presentado' },
}

export default function TaskActions({ task, userId, userRole, timeEntries }: {
  task: { id: string; status: string; estimated_hours: number | null }
  userId: string
  userRole: string
  timeEntries: any[]
}) {
  const router = useRouter()
  const [hours, setHours] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [estimatedHours, setEstimatedHours] = useState('')

  const isAdmin = userRole === 'admin'
  const isGerente = userRole === 'gerente_operaciones'
  const canManage = isAdmin || isGerente
  const transition = transitions[task.status]

  async function changeStatus() {
    if (!transition) return
    setLoading(true)
    const sb = createClient()

    if (task.status === 'creado' && canManage) {
      if (!estimatedHours) { alert('Ingresá las horas estimadas'); setLoading(false); return }
      await sb.from('tasks').update({ status: 'estimado', estimated_hours: parseFloat(estimatedHours) }).eq('id', task.id)
    } else {
      await sb.from('tasks').update({ status: transition.next }).eq('id', task.id)
    }
    router.refresh()
    setLoading(false)
  }

  async function logTime() {
    if (!hours || parseFloat(hours) <= 0) return
    setLoading(true)
    const sb = createClient()
    await sb.from('time_entries').insert({
      task_id: task.id, user_id: userId,
      hours_logged: parseFloat(hours),
      entry_date: date, notes: notes || null
    })
    setHours(''); setNotes('')
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      {/* Cambio de estado */}
      {transition && (task.status !== 'creado' || canManage) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Cambiar estado</p>
          {task.status === 'creado' && canManage && (
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">Horas estimadas *</label>
              <input type="number" min="0" step="0.5" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)}
                placeholder="Ej: 16" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
          )}
          <button onClick={changeStatus} disabled={loading}
            className="w-full bg-black text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
            {loading ? 'Guardando...' : transition.label}
          </button>
        </div>
      )}

      {/* Cargar horas */}
      {task.status === 'en_proceso' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2"><Plus size={14}/>Cargar horas</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Horas *</label>
              <input type="number" min="0.5" step="0.5" value={hours} onChange={e => setHours(e.target.value)}
                placeholder="2" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fecha</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            </div>
          </div>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas (opcional)"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black mb-3" />
          <button onClick={logTime} disabled={loading || !hours}
            className="w-full bg-black text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
            {loading ? 'Guardando...' : 'Registrar horas'}
          </button>
        </div>
      )}

      {/* Historial de horas */}
      {timeEntries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2"><Clock size={14}/>Historial de horas</p>
          <div className="space-y-2">
            {timeEntries.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-gray-700">{e.user?.full_name}</p>
                  {e.notes && <p className="text-xs text-gray-400">{e.notes}</p>}
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{e.hours_logged}h</p>
                  <p className="text-xs text-gray-400">{new Date(e.entry_date).toLocaleDateString('es-AR')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
