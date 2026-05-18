'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, UserCheck, Clock } from 'lucide-react'
import { logActivity } from '@/lib/logActivity'

export default function TaskActions({ task, userId, userRole, timeEntries, isDirectResponsible, canCargarHorasOtros = false }: {
  task: { id: string; status: string; estimated_hours: number | null }
  userId: string
  userRole: string
  timeEntries: any[]
  isDirectResponsible?: boolean
  canCargarHorasOtros?: boolean
}) {
  const router = useRouter()
  const [hours, setHours] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [targetUserId, setTargetUserId] = useState(userId)
  const [usuarios, setUsuarios] = useState<{ id: string; full_name: string }[]>([])
  const [timerSecs, setTimerSecs] = useState(0)

  const isAdmin = userRole === 'admin'
  const isGerente = userRole === 'gerente_operaciones'
  const canManage = isAdmin || isGerente
  const showUserSelector = canCargarHorasOtros || canManage
  const timerKey = `timer_${task.id}_${userId}`

  // Poll localStorage to detect active timer for this task
  useEffect(() => {
    function readTimer() {
      try {
        const raw = localStorage.getItem(timerKey)
        if (!raw) { setTimerSecs(0); return }
        const data = JSON.parse(raw)
        const secs = data.isPaused || !data.start
          ? (data.accumulatedSeconds ?? 0)
          : (data.accumulatedSeconds ?? 0) + Math.floor((Date.now() - new Date(data.start).getTime()) / 1000)
        setTimerSecs(secs)
      } catch { setTimerSecs(0) }
    }
    readTimer()
    const iv = setInterval(readTimer, 1000)
    return () => clearInterval(iv)
  }, [timerKey])

  useEffect(() => {
    if (!showUserSelector) return
    createClient()
      .from('users')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => setUsuarios(data ?? []))
  }, [showUserSelector])

  const transitions: Record<string, { next: string; label: string; who: 'all' | 'manage' | 'responsible' }> = {
    creado:    { next: 'estimado',   label: 'Iniciar tarea',          who: 'all' },
    estimado:  { next: 'en_proceso', label: 'Marcar en proceso',      who: 'all' },
    en_proceso:{ next: 'terminado',  label: 'Marcar como terminado',  who: 'all' },
    terminado: { next: 'presentado', label: 'Marcar como presentado', who: 'responsible' },
  }

  const t = transitions[task.status]
  const canTransition = t && (
    t.who === 'all' ||
    (t.who === 'manage' && canManage) ||
    (t.who === 'responsible' && (isDirectResponsible || canManage))
  )

  const timerHours = Math.round((timerSecs / 3600) * 100) / 100
  const hasActiveTimer = timerSecs > 0

  async function changeStatus() {
    if (!t) return
    setLoading(true)
    setErrorMsg(null)

    // If there's an active timer, save the time and clear it
    if (hasActiveTimer) {
      const { error: timeError } = await createClient().from('time_entries').insert({
        task_id: task.id,
        user_id: userId,
        hours_logged: timerHours,
        entry_date: new Date().toISOString().split('T')[0],
        notes: 'Registrado con cronómetro',
      })
      if (!timeError) {
        localStorage.removeItem(timerKey)
        setTimerSecs(0)
      }
    }

    const { error } = await createClient().from('tasks').update({ status: t.next }).eq('id', task.id)
    if (error) { setErrorMsg('Error al cambiar estado: ' + error.message); setLoading(false); return }
    logActivity({ action: 'cambiar estado', section: 'tareas', entityId: task.id, detail: task.status + ' → ' + t.next })
    router.refresh()
    setLoading(false)
  }

  async function logTime() {
    if (!hours || parseFloat(hours) <= 0) return
    setLoading(true)
    setErrorMsg(null)

    const finalUserId = showUserSelector ? targetUserId : userId
    const targetUser = usuarios.find(u => u.id === finalUserId)
    const isLoadingForOther = finalUserId !== userId

    const { error } = await createClient().from('time_entries').insert({
      task_id: task.id,
      user_id: finalUserId,
      hours_logged: parseFloat(hours),
      entry_date: date,
      notes: notes || null
    })
    if (error) { setErrorMsg('Error al registrar horas: ' + error.message); setLoading(false); return }

    logActivity({
      action: 'cargar horas',
      section: 'horas',
      entityId: task.id,
      detail: hours + 'h' + (isLoadingForOther ? ' para ' + (targetUser?.full_name ?? finalUserId) : '')
    })

    setHours(''); setNotes('')
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600">
          {errorMsg}
        </div>
      )}

      {canTransition && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Cambiar estado</p>
          {task.status === 'terminado' && !isDirectResponsible && !canManage && (
            <p className="text-xs text-amber-600 mb-3 bg-amber-50 px-3 py-2 rounded-xl">
              Solo el responsable directo puede marcar como Presentado
            </p>
          )}
          {hasActiveTimer && (
            <div className="flex items-center gap-2 mb-3 bg-green-50 px-3 py-2 rounded-xl">
              <Clock size={11} className="text-green-600 shrink-0"/>
              <p className="text-xs text-green-700">
                Al avanzar se guardarán <strong>{timerHours}h</strong> del cronómetro activo
              </p>
            </div>
          )}
          <button onClick={changeStatus} disabled={loading}
            className="w-full bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {loading
              ? <><Loader2 size={15} className="animate-spin"/> Guardando...</>
              : hasActiveTimer
                ? `${t.label} + guardar ${timerHours}h`
                : t.label
            }
          </button>
        </div>
      )}

      {task.status === 'en_proceso' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Cargar horas</p>

          {showUserSelector && usuarios.length > 0 && (
            <div className="mb-3">
              <label className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                <UserCheck size={11}/> Cargar para
              </label>
              <select
                value={targetUserId}
                onChange={e => setTargetUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white"
              >
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}{u.id === userId ? ' (yo)' : ''}
                  </option>
                ))}
              </select>
              {targetUserId !== userId && (
                <p className="text-xs text-amber-600 mt-1.5 bg-amber-50 px-2 py-1 rounded-lg">
                  Estás cargando horas en nombre de otro usuario
                </p>
              )}
            </div>
          )}

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
            className="w-full bg-black hover:bg-gray-800 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={15} className="animate-spin"/> Guardando...</> : 'Registrar horas'}
          </button>
        </div>
      )}
    </div>
  )
}
