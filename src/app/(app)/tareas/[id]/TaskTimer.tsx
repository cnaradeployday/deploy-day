'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Play, Pause, Square, Clock } from 'lucide-react'

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function TaskTimer({ taskId, userId, taskStatus }: {
  taskId: string
  userId: string
  taskStatus: string
}) {
  const router = useRouter()
  const [tracker, setTracker] = useState<any>(null)
  const [elapsed, setElapsed] = useState(0)
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadTracker()
  }, [taskId])

  useEffect(() => {
    if (tracker?.is_running) {
      const secondsSinceStart = Math.floor((Date.now() - new Date(tracker.started_at).getTime()) / 1000)
      setElapsed(tracker.total_seconds + secondsSinceStart)
      intervalRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - new Date(tracker.started_at).getTime()) / 1000)
        setElapsed(tracker.total_seconds + secs)
      }, 1000)
    } else if (tracker) {
      setElapsed(tracker.total_seconds)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [tracker])

  async function loadTracker() {
    const sb = createClient()
    const { data } = await sb.from('time_trackers')
      .select('*').eq('task_id', taskId).eq('user_id', userId).single()
    if (data) setTracker(data)
  }

  async function start() {
    setLoading(true)
    const sb = createClient()
    if (tracker) {
      const { data } = await sb.from('time_trackers')
        .update({ is_running: true, started_at: new Date().toISOString(), paused_at: null })
        .eq('id', tracker.id).select().single()
      setTracker(data)
    } else {
      const { data } = await sb.from('time_trackers')
        .insert({ task_id: taskId, user_id: userId, started_at: new Date().toISOString(), total_seconds: 0, is_running: true })
        .select().single()
      setTracker(data)
      // Avanzar estado a en_proceso si estaba estimado
      if (taskStatus === 'estimado') {
        await sb.from('tasks').update({ status: 'en_proceso' }).eq('id', taskId)
        router.refresh()
      }
    }
    setLoading(false)
  }

  async function pause() {
    setLoading(true)
    const sb = createClient()
    const secondsSinceStart = Math.floor((Date.now() - new Date(tracker.started_at).getTime()) / 1000)
    const newTotal = tracker.total_seconds + secondsSinceStart
    const { data } = await sb.from('time_trackers')
      .update({ is_running: false, paused_at: new Date().toISOString(), total_seconds: newTotal })
      .eq('id', tracker.id).select().single()
    setTracker(data)
    setLoading(false)
  }

  async function stop() {
    if (!confirm('¿Detener el timer y registrar las horas?')) return
    setLoading(true)
    const sb = createClient()
    let totalSeconds = tracker.total_seconds
    if (tracker.is_running) {
      totalSeconds += Math.floor((Date.now() - new Date(tracker.started_at).getTime()) / 1000)
    }
    const hoursLogged = Math.round((totalSeconds / 3600) * 100) / 100
    if (hoursLogged > 0) {
      await sb.from('time_entries').insert({
        task_id: taskId, user_id: userId,
        hours_logged: hoursLogged,
        entry_date: new Date().toISOString().split('T')[0],
        notes: `Registrado via timer (${formatTime(totalSeconds)})`
      })
    }
    await sb.from('time_trackers').delete().eq('id', tracker.id)
    setTracker(null)
    setElapsed(0)
    setLoading(false)
    router.refresh()
  }

  const isRunning = tracker?.is_running ?? false
  const hasTracker = !!tracker

  if (!['estimado', 'en_proceso'].includes(taskStatus)) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
        <Clock size={14} className="text-[#1B9BF0]"/> Cronómetro
      </p>

      <div className="flex flex-col items-center">
        {/* Display */}
        <div className={`text-5xl font-mono font-bold tracking-tight mb-6 transition-colors ${
          isRunning ? 'text-[#1B9BF0]' : hasTracker ? 'text-amber-500' : 'text-gray-300'
        }`}>
          {formatTime(elapsed)}
        </div>

        {/* Indicador */}
        <div className="flex items-center gap-2 mb-6">
          <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-[#1B9BF0] animate-pulse' : hasTracker ? 'bg-amber-400' : 'bg-gray-200'}`}/>
          <span className="text-xs text-gray-400">
            {isRunning ? 'Corriendo' : hasTracker ? 'Pausado' : 'Sin iniciar'}
          </span>
        </div>

        {/* Controles */}
        <div className="flex items-center gap-3 w-full">
          {!hasTracker && (
            <button onClick={start} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
              <Play size={15} fill="white"/> Iniciar
            </button>
          )}
          {hasTracker && !isRunning && (
            <button onClick={start} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
              <Play size={15} fill="white"/> Reanudar
            </button>
          )}
          {hasTracker && isRunning && (
            <button onClick={pause} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
              <Pause size={15}/> Pausar
            </button>
          )}
          {hasTracker && (
            <button onClick={stop} disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
              <Square size={14} fill="currentColor"/> Stop
            </button>
          )}
        </div>

        {hasTracker && elapsed > 0 && (
          <p className="text-xs text-gray-400 mt-3 text-center">
            Al hacer Stop se registrarán {Math.round((elapsed / 3600) * 100) / 100}h automáticamente
          </p>
        )}
      </div>
    </div>
  )
}
