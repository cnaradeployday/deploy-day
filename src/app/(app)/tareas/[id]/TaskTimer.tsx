'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Play, Square, Clock } from 'lucide-react'
import { formatTimerSeconds } from '@/hooks/useGlobalTimer'
import { trackTimerActive, trackTimerInactive } from '@/lib/activeTimersChannel'

// Max sensible duration: 16 hours in seconds
const MAX_SECONDS = 16 * 3600

function parseStoredTimer(raw: string): { seconds: number; fakeStartTime: Date } | null {
  try {
    const data = JSON.parse(raw)

    // Old format had isPaused: true with start: null — discard
    if (data.isPaused) return null

    // Must have a valid start timestamp
    if (!data.start) return null
    const startDate = new Date(data.start)
    if (isNaN(startDate.getTime())) return null

    const elapsed = Math.floor((Date.now() - startDate.getTime()) / 1000)
    const accumulated = typeof data.accumulatedSeconds === 'number' ? data.accumulatedSeconds : 0
    const total = accumulated + elapsed

    // Sanity cap: discard if over 16h (most likely a stale/corrupt entry)
    if (total > MAX_SECONDS) return null

    // Encode total into a fake start time so the tick formula (Date.now() - startTime) works
    const fakeStartTime = new Date(Date.now() - total * 1000)
    return { seconds: total, fakeStartTime }
  } catch {
    return null
  }
}

export default function TaskTimer({
  taskId, taskTitle, userId, userName = '',
}: {
  taskId: string
  taskTitle: string
  userId: string
  userName?: string
}) {
  const [running, setRunning] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const router = useRouter()
  const storageKey = `timer_${taskId}_${userId}`

  // Restore from localStorage on mount — validates and clears corrupt entries
  useEffect(() => {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return

    const parsed = parseStoredTimer(raw)
    if (!parsed) {
      // Invalid / stale / paused-old-format — clear it
      localStorage.removeItem(storageKey)
      return
    }

    setStartTime(parsed.fakeStartTime)
    setSeconds(parsed.seconds)
    setRunning(true)
    // Re-broadcast presence in case of page reload
    trackTimerActive(userId, userName, taskId, taskTitle)
  }, [storageKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live tick: seconds = elapsed since startTime
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

  function startTimer() {
    const now = new Date()
    setStartTime(now)
    setRunning(true)
    setSeconds(0)
    localStorage.setItem(`task_title_${taskId}`, taskTitle)
    localStorage.setItem(storageKey, JSON.stringify({
      start: now.toISOString(),
      accumulatedSeconds: 0,
    }))
    trackTimerActive(userId, userName, taskId, taskTitle)
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
    setStartTime(null)
    localStorage.removeItem(storageKey)
    localStorage.removeItem(`task_title_${taskId}`)
    trackTimerInactive(userId, userName)
    router.refresh()
    setLoading(false)
  }

  if (!running) {
    return (
      <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-3">
        <Clock size={14} className="text-gray-400 shrink-0" />
        <span className="text-xs text-gray-400 flex-1">Cronómetro</span>
        <button
          onClick={startTimer}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-semibold transition-all"
        >
          <Play size={11} /> Iniciar
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-green-200 px-4 py-3 space-y-3">
      <div className="flex items-center gap-3">
        <Clock size={14} className="text-green-500 animate-pulse" />
        <span className="text-lg font-mono font-bold text-gray-900 tabular-nums flex-1">
          {formatTimerSeconds(seconds)}
        </span>
        <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">
          Corriendo
        </span>
      </div>

      {seconds > 0 && (
        <p className="text-xs text-gray-400">
          {Math.round((seconds / 3600) * 100) / 100}h a registrar al detener
        </p>
      )}

      <button
        onClick={stopAndSave}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
      >
        <Square size={13} />
        {loading ? 'Guardando...' : 'Detener y guardar'}
      </button>
    </div>
  )
}
