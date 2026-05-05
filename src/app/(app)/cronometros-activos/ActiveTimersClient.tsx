'use client'
import { useEffect, useState } from 'react'
import { getActiveTimers, subscribeToChanges, ActiveTimerEntry } from '@/lib/activeTimersChannel'
import { Timer, Clock, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { formatTimerSeconds } from '@/hooks/useGlobalTimer'

export default function ActiveTimersClient({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<ActiveTimerEntry[]>([])
  const [now, setNow] = useState(Date.now())

  // Tick every second to update elapsed times in the UI
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Subscribe to the shared presence channel (no new channel created here)
  useEffect(() => {
    function refresh() {
      setUsers(getActiveTimers())
    }
    // Initial load after channel syncs
    refresh()
    const unsub = subscribeToChanges(currentUserId, refresh)
    return unsub
  }, [currentUserId])

  function elapsed(startedAt: string) {
    return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000))
  }

  function relativeTime(startedAt: string) {
    const diffMin = Math.floor((now - new Date(startedAt).getTime()) / 60000)
    if (diffMin < 1) return 'hace menos de 1 min'
    if (diffMin < 60) return `hace ${diffMin} min`
    const h = Math.floor(diffMin / 60)
    const m = diffMin % 60
    return `hace ${h}h ${m}m`
  }

  return (
    <div>
      {users.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Timer size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">Ningún usuario tiene un cronómetro activo en este momento</p>
          <p className="text-xs text-gray-300 mt-1">Los cronómetros aparecen acá en tiempo real cuando alguien los inicia</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map(u => (
            <div key={u.userId} className="bg-white rounded-2xl border border-green-200 px-5 py-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <span className="text-sm font-semibold text-green-700">{u.fullName[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-800">{u.fullName}</p>
                  {u.userId === currentUserId && (
                    <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">vos</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Clock size={11} className="text-gray-400 shrink-0" />
                  <Link href={`/tareas/${u.taskId}`} className="text-xs text-gray-500 hover:text-[#1B9BF0] hover:underline truncate max-w-[200px]">
                    {u.taskTitle || 'Tarea'}
                  </Link>
                  <ExternalLink size={9} className="text-gray-300 shrink-0" />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Iniciado {relativeTime(u.startedAt)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-lg font-bold text-green-700 tabular-nums">
                  {formatTimerSeconds(elapsed(u.startedAt))}
                </p>
                <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Corriendo
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
