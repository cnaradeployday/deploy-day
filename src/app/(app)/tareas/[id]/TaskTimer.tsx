'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Play, Square, Clock } from 'lucide-react'

export default function TaskTimer({ taskId, userId, taskStatus }: { taskId: string; userId: string; taskStatus?: string }) {
  const [running, setRunning] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [loading, setLoading] = useState(false)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()

  // Usar localStorage para persistir el timer entre navegaciones
  const storageKey = `timer_${taskId}_${userId}`

  useEffect(() => {
    // Restaurar timer de localStorage
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const { start } = JSON.parse(saved)
      const startDate = new Date(start)
      const elapsed = Math.floor((Date.now() - startDate.getTime()) / 1000)
      setStartTime(startDate)
      setSeconds(elapsed)
      setRunning(true)
    }
  }, [storageKey])

  useEffect(() => {
    if (running && startTime) {
      intervalRef.current = setInterval(() => {
        setSeconds(Math.floor((Date.now() - startTime.getTime()) / 1000))
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, startTime])

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
    setSeconds(0)
    localStorage.setItem(storageKey, JSON.stringify({ start: now.toISOString() }))
  }

  async function stopTimer() {
    if (!startTime) return
    setLoading(true)
    const hoursLogged = Math.round((seconds / 3600) * 100) / 100
    if (hoursLogged > 0) {
      await createClient().from('time_entries').insert({
        task_id: taskId,
        user_id: userId,
        hours_logged: hoursLogged,
        entry_date: new Date().toISOString().split('T')[0],
        notes: 'Registrado con cronómetro'
      })
    }
    setRunning(false)
    setSeconds(0)
    setStartTime(null)
    localStorage.removeItem(storageKey)
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-3">
      <Clock size={14} className="text-gray-400"/>
      {running ? (
        <>
          <span className="text-sm font-mono font-semibold text-gray-900 tabular-nums">{formatTime(seconds)}</span>
          <button onClick={stopTimer} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-all">
            <Square size={11}/> {loading ? 'Guardando...' : 'Detener'}
          </button>
        </>
      ) : (
        <>
          <span className="text-xs text-gray-400">Cronómetro</span>
          <button onClick={startTimer}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-semibold transition-all">
            <Play size={11}/> Iniciar
          </button>
        </>
      )}
    </div>
  )
}
