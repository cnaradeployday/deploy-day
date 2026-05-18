'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Play, Pause, Square, GripHorizontal, ChevronUp, X, Clock } from 'lucide-react'
import Link from 'next/link'

interface TimerEntry {
  taskId: string
  taskTitle: string
  start: string | null
  accumulatedSeconds: number
  isPaused: boolean
}

function formatTime(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

function calcSeconds(entry: TimerEntry): number {
  if (entry.isPaused || !entry.start) return entry.accumulatedSeconds
  return entry.accumulatedSeconds + Math.floor((Date.now() - new Date(entry.start).getTime()) / 1000)
}

export default function FloatingTimer({ userId }: { userId: string }) {
  const [timers, setTimers] = useState<TimerEntry[]>([])
  const [tick, setTick] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [pos, setPos] = useState({ right: 24, bottom: 80 })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ mx: number; my: number; right: number; bottom: number } | null>(null)
  const hasDragged = useRef(false)
  const router = useRouter()

  function readTimers(): TimerEntry[] {
    const results: TimerEntry[] = []
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key?.startsWith('timer_')) continue
        const raw = localStorage.getItem(key)
        if (!raw) continue
        const data = JSON.parse(raw)
        if (data.userId !== userId) continue
        results.push(data as TimerEntry)
      }
    } catch {}
    return results
  }

  useEffect(() => {
    setTimers(readTimers())
    const iv = setInterval(() => {
      setTimers(readTimers())
      setTick(t => t + 1)
    }, 1000)
    return () => clearInterval(iv)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Restore saved position
  useEffect(() => {
    try {
      const saved = localStorage.getItem('timer_bubble_pos')
      if (saved) setPos(JSON.parse(saved))
    } catch {}
  }, [])

  // Drag logic
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    hasDragged.current = false
    dragRef.current = { mx: e.clientX, my: e.clientY, right: pos.right, bottom: pos.bottom }
    setDragging(true)
  }, [pos])

  useEffect(() => {
    if (!dragging) return
    function onMove(e: MouseEvent) {
      if (!dragRef.current) return
      const dx = e.clientX - dragRef.current.mx
      const dy = e.clientY - dragRef.current.my
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged.current = true
      const newPos = {
        right: Math.max(8, Math.min(window.innerWidth - 200, dragRef.current.right - dx)),
        bottom: Math.max(8, Math.min(window.innerHeight - 100, dragRef.current.bottom + dy)),
      }
      setPos(newPos)
    }
    function onUp() {
      setDragging(false)
      try { localStorage.setItem('timer_bubble_pos', JSON.stringify(pos)) } catch {}
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [dragging, pos])

  function updateEntry(taskId: string, updates: Partial<TimerEntry>) {
    const key = `timer_${taskId}_${userId}`
    const current = timers.find(t => t.taskId === taskId)
    if (!current) return
    const updated = { ...current, ...updates }
    localStorage.setItem(key, JSON.stringify(updated))
    setTimers(prev => prev.map(t => t.taskId === taskId ? updated : t))
  }

  function pauseTimer(taskId: string) {
    const entry = timers.find(t => t.taskId === taskId)
    if (!entry || entry.isPaused) return
    updateEntry(taskId, { start: null, accumulatedSeconds: calcSeconds(entry), isPaused: true })
  }

  function resumeTimer(taskId: string) {
    const entry = timers.find(t => t.taskId === taskId)
    if (!entry || !entry.isPaused) return
    updateEntry(taskId, { start: new Date().toISOString(), isPaused: false })
  }

  async function stopTimer(taskId: string) {
    const entry = timers.find(t => t.taskId === taskId)
    if (!entry) return
    const secs = calcSeconds(entry)
    const hours = Math.round((secs / 3600) * 100) / 100
    if (hours > 0) {
      await createClient().from('time_entries').insert({
        task_id: taskId, user_id: userId,
        hours_logged: hours,
        entry_date: new Date().toISOString().split('T')[0],
        notes: 'Registrado con cronómetro',
      })
    }
    localStorage.removeItem(`timer_${taskId}_${userId}`)
    setTimers(prev => prev.filter(t => t.taskId !== taskId))
    if (timers.length <= 1) setExpanded(false)
    router.refresh()
  }

  if (timers.length === 0) return null

  const primary = timers[0]
  const primarySecs = calcSeconds(primary)

  return (
    <div
      className="fixed z-50 select-none"
      style={{ right: pos.right, bottom: pos.bottom }}
    >
      {/* Panel expandido */}
      {expanded && (
        <div className="mb-2 bg-white rounded-2xl shadow-2xl border border-gray-100 w-72 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-gray-400" />
              <p className="text-xs font-semibold text-gray-700">Cronómetros activos</p>
            </div>
            <button onClick={() => setExpanded(false)} className="p-0.5 rounded-lg hover:bg-gray-200 transition-all">
              <X size={13} className="text-gray-400" />
            </button>
          </div>
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {timers.map(entry => {
              const secs = calcSeconds(entry)
              return (
                <div key={entry.taskId} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <Link href={`/tareas/${entry.taskId}`}
                      className="text-xs font-medium text-gray-800 hover:text-[#1B9BF0] transition-colors leading-snug line-clamp-2 flex-1">
                      {entry.taskTitle}
                    </Link>
                    <span className="text-sm font-mono font-bold text-gray-900 tabular-nums shrink-0">{formatTime(secs)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {entry.isPaused ? (
                      <button onClick={() => resumeTimer(entry.taskId)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-semibold transition-all">
                        <Play size={10} /> Reanudar
                      </button>
                    ) : (
                      <button onClick={() => pauseTimer(entry.taskId)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-400 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition-all">
                        <Pause size={10} /> Pausar
                      </button>
                    )}
                    <button onClick={() => stopTimer(entry.taskId)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold transition-all">
                      <Square size={10} /> Detener
                    </button>
                    <span className="ml-auto text-[10px] text-gray-400">
                      {(Math.round((secs / 3600) * 100) / 100)}h
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Burbuja principal */}
      <div className={`flex items-center gap-2 rounded-full px-3.5 py-2 shadow-2xl transition-colors
        ${primary.isPaused ? 'bg-gray-800' : 'bg-gray-900'}`}
        style={{ cursor: dragging ? 'grabbing' : 'default' }}>

        {/* Grip (drag handle) */}
        <div onMouseDown={onMouseDown} className="cursor-grab active:cursor-grabbing p-0.5 -ml-0.5">
          <GripHorizontal size={13} className="text-gray-500" />
        </div>

        {/* Indicador estado */}
        <div className={`w-2 h-2 rounded-full shrink-0 ${primary.isPaused ? 'bg-amber-400' : 'bg-green-400 animate-pulse'}`} />

        {/* Tiempo */}
        <span className="text-sm font-mono font-bold text-white tabular-nums">{formatTime(primarySecs)}</span>

        {/* Control principal */}
        {primary.isPaused ? (
          <button onClick={() => !hasDragged.current && resumeTimer(primary.taskId)}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-all" title="Reanudar">
            <Play size={12} />
          </button>
        ) : (
          <button onClick={() => !hasDragged.current && pauseTimer(primary.taskId)}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-all" title="Pausar">
            <Pause size={12} />
          </button>
        )}

        <button onClick={() => !hasDragged.current && stopTimer(primary.taskId)}
          className="p-1.5 rounded-full hover:bg-red-500/80 text-white transition-all" title="Detener y guardar">
          <Square size={12} />
        </button>

        {/* Expandir panel */}
        <button onClick={() => !hasDragged.current && setExpanded(e => !e)}
          className="p-1.5 rounded-full hover:bg-white/20 text-white transition-all" title="Ver todos los cronómetros">
          <ChevronUp size={12} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>

        {/* Badge si hay más de uno */}
        {timers.length > 1 && (
          <span className="w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center leading-none -ml-1">
            {timers.length}
          </span>
        )}
      </div>
    </div>
  )
}
