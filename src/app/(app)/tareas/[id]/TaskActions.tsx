'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Clock } from 'lucide-react'

export default function TaskActions({ task, userId, userRole, timeEntries, isDirectResponsible }: {
  task: { id: string; status: string; estimated_hours: number | null }
  userId: string
  userRole: string
  timeEntries: any[]
  isDirectResponsible?: boolean
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

  // Transiciones válidas según rol
  const getNextStatus = () => {
    if (task.status === 'creado' && canManage) return { next: 'estimado', label: 'Marcar como estimado' }
    if (task.status === 'estimado') return { next: 'en_proceso', label: 'Iniciar tarea' }
    if (task.status === 'en_proceso') return { next: 'terminado', label: 'Marcar como terminado' }
    if (task.status === 'terminado' && isDirectResponsible) return { next: 'presentado', label: 'Marcar como presentado' }
    if (task.status === 'terminado' && canManage) return { next: 'presentado', label: 'Marcar como presentado' }
    return null
  }

  const transition = getNextStatus()

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
      {transition && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Cambiar estado</p>
          {task.status === 'creado' && canManage && (
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">Horas estimadas *</label>
              <input type="number" min="0" step="0.5" value={estimatedHours}
                onChange={e => setEstimatedHours(e.target.value)} placeholder="Ej: 16"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
            </div>
          )}
          {task.status === 'terminado' && !isDirectResponsible && !canManage && (
            <p className="text-xs text-amber-600 mb-3 bg-amber-50 px-3 py-2 rounded-xl">
              Solo el responsable directo puede marcar como Presentado
            </p>
          )}
          <button onClick={changeStatus} disabled={loading}
            className="w-full bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
            {loading ? 'Guardando...' : transition.label}
          </button>
        </div>
      )}

      {task.status === 'en_proceso' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Plus size={14}/> Cargar horas
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Horas *</label>
              <input type="number" min="0.5" step="0.5" value={hours}
                onChange={e => setHours(e.target.value)} placeholder="2"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fecha</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
            </div>
          </div>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Notas (opcional)"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] mb-3"/>
          <button onClick={logTime} disabled={loading || !hours}
            className="w-full bg-black hover:bg-gray-800 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
            {loading ? 'Guardando...' : 'Registrar horas'}
          </button>
        </div>
      )}
    </div>
  )
}
