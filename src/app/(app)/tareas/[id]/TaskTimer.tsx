'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Play, Square, Clock } from 'lucide-react'

export default function TaskTimer({ taskId, userId }: { taskId: string; userId: string; taskStatus?: string }) {
  const [running, setRunning] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [loading, setLoading] = useState(false)
  const startTimeRef = useRef<Date | null>(null)
  const accumulatedRef = useRef(0) // seconds before current run
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const storageKey = `timer_${taskId}_${userId}`

  function tick() {
    if (!startTimeRef.current) return
    setSeconds(accumulatedRef.current + Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000))
  }

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const { start, accumulatedSeconds, isPaused } = JSON.parse(saved)
        const acc = accumulatedSeconds ?? 0
        accumulatedRef.current = acc

        if (isPaused || !start) {
          // Resume from accumulated — start counting now
          const now = new Date()
          startTimeRef.current = now
          setSeconds(acc)
          localStorage.setItem(storageKey, JSON.stringify({ start: now.toISOString(), accumulatedSeconds: acc, isPaused: false }))
        } else {
          const startDate = new Date(start)
          startTimeRef.current = startDate
          setSeconds(acc + Math.floor((Date.now() - startDate.getTime()) / 1000))
        }
        setRunning(true)
      } catch {
        localStorage.removeItem(storageKey)
      }
    }
  }, [storageKey])

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (running && startTimeRef.current) {
      intervalRef.current = setInterval(tick, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  function formatTime(s: number) {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`
  }

  function startTimer() {
    const now = new Date()
    startTimeRef.current = now
    accumulatedRef.current = 0
    setRunning(true)
    setSeconds(0)
    localStorage.setItem(storageKey, JSON.stringify({ start: now.toISOString(), accumulatedSeconds: 0, isPaused: false }))
  }

  async function stopAndSave() {
    if (loading) return
    setLoading(true)
    const hoursLogged = Math.round((seconds / 3600) * 100) / 100

    if (hoursLogged > 0) {
      const { error } = await createClient().from('time_entries').insert({
        task_id: taskId,
        user_id: userId,
        hours_logged: hoursLogged,
        entry_date: new Date().toISOString().split('T')[0],
        notes: 'Registrado con cronómetro',
      })
      if (error) {
        alert('Error al guardar: ' + error.message)
        setLoading(false)
        return
      }
    }

    setRunning(false)
    setSeconds(0)
    startTimeRef.current = null
    accumulatedRef.current = 0
    localStorage.removeItem(storageKey)
    setLoading(false)
    router.refresh()
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
        <Clock size={14} className="text-green-500"/>
        <span className="text-lg font-mono font-bold text-gray-900 tabular-nums flex-1">
          {formatTime(seconds)}
        </span>
        <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">Corriendo</span>
      </div>
      {seconds > 0 && (
        <p className="text-xs text-gray-400">{hoursLogged}h a registrar</p>
      )}
      <button onClick={stopAndSave} disabled={loading}
        className="w-full flex items-center justify-center gap-1.5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-all">
        <Square size={11}/> {loading ? 'Guardando...' : 'Detener y guardar'}
      </button>
    </div>
  )
}
