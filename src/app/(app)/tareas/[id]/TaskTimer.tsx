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
    if (data.isPaused) return null
    if (!data.start) return null
    const startDate = new Date(data.start)
    if (isNaN(startDate.getTime())) return null
    const elapsed = Math.floor((Date.now() - startDate.getTime()) / 1000)
    const accumulated = typeof data.accumulatedSeconds === 'number' ? data.accumulatedSeconds : 0
    const total = accumulated + elapsed
    if (total > MAX_SECONDS) return null
    const fakeStartTime = new Date(Date.now() - total * 1000)
    return { seconds: total, fakeStartTime }
  } catch {
    return null
  }
}

// Returns the title of an already-running timer for this user (different task), or null
function findOtherRunningTimer(userId: string, currentTaskId: string): string | null {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith('timer_')) continue
    if (!key.endsWith(`_${userId}`)) continue
    // Skip the current task's own key
    if (key === `timer_${currentTaskId}_${userId}`) continue
    const raw = localStorage.getItem(key)
    if (!raw) continue
    const parsed = parseStoredTimer(raw)
    if (!parsed) {
      localStorage.removeItem(key) // clean up invalid entries
      continue
    }
    const taskId = key.split('_')[1]
    return localStorage.getItem(`task_title_${taskId}`) ?? 'otra tarea'
  }
  return null
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
  const [conflictTask, setConflictTask] = useState<string | null>(null)
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
    const other = findOtherRunningTimer(userId, taskId)
    if (other) {
      setConflictTask(other)
      return
    }
    setConflictTask(null)
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
      <div className="space-y-2">
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
        {conflictTask && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
            <p className="font-semibold mb-0.5">Ya tenés un cronómetro activo</p>
            <p>Detené el cronómetro de <span className="font-medium">"{conflictTask}"</span> antes de iniciar uno nuevo.</p>
          </div>
        )}
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
