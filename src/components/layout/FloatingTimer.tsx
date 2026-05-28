'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Square, GripHorizontal, ChevronUp, Clock } from 'lucide-react'
import Link from 'next/link'

interface TimerEntry {
  taskId: string
  taskTitle: string
  userId: string
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

export default function FloatingTimer({ userId, userName }: { userId: string; userName?: string }) {
  const [timers, setTimers] = useState<TimerEntry[]>([])
  const [stoppingIds, setStoppingIds] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState(true)
  const [pos, setPos] = useState({ x: -1, y: -1 })
  const dragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, x: 0, y: 0 })
  const hasDragged = useRef(false)
  const posRef = useRef({ x: 0, y: 0 })
  const presenceChannelRef = useRef<any>(null)
  const router = useRouter()

  function readTimers(): TimerEntry[] {
    const results: TimerEntry[] = []
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key?.startsWith('timer_') || key === 'timer_bubble_pos') continue
        const raw = localStorage.getItem(key)
        if (!raw) continue
        const data = JSON.parse(raw)
        if (data.userId !== userId || !data.taskId) continue
        results.push(data as TimerEntry)
      }
    } catch {}
    return results
  }

  function sendBroadcast(ch: any, currentTimers: TimerEntry[]) {
    if (!ch) return
    ch.send({
      type: 'broadcast',
      event: 'timer-state',
      payload: {
        userId,
        userName: userName ?? userId,
        timers: currentTimers.map(t => ({
          taskId: t.taskId,
          taskTitle: t.taskTitle,
          start: t.start,
          accumulatedSeconds: t.accumulatedSeconds,
          isPaused: t.isPaused,
        })),
      },
    })
  }

  useEffect(() => {
    const initial = readTimers()
    setTimers(initial)

    const sb = createClient()
    const ch = sb.channel('timers-live', {
      config: { broadcast: { self: false } },
    })
    presenceChannelRef.current = ch
    ch.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') sendBroadcast(ch, initial)
    })

    const iv = setInterval(() => {
      const current = readTimers()
      setTimers(current)
      sendBroadcast(presenceChannelRef.current, current)
    }, 2000)

    return () => {
      clearInterval(iv)
      sb.removeChannel(ch)
      presenceChannelRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('timer_bubble_pos')
      if (saved) {
        const p = JSON.parse(saved)
        const x = Math.max(8, Math.min(window.innerWidth - 280, p.x ?? window.innerWidth - 300))
        const y = Math.max(8, Math.min(window.innerHeight - 100, p.y ?? window.innerHeight - 100))
        setPos({ x, y })
        posRef.current = { x, y }
      } else {
        const x = window.innerWidth - 300
        const y = window.innerHeight - 90
        setPos({ x, y })
        posRef.current = { x, y }
      }
    } catch {
      const x = window.innerWidth - 300
      const y = window.innerHeight - 90
      setPos({ x, y })
      posRef.current = { x, y }
    }
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    hasDragged.current = false
    dragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, x: posRef.current.x, y: posRef.current.y }

    function onMove(ev: MouseEvent) {
      if (!dragging.current) return
      const dx = ev.clientX - dragStart.current.mx
      const dy = ev.clientY - dragStart.current.my
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged.current = true
      const newPos = {
        x: Math.max(8, Math.min(window.innerWidth - 280, dragStart.current.x + dx)),
        y: Math.max(8, Math.min(window.innerHeight - 60, dragStart.current.y + dy)),
      }
      posRef.current = newPos
      setPos(newPos)
    }

    function onUp() {
      dragging.current = false
      try { localStorage.setItem('timer_bubble_pos', JSON.stringify(posRef.current)) } catch {}
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  async function stopTimer(taskId: string) {
    if (stoppingIds.has(taskId)) return
    const entry = timers.find(t => t.taskId === taskId)
    if (!entry) return
    setStoppingIds(prev => new Set(prev).add(taskId))
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
    window.dispatchEvent(new CustomEvent('timer-stopped', { detail: { taskId } }))
    const updated = timers.filter(t => t.taskId !== taskId)
    setTimers(updated)
    setStoppingIds(prev => { const s = new Set(prev); s.delete(taskId); return s })
    sendBroadcast(presenceChannelRef.current, updated)
    router.refresh()
  }

  if (timers.length === 0 || pos.x === -1) return null

  return (
    <div className="fixed z-50 select-none" style={{ left: pos.x, top: pos.y }}>
      <div className="bg-gray-900 rounded-2xl shadow-2xl overflow-hidden w-72"
        style={{ cursor: dragging.current ? 'grabbing' : 'default' }}>

        <div onMouseDown={onMouseDown}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 cursor-grab active:cursor-grabbing">
          <GripHorizontal size={13} className="text-gray-500"/>
          <Clock size={12} className="text-gray-400"/>
          <p className="text-xs font-semibold text-gray-300 flex-1">Cronómetros activos</p>
          <button onClick={() => !hasDragged.current && setExpanded(e => !e)}
            onMouseDown={e => e.stopPropagation()}
            className="p-0.5 rounded hover:bg-gray-700 transition-all">
            <ChevronUp size={13} className={`text-gray-400 transition-transform ${expanded ? '' : 'rotate-180'}`}/>
          </button>
        </div>

        {expanded && (
          <div className="divide-y divide-gray-800 max-h-80 overflow-y-auto">
            {timers.map(entry => {
              const secs = calcSeconds(entry)
              return (
                <div key={entry.taskId} className="px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full shrink-0 bg-green-400 animate-pulse"/>
                    <Link href={`/tareas/${entry.taskId}`}
                      className="text-xs text-gray-300 hover:text-white transition-colors flex-1 line-clamp-1">
                      {entry.taskTitle}
                    </Link>
                    <span className="text-sm font-mono font-bold text-white tabular-nums shrink-0">{formatTime(secs)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => stopTimer(entry.taskId)}
                      disabled={stoppingIds.has(entry.taskId)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50">
                      <Square size={10}/> {stoppingIds.has(entry.taskId) ? 'Guardando...' : 'Detener y guardar'}
                    </button>
                    <span className="text-[10px] text-gray-500 shrink-0">{(Math.round((secs / 3600) * 100) / 100)}h</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!expanded && (
          <div className="px-3 py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0 bg-green-400 animate-pulse"/>
            <span className="text-sm font-mono font-bold text-white tabular-nums flex-1">{formatTime(calcSeconds(timers[0]))}</span>
            {timers.length > 1 && (
              <span className="text-[10px] text-gray-400">+{timers.length - 1} más</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
