'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Clock, User } from 'lucide-react'
import Link from 'next/link'

interface TimerState {
  taskId: string
  taskTitle: string
  start: string | null
  accumulatedSeconds: number
  isPaused: boolean
}

interface UserState {
  userId: string
  userName: string
  timers: TimerState[]
  lastSeen: number
}

interface TaskInfo {
  title: string
  clientName: string
}

function calcSeconds(t: TimerState): number {
  if (t.isPaused || !t.start) return t.accumulatedSeconds
  return t.accumulatedSeconds + Math.floor((Date.now() - new Date(t.start).getTime()) / 1000)
}

function formatTime(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

export default function CronometrosClient() {
  const [userMap, setUserMap] = useState<Record<string, UserState>>({})
  const [taskInfo, setTaskInfo] = useState<Record<string, TaskInfo>>({})
  const [, setTick] = useState(0)
  const userMapRef = useRef<Record<string, UserState>>({})

  useEffect(() => {
    // Fresh Supabase client (separate WebSocket from the FloatingTimer singleton)
    // so broadcast messages from FloatingTimer are delivered here by the server.
    const sb = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const ch = sb.channel('timers-live')
    ch.on('broadcast', { event: 'timer-state' }, ({ payload }: any) => {
      if (!payload?.userId) return
      const updated = {
        ...userMapRef.current,
        [payload.userId]: {
          userId: payload.userId,
          userName: payload.userName ?? payload.userId,
          timers: payload.timers ?? [],
          lastSeen: Date.now(),
        },
      }
      userMapRef.current = updated
      setUserMap({ ...updated })
    })
    ch.subscribe()

    // Expire stale entries (no broadcast in 8s = timer stopped or user left)
    const expiry = setInterval(() => {
      const now = Date.now()
      const current = userMapRef.current
      const cleaned: Record<string, UserState> = {}
      let changed = false
      for (const [uid, state] of Object.entries(current)) {
        if (now - state.lastSeen < 8000) {
          cleaned[uid] = state
        } else {
          changed = true
        }
      }
      if (changed) {
        userMapRef.current = cleaned
        setUserMap({ ...cleaned })
      }
    }, 3000)

    return () => {
      clearInterval(expiry)
      sb.removeChannel(ch)
    }
  }, [])

  // Live clock tick
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(iv)
  }, [])

  // Fetch task+client info for any new taskIds
  const users = Object.values(userMap).filter(u => u.timers.length > 0)
  useEffect(() => {
    const allTaskIds = [...new Set(users.flatMap(u => u.timers.map(t => t.taskId)))]
    const missing = allTaskIds.filter(id => !taskInfo[id])
    if (missing.length === 0) return

    createClient()
      .from('tasks')
      .select('id, title, project:projects(client:clients(name))')
      .in('id', missing)
      .then(({ data }) => {
        if (!data) return
        setTaskInfo(prev => {
          const next = { ...prev }
          data.forEach((t: any) => {
            next[t.id] = {
              title: t.title,
              clientName: t.project?.client?.name ?? '-',
            }
          })
          return next
        })
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userMap])

  const totalActive = users.reduce((sum, u) => sum + u.timers.length, 0)

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Clock size={20} className="text-[#1B9BF0]"/>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cronómetros activos</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {totalActive === 0
              ? 'Ningún cronómetro activo en este momento'
              : `${totalActive} cronómetro${totalActive !== 1 ? 's' : ''} corriendo`}
          </p>
        </div>
      </div>

      {users.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <Clock size={32} className="text-gray-200 mx-auto mb-3"/>
          <p className="text-sm text-gray-400">No hay cronómetros activos</p>
          <p className="text-xs text-gray-300 mt-1">Aparecerán aquí en tiempo real cuando alguien inicie uno</p>
        </div>
      )}

      {users.map(u => (
        <div key={u.userId} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50 bg-gray-50">
            <User size={13} className="text-gray-400"/>
            <span className="text-sm font-semibold text-gray-700">{u.userName}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {u.timers.map(timer => {
              const secs = calcSeconds(timer)
              const info = taskInfo[timer.taskId]
              return (
                <div key={timer.taskId} className="flex items-center gap-4 px-4 py-3">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <Link href={`/tareas/${timer.taskId}`}
                      className="text-sm font-medium text-gray-800 hover:text-[#1B9BF0] transition-colors line-clamp-1">
                      {info?.title ?? timer.taskTitle}
                    </Link>
                    {info?.clientName && (
                      <p className="text-xs text-gray-400 mt-0.5">{info.clientName}</p>
                    )}
                  </div>
                  <span className="text-base font-mono font-bold text-gray-900 tabular-nums shrink-0">
                    {formatTime(secs)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
