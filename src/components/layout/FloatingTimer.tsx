'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePathname, useRouter } from 'next/navigation'
import { Pause, Play, Square, ExternalLink, X, GripHorizontal } from 'lucide-react'
import Link from 'next/link'

interface ActiveTimer {
  taskId: string
  taskTitle: string
  start: string | null
  accumulated: number
  isPaused: boolean
}

function useDraggable() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragging = useRef(false)
  const offset = useRef({ x: 0, y: 0 })
  const elementRef = useRef<HTMLDivElement>(null)

  function onMouseDown(e: React.MouseEvent) {
    dragging.current = true
    const rect = elementRef.current?.getBoundingClientRect()
    const currentPos = pos ?? (rect ? { x: rect.left, y: rect.top } : { x: e.clientX - 110, y: e.clientY - 30 })
    offset.current = { x: e.clientX - currentPos.x, y: e.clientY - currentPos.y }
    e.preventDefault()
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return
      setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y })
    }
    function onUp() { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  return { pos, onMouseDown, elementRef }
}

export default function FloatingTimer({ userId, userName }: { userId: string; userName: string }) {
  const { pos, onMouseDown, elementRef } = useDraggable()
  const [timer, setTimer] = useState<ActiveTimer | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [saving, setSaving] = useState(false)
  const channelRef = useRef<any>(null)
  const tickRef = useRef<NodeJS.Timeout | null>(null)
  const titleCacheRef = useRef<Record<string, string>>({})
  const supabase = useMemo(() => createClient(), [])
  const pathname = usePathname()
  const router = useRouter()

  function scan(): { taskId: string; data: any } | null {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('timer_')) continue
      const parts = key.split('_')
      if (parts.length !== 3 || parts[2] !== userId) continue
      try {
        const data = JSON.parse(localStorage.getItem(key)!)
        return { taskId: parts[1], data }
      } catch {}
    }
    return null
  }

  async function getTitle(taskId: string): Promise<string> {
    if (titleCacheRef.current[taskId]) return titleCacheRef.current[taskId]
    const { data } = await supabase.from('tasks').select('title').eq('id', taskId).single()
    const title = data?.title ?? 'Tarea'
    titleCacheRef.current[taskId] = title
    return title
  }

  // Presence channel — broadcasts this user's timer to everyone
  useEffect(() => {
    if (!userId) return
    const ch = supabase.channel('deployday-timers', { config: { presence: { key: userId } } })
    ch.subscribe()
    channelRef.current = ch
    return () => { supabase.removeChannel(ch); channelRef.current = null }
  }, [userId, supabase])

  // Poll localStorage every second for timer changes, broadcast via presence
  useEffect(() => {
    if (!userId) return
    let lastSig = ''

    const poll = setInterval(async () => {
      const found = scan()
      if (found) {
        const { taskId, data } = found
        const sig = `${taskId}|${data.start}|${data.isPaused}`
        if (sig !== lastSig) {
          lastSig = sig
          const title = await getTitle(taskId)
          const t: ActiveTimer = {
            taskId, taskTitle: title,
            start: data.start ?? null,
            accumulated: data.accumulatedSeconds ?? 0,
            isPaused: data.isPaused ?? false,
          }
          setTimer(t)
          setDismissed(false)
          try {
            await channelRef.current?.track({
              full_name: userName,
              task_id: taskId,
              task_title: title,
              started_at: data.start ?? null,
              accumulated_seconds: data.accumulatedSeconds ?? 0,
              is_paused: data.isPaused ?? false,
            })
          } catch {}
        }
      } else if (lastSig) {
        lastSig = ''
        setTimer(null)
        try { await channelRef.current?.untrack() } catch {}
      }
    }, 1000)

    return () => clearInterval(poll)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userName])

  // Tick elapsed display
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current)
    if (!timer) { setElapsed(0); return }
    if (timer.isPaused || !timer.start) { setElapsed(timer.accumulated); return }
    const startMs = new Date(timer.start).getTime()
    const upd = () => setElapsed(timer.accumulated + Math.floor((Date.now() - startMs) / 1000))
    upd()
    tickRef.current = setInterval(upd, 1000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [timer])

  function pauseFromBubble() {
    if (!timer) return
    const storageKey = `timer_${timer.taskId}_${userId}`
    const updated = { start: null, accumulatedSeconds: elapsed, isPaused: true }
    localStorage.setItem(storageKey, JSON.stringify(updated))
    setTimer(t => t ? { ...t, start: null, accumulated: elapsed, isPaused: true } : null)
  }

  function resumeFromBubble() {
    if (!timer) return
    const storageKey = `timer_${timer.taskId}_${userId}`
    const now = new Date().toISOString()
    const updated = { start: now, accumulatedSeconds: elapsed, isPaused: false }
    localStorage.setItem(storageKey, JSON.stringify(updated))
    setTimer(t => t ? { ...t, start: now, accumulated: elapsed, isPaused: false } : null)
  }

  async function stopFromBubble() {
    if (!timer || saving) return
    const hours = Math.round((elapsed / 3600) * 100) / 100
    if (hours < 0.01) { dismissBubble(); return }
    setSaving(true)
    const d = new Date()
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    const { error } = await supabase.from('time_entries').insert({
      task_id: timer.taskId, user_id: userId,
      hours_logged: hours, entry_date: dateStr,
      notes: 'Registrado con cronómetro'
    })
    if (error) { alert('Error al guardar: ' + error.message); setSaving(false); return }
    localStorage.removeItem(`timer_${timer.taskId}_${userId}`)
    localStorage.removeItem(`active_timer_${userId}`)
    try { await channelRef.current?.untrack() } catch {}
    setTimer(null)
    setSaving(false)
    router.refresh()
  }

  function dismissBubble() {
    if (!timer) return
    localStorage.removeItem(`timer_${timer.taskId}_${userId}`)
    localStorage.removeItem(`active_timer_${userId}`)
    try { channelRef.current?.untrack() } catch {}
    setTimer(null)
  }

  const onTaskPage = timer ? pathname === `/tareas/${timer.taskId}` : false
  if (!timer || dismissed || onTaskPage) return null

  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`

  const style: React.CSSProperties = pos
    ? { position: 'fixed', left: pos.x, top: pos.y }
    : { position: 'fixed', bottom: '1.5rem', right: '1.5rem' }

  return (
    <div ref={elementRef} style={style} className="z-50 bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden min-w-[220px] max-w-[280px]">
      {/* Drag handle */}
      <div onMouseDown={onMouseDown}
        className="flex items-center justify-center py-1 cursor-grab active:cursor-grabbing bg-gray-50 border-b border-gray-100">
        <GripHorizontal size={14} className="text-gray-300"/>
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${timer.isPaused ? 'bg-amber-400' : 'bg-green-500 animate-pulse'}`}/>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 truncate">{timer.taskTitle}</p>
          <p className="text-sm font-mono font-bold text-gray-900 tabular-nums">{timeStr}</p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {timer.isPaused ? (
            <button onClick={resumeFromBubble} title="Reanudar"
              className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 transition-all">
              <Play size={12}/>
            </button>
          ) : (
            <button onClick={pauseFromBubble} title="Pausar"
              className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-all">
              <Pause size={12}/>
            </button>
          )}
          <button onClick={stopFromBubble} disabled={saving} title="Guardar y detener"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50">
            <Square size={12}/>
          </button>
          <Link href={`/tareas/${timer.taskId}`} title="Ir a la tarea"
            className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
            <ExternalLink size={12}/>
          </Link>
          <button onClick={dismissBubble} title="Cerrar"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
            <X size={12}/>
          </button>
        </div>
      </div>
      <div className={`h-0.5 ${timer.isPaused ? 'bg-amber-400' : 'bg-green-500'}`}/>
    </div>
  )
}
