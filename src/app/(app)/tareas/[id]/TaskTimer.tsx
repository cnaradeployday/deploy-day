'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Play, Square, Pause, Save, Clock } from 'lucide-react'

export default function TaskTimer({ taskId, userId, taskStatus }: { taskId: string; userId: string; taskStatus?: string }) {
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [pausedSeconds, setPausedSeconds] = useState(0) // acumula tiempo pausado
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const storageKey = `timer_${taskId}_${userId}`

  // Restaurar timer de localStorage al montar
  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const { start, accumulatedSeconds, isPaused } = JSON.parse(saved)
        if (isPaused) {
          // Estaba pausado — restaurar segundos acumulados sin correr
          setSeconds(accumulatedSeconds ?? 0)
          setPausedSeconds(accumulatedSeconds ?? 0)
          setRunning(true)
          setPaused(true)
        } else {
          // Estaba corriendo — calcular tiempo transcurrido desde start
          const startDate = new Date(start)
          const elapsed = Math.floor((Date.now() - startDate.getTime()) / 1000)
          const total = (accumulatedSeconds ?? 0) + elapsed
          setStartTime(startDate)
          setSeconds(total)
          setPausedSeconds(accumulatedSeconds ?? 0)
          setRunning(true)
          setPaused(false)
        }
      } catch {
        localStorage.removeItem(storageKey)
      }
    }
  }, [storageKey])

  // Tick del intervalo
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
  }

  function pauseTimer() {
    // Congela los segundos actuales y guarda estado pausado
    setPaused(true)
    setPausedSeconds(seconds)
    setStartTime(null)
    localStorage.setItem(storageKey, JSON.stringify({
      start: null, accumulatedSeconds: seconds, isPaused: true
    }))
  }

  function resumeTimer() {
    const now = new Date()
    setStartTime(now)
    setPaused(false)
    localStorage.setItem(storageKey, JSON.stringify({
      start: now.toISOString(), accumulatedSeconds: pausedSeconds, isPaused: false
    }))
  }

  async function saveEntry(andStop: boolean) {
    const hoursLogged = Math.round((seconds / 3600) * 100) / 100
    if (hoursLogged <= 0) return
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

    if (andStop) {
      // Detener y limpiar
      setRunning(false)
      setPaused(false)
      setSeconds(0)
      setPausedSeconds(0)
      setStartTime(null)
      localStorage.removeItem(storageKey)
      router.refresh()
    } else {
      // Guardar parcial — reiniciar contador sin detener
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
      {/* Tiempo + estado */}
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

      {/* Horas actuales */}
      {seconds > 0 && (
        <p className="text-xs text-gray-400">
          {hoursLogged}h a registrar
        </p>
      )}

      {/* Botones */}
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
