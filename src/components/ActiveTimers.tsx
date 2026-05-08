'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface TimerEntry {
  userId: string
  fullName: string
  taskId: string
  taskTitle: string
  startedAt: string | null
  accumulated: number
  isPaused: boolean
}

export default function ActiveTimers() {
  const [timers, setTimers] = useState<TimerEntry[]>([])
  const [, setTick] = useState(0)

  useEffect(() => {
    const sb = createClient()
    const ch = sb.channel('deployday-timers')

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState()
      const entries: TimerEntry[] = []
      for (const [uid, presences] of Object.entries(state)) {
        const p = (presences as any[])[0]
        if (p?.task_id) {
          entries.push({
            userId: uid,
            fullName: p.full_name ?? '',
            taskId: p.task_id,
            taskTitle: p.task_title ?? '',
            startedAt: p.started_at ?? null,
            accumulated: p.accumulated_seconds ?? 0,
            isPaused: p.is_paused ?? false,
          })
        }
      }
      setTimers(entries)
    })

    ch.subscribe()
    const ticker = setInterval(() => setTick(t => t + 1), 1000)
    return () => { sb.removeChannel(ch); clearInterval(ticker) }
  }, [])

  if (timers.length === 0) return null

  function elapsed(t: TimerEntry): number {
    if (t.isPaused || !t.startedAt) return t.accumulated
    return t.accumulated + Math.floor((Date.now() - new Date(t.startedAt).getTime()) / 1000)
  }

  function fmt(s: number): string {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-gray-700">Cronómetros en curso</h2>
        <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
          {timers.length} activo{timers.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {timers.map(t => (
          <div key={t.userId} className="flex items-center gap-4 px-5 py-3.5">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 shrink-0">
              {t.fullName[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{t.fullName}</p>
              <Link href={`/tareas/${t.taskId}`} className="text-xs text-[#1B9BF0] hover:underline truncate block">
                {t.taskTitle}
              </Link>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-mono font-bold text-gray-900 tabular-nums">{fmt(elapsed(t))}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${t.isPaused ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                {t.isPaused ? 'Pausado' : 'Corriendo'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
