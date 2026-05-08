'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { X, ExternalLink } from 'lucide-react'

interface ActiveTimer {
  taskId: string
  taskTitle: string
  start: string | null
  accumulated: number
  isPaused: boolean
}

export default function FloatingTimer({ userId, userName }: { userId: string; userName: string }) {
  const [timer, setTimer] = useState<ActiveTimer | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const channelRef = useRef<any>(null)
  const tickRef = useRef<NodeJS.Timeout | null>(null)
  const titleCacheRef = useRef<Record<string, string>>({})
  const supabase = useMemo(() => createClient(), [])
  const pathname = usePathname()

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

  // Presence channel for broadcasting to ActiveTimers section
  useEffect(() => {
    if (!userId) return
    const ch = supabase.channel('deployday-timers', { config: { presence: { key: userId } } })
    ch.subscribe()
    channelRef.current = ch
    return () => { supabase.removeChannel(ch); channelRef.current = null }
  }, [userId])

  // Poll localStorage every second for timer changes
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
  }, [userId, userName])

  // Tick elapsed time display
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

  const onTaskPage = timer ? pathname === `/tareas/${timer.taskId}` : false
  if (!timer || dismissed || onTaskPage) return null

  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  const dot = timer.isPaused ? 'bg-amber-400' : 'bg-green-500 animate-pulse'
  const bar = timer.isPaused ? 'bg-amber-400' : 'bg-green-500'

  return (
    <div className="fixed top-16 right-4 md:top-4 md:right-6 z-50 bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`}/>
        <div className="min-w-0">
          <p className="text-xs text-gray-400 truncate max-w-[130px]">{timer.taskTitle}</p>
          <p className="text-sm font-mono font-bold text-gray-900 tabular-nums">{timeStr}</p>
        </div>
        <Link href={`/tareas/${timer.taskId}`}
          className="shrink-0 p-1.5 rounded-xl bg-[#E8F4FE] text-[#1B9BF0] hover:bg-[#1B9BF0] hover:text-white transition-all">
          <ExternalLink size={12}/>
        </Link>
        <button onClick={() => setDismissed(true)} className="shrink-0 text-gray-300 hover:text-gray-500">
          <X size={14}/>
        </button>
      </div>
      <div className={`h-0.5 ${bar}`}/>
    </div>
  )
}
