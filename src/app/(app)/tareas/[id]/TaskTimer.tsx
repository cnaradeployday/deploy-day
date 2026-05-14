'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Play, Square, Pause, Save, Clock } from 'lucide-react'

export default function TaskTimer({ taskId, userId, taskStatus, taskTitle = '' }: {
  taskId: string
  userId: string
  taskStatus?: string
  taskTitle?: string
}) {
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [pausedSeconds, setPausedSeconds] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const storageKey = `timer_${taskId}_${userId}`
  const activeKey = `active_timer_${userId}`

  function saveActiveTimer(state: { running: boolean; paused: boolean; seconds: number }) {
    if (state.running) {
      localStorage.setItem(activeKey, JSON.stringify({ taskId, taskTitle }))
    } else {
      const existing = localStorage.getItem(activeKey)
      if (existing) {
        try { if (JSON.parse(existing).taskId === taskId) localStorage.removeItem(activeKey) } catch {}
      }
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const { start, accumulatedSeconds, isPaused } = JSON.parse(saved)
        if (isPaused) {
          setSeconds(accumulatedSeconds ?? 0)
          setPausedSeconds(accumulatedSeconds ?? 0)
          setRunning(true)
          setPaused(true)
          saveActiveTimer({ running: true, paused: true, seconds: accumulatedSeconds ?? 0 })
        } else {
          const startDate = new Date(start)
          const elapsed = Math.floor((Date.now() - startDate.getTime()) / 1000)
          const total = (accumulatedSeconds ?? 0) + elapsed
          setStartTime(startDate)
          setSeconds(total)
          setPausedSeconds(accumulatedSeconds ?? 0)
          setRunning(true)
          setPaused(false)
          saveActiveTimer({ running: true, paused: false, seconds: total })
        }
      } catch {
        localStorage.removeItem(storageKey)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  useEffect(() => {
    if (running && !paused && startTime) {
      intervalRef.current = setInterval(() => {
        setSeconds(pausedSeconds + Math.floor((Date.now() - startTime.getTime()) / 1000))
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, paused, startTime, pausedSeconds])

  function formatTime(s: number) {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`
  }

  function startTimer() {
    const now = new Date()
    setStartTime(now)
    setRunning(true)
    setPaused(false)
    setSeconds(0)
    setPausedSeconds(0)
    localStorage.setItem(storageKey, JSON.stringify({
      start: now.toISOString(), accumulatedSeconds: 0, isPaused: false
    }))
    localStorage.setItem(activeKey, JSON.stringify({ taskId, taskTitle }))
  }

  function pauseTimer() {
    setPaused(true)
    setPausedSeconds(seconds)
    setStartTime(null)
    localStorage.setItem(storageKey, JSON.stringify({
      start: null, accumulatedSeconds: seconds, isPaused: true
    }))
    localStorage.setItem(activeKey, JSON.stringify({ taskId, taskTitle }))
  }

  function resumeTimer() {
    const now = new Date()
    setStartTime(now)
    setPaused(false)
    localStorage.setItem(storageKey, JSON.stringify({
      start: now.toISOString(), accumulatedSeconds: pausedSeconds, isPaused: false
    }))
    localStorage.setItem(activeKey, JSON.stringify({ taskId, taskTitle }))
  }

  async function saveEntry(andStop: boolean) {
    const hoursLogged = Math.round((seconds / 3600) * 100) / 100
    if (hoursLogged <= 0) return
    setLoading(true)

    const d = new Date()
    const { error } = await createClient().from('time_entries').insert({
      task_id: taskId,
      user_id: userId,
      hours_logged: hoursLogged,
      entry_date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
      notes: 'Registrado con cronómetro'
    })

    if (error) {
      alert('Error al guardar: ' + error.message)
      setLoading(false)
      return
    }

    if (andStop) {
      setRunning(false)
      setPaused(false)
      setSeconds(0)
      setPausedSeconds(0)
      setStartTime(null)
      localStorage.removeItem(storageKey)
      const existing = localStorage.getItem(activeKey)
      if (existing) { try { if (JSON.parse(existing).taskId === taskId) localStorage.removeItem(activeKey) } catch {} }
      router.refresh()
    } else {
      const now = new Date()
      setStartTime(now)
      setPausedSeconds(0)
      setSeconds(0)
      setPaused(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      localStorage.setItem(storageKey, JSON.stringify({
        start: now.toISOString(), accumulatedSeconds: 0, isPaused: false
      }))
      localStorage.setItem(activeKey, JSON.stringify({ taskId, taskTitle }))
      router.refresh()
    }

    setLoading(false)
  }

  const hoursLogged = Math.round((seconds / 3600) * 100) / 100

  if (!running) {
    return (
      <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-3">
        <Clock size={14} className="text-gray-400 shrink-0"/>
        <span className="text-xs text-gray-400 flex-1">Cronómetro</span>
        <button onClick={startTimer}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-semibold transition-all">
          <Play size={11}/> Iniciar
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 space-y-3">
      <div className="flex items-center gap-3">
        <Clock size={14} className={paused ? 'text-amber-400' : 'text-green-500'} />
        <span className="text-lg font-mono font-bold text-gray-900 tabular-nums flex-1">
          {formatTime(seconds)}
        </span>
        {paused
          ? <span className="text-xs text-amber-500 font-medium bg-amber-50 px-2 py-0.5 rounded-full">Pausado</span>
          : <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">Corriendo</span>
        }
      </div>

      {seconds > 0 && (
        <p className="text-xs text-gray-400">{hoursLogged}h a registrar</p>
      )}

      <div className="flex gap-2">
        {paused ? (
          <button onClick={resumeTimer}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-semibold transition-all">
            <Play size={11}/> Reanudar
          </button>
        ) : (
          <button onClick={pauseTimer}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-400 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold transition-all">
            <Pause size={11}/> Pausar
          </button>
        )}

        <button
          onClick={() => saveEntry(false)}
          disabled={loading || seconds < 60}
          title="Guardar horas y seguir contando"
          className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-medium disabled:opacity-40 transition-all">
          <Save size={12}/> {saved ? '¡Guardado!' : 'Guardar'}
        </button>

        <button
          onClick={() => saveEntry(true)}
          disabled={loading || seconds < 10}
          title="Guardar y detener"
          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-all">
          <Square size={11}/> {loading ? '...' : 'Detener'}
        </button>
      </div>
    </div>
  )
}
