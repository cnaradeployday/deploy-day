'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Play, Square, Clock } from 'lucide-react'
import { formatTimerSeconds } from '@/hooks/useGlobalTimer'

const TIMER_CHANNEL = 'deployday-active-timers'
let _presenceChannel: any = null

async function getPresenceChannel(userId: string): Promise<any> {
  if (_presenceChannel) return _presenceChannel
  const sb = createClient()
  const ch = sb.channel(TIMER_CHANNEL, { config: { presence: { key: userId } } })
  _presenceChannel = ch
  await new Promise<void>(res => ch.subscribe(s => { if (s === 'SUBSCRIBED') res() }))
  return ch
}

async function trackTimerStart(userId: string, fullName: string, taskId: string, taskTitle: string) {
  const ch = await getPresenceChannel(userId)
  await ch.track({ has_timer: true, full_name: fullName, task_id: taskId, task_title: taskTitle, started_at: new Date().toISOString() })
}

async function trackTimerStop(userId: string, fullName: string) {
  const ch = await getPresenceChannel(userId)
  await ch.track({ has_timer: false, full_name: fullName })
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

  // Restore from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const { start, accumulatedSeconds } = JSON.parse(saved)
        const startDate = new Date(start)
        const elapsed = Math.floor((Date.now() - startDate.getTime()) / 1000)
        const total = (accumulatedSeconds ?? 0) + elapsed
        setStartTime(startDate)
        setSeconds(total)
        setRunning(true)
        // Re-broadcast presence in case of page reload
        trackTimerStart(userId, userName, taskId, taskTitle)
      } catch {
        localStorage.removeItem(storageKey)
      }
    }
  }, [storageKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live tick
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
    trackTimerStart(userId, userName, taskId, taskTitle)
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
    trackTimerStop(userId, userName)
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
