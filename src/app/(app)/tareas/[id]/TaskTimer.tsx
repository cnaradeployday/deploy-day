'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Play, Square, Clock } from 'lucide-react'

export default function TaskTimer({ taskId, userId, taskTitle, taskStatus }: { taskId: string; userId: string; taskTitle?: string; taskStatus?: string }) {
  const [running, setRunning] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [loading, setLoading] = useState(false)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [accumulatedSeconds, setAccumulatedSeconds] = useState(0)
  const [timerError, setTimerError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const storageKey = `timer_${taskId}_${userId}`

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const { start, accumulatedSeconds: acc, isPaused } = JSON.parse(saved)
        if (isPaused) {
          setSeconds(acc ?? 0)
          setAccumulatedSeconds(acc ?? 0)
          setRunning(true)
        } else {
          const startDate = new Date(start)
          const elapsed = Math.floor((Date.now() - startDate.getTime()) / 1000)
          const total = (acc ?? 0) + elapsed
          setStartTime(startDate)
          setAccumulatedSeconds(acc ?? 0)
          setSeconds(total)
          setRunning(true)
        }
      } catch {
        localStorage.removeItem(storageKey)
      }
    }
  }, [storageKey])

  useEffect(() => {
    function handleTimerStopped(e: Event) {
      const { taskId: stoppedId } = (e as CustomEvent).detail
      if (stoppedId !== taskId) return
      setRunning(false)
      setSeconds(0)
      setAccumulatedSeconds(0)
      setStartTime(null)
    }
    window.addEventListener('timer-stopped', handleTimerStopped)
    return () => window.removeEventListener('timer-stopped', handleTimerStopped)
  }, [taskId])

  useEffect(() => {
    if (running && startTime) {
      intervalRef.current = setInterval(() => {
        setSeconds(accumulatedSeconds + Math.floor((Date.now() - startTime.getTime()) / 1000))
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, startTime, accumulatedSeconds])

  function formatTime(s: number) {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`
  }

  function startTimer() {
    setTimerError(null)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith('timer_') || key === 'timer_bubble_pos' || key === storageKey) continue
      try {
        const data = JSON.parse(localStorage.getItem(key) ?? '{}')
        if (data.userId === userId) {
          setTimerError(`Tenés el cronómetro de "${data.taskTitle ?? 'otra tarea'}" en curso. Detenelo antes de iniciar uno nuevo.`)
          return
        }
      } catch {}
    }

    const now = new Date()
    setStartTime(now)
    setRunning(true)
    setSeconds(0)
    setAccumulatedSeconds(0)
    localStorage.setItem(storageKey, JSON.stringify({
      taskId, taskTitle: taskTitle ?? 'Tarea', userId,
      start: now.toISOString(), accumulatedSeconds: 0, isPaused: false
    }))
  }

  async function stopAndSave() {
    const hoursLogged = Math.round((seconds / 3600) * 100) / 100
    if (hoursLogged <= 0) {
      setRunning(false)
      setSeconds(0)
      setAccumulatedSeconds(0)
      setStartTime(null)
      localStorage.removeItem(storageKey)
      return
    }
    setLoading(true)

    const { error } = await createClient().from('time_entries').insert({
      task_id: taskId,
      user_id: userId,
      hours_logged: hoursLogged,
      entry_date: new Date().toISOString().split('T')[0],
      notes: 'Registrado con cronómetro'
    })

    if (error) {
      alert('Error al guardar: ' + error.message)
      setLoading(false)
      return
    }

    setRunning(false)
    setSeconds(0)
    setAccumulatedSeconds(0)
    setStartTime(null)
    localStorage.removeItem(storageKey)
    router.refresh()
    setLoading(false)
  }

  const hoursLogged = Math.round((seconds / 3600) * 100) / 100

  if (!running) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-3">
          <Clock size={14} className="text-gray-400 shrink-0"/>
          <span className="text-xs text-gray-400 flex-1">Cronómetro</span>
          <button onClick={startTimer}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-semibold transition-all">
            <Play size={11}/> Iniciar
          </button>
        </div>
        {timerError && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-xl">
            {timerError}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 space-y-3">
      <div className="flex items-center gap-3">
        <Clock size={14} className="text-green-500"/>
        <span className="text-lg font-mono font-bold text-gray-900 tabular-nums flex-1">
          {formatTime(seconds)}
        </span>
        <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">Corriendo</span>
      </div>

      {seconds > 0 && (
        <p className="text-xs text-gray-400">{hoursLogged}h a registrar</p>
      )}

      <button
        onClick={stopAndSave}
        disabled={loading}
        className="w-full flex items-center justify-center gap-1.5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-all">
        <Square size={11}/> {loading ? 'Guardando...' : 'Detener y guardar'}
      </button>
    </div>
  )
}
