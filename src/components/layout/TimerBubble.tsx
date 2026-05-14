'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Play, Square, Pause, ExternalLink, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

function formatTime(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`
}

function localDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function TimerBubble({ userId }: { userId: string }) {
  const [activeTask, setActiveTask] = useState<{ taskId: string; taskTitle: string } | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [paused, setPaused] = useState(false)
  const [saving, setSaving] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const activeKey = `active_timer_${userId}`

  function readTimerState(taskId: string) {
    const raw = localStorage.getItem(`timer_${taskId}_${userId}`)
    if (!raw) return null
    try {
      const { start, accumulatedSeconds, isPaused } = JSON.parse(raw)
      if (isPaused) return { seconds: accumulatedSeconds ?? 0, paused: true }
      const elapsed = Math.floor((Date.now() - new Date(start).getTime()) / 1000)
      return { seconds: (accumulatedSeconds ?? 0) + elapsed, paused: false }
    } catch { return null }
  }

  function syncFromStorage() {
    const raw = localStorage.getItem(activeKey)
    if (!raw) { setActiveTask(null); return }
    try {
      const { taskId, taskTitle } = JSON.parse(raw)
      const state = readTimerState(taskId)
      if (!state) { setActiveTask(null); return }
      setActiveTask({ taskId, taskTitle })
      setSeconds(state.seconds)
      setPaused(state.paused)
    } catch { setActiveTask(null) }
  }

  useEffect(() => {
    syncFromStorage()
    // Poll localStorage every 2s to detect changes from other tabs/pages
    const poll = setInterval(syncFromStorage, 2000)
    return () => clearInterval(poll)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (activeTask && !paused) {
      intervalRef.current = setInterval(() => {
        if (!activeTask) return
        const state = readTimerState(activeTask.taskId)
        if (state) setSeconds(state.seconds)
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTask, paused])

  function pauseFromBubble() {
    if (!activeTask) return
    const storageKey = `timer_${activeTask.taskId}_${userId}`
    setPaused(true)
    localStorage.setItem(storageKey, JSON.stringify({ start: null, accumulatedSeconds: seconds, isPaused: true }))
    localStorage.setItem(activeKey, JSON.stringify({ taskId: activeTask.taskId, taskTitle: activeTask.taskTitle }))
    window.dispatchEvent(new Event('timer-bubble-action'))
  }

  function resumeFromBubble() {
    if (!activeTask) return
    const storageKey = `timer_${activeTask.taskId}_${userId}`
    const now = new Date()
    setPaused(false)
    localStorage.setItem(storageKey, JSON.stringify({ start: now.toISOString(), accumulatedSeconds: seconds, isPaused: false }))
    localStorage.setItem(activeKey, JSON.stringify({ taskId: activeTask.taskId, taskTitle: activeTask.taskTitle }))
    window.dispatchEvent(new Event('timer-bubble-action'))
  }

  async function stopFromBubble() {
    if (!activeTask) return
    const hoursLogged = Math.round((seconds / 3600) * 100) / 100
    if (hoursLogged < 0.01) { dismissBubble(); return }
    setSaving(true)
    const { error } = await createClient().from('time_entries').insert({
      task_id: activeTask.taskId,
      user_id: userId,
      hours_logged: hoursLogged,
      entry_date: localDateStr(),
      notes: 'Registrado con cronómetro'
    })
    if (error) { alert('Error al guardar: ' + error.message); setSaving(false); return }
    localStorage.removeItem(`timer_${activeTask.taskId}_${userId}`)
    localStorage.removeItem(activeKey)
    setActiveTask(null)
    setSaving(false)
    router.refresh()
  }

  function dismissBubble() {
    localStorage.removeItem(`timer_${activeTask?.taskId}_${userId}`)
    localStorage.removeItem(activeKey)
    setActiveTask(null)
  }

  if (!activeTask) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-white border border-gray-200 rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3 min-w-[220px] max-w-[280px]">
      <div className={'w-2.5 h-2.5 rounded-full shrink-0 ' + (paused ? 'bg-amber-400' : 'bg-green-500 animate-pulse')}/>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 truncate">{activeTask.taskTitle}</p>
        <p className="text-sm font-mono font-bold text-gray-900">{formatTime(seconds)}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {paused ? (
          <button onClick={resumeFromBubble} title="Reanudar"
            className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 transition-all">
            <Play size={13}/>
          </button>
        ) : (
          <button onClick={pauseFromBubble} title="Pausar"
            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-all">
            <Pause size={13}/>
          </button>
        )}
        <button onClick={stopFromBubble} disabled={saving} title="Guardar y detener"
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50">
          <Square size={13}/>
        </button>
        <Link href={'/tareas/' + activeTask.taskId} title="Ir a la tarea"
          className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
          <ExternalLink size={13}/>
        </Link>
        <button onClick={dismissBubble} title="Cerrar (descarta horas sin guardar)"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
          <X size={13}/>
        </button>
      </div>
    </div>
  )
}
