'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users } from 'lucide-react'

interface OnlineUser {
  user_id: string
  full_name: string
  online_at: string
}

export default function OnlineUsers({ collapsed = false }: { collapsed?: boolean }) {
  const [users, setUsers] = useState<OnlineUser[]>([])
  const [showTooltip, setShowTooltip] = useState(false)
  const [myId, setMyId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sb = createClient()
    let channel: any

    async function init() {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return
      setMyId(user.id)

      const { data: profile } = await sb.from('users').select('full_name').eq('id', user.id).single()
      const myName = profile?.full_name ?? user.email ?? 'Usuario'

      channel = sb.channel('online-users', {
        config: { presence: { key: user.id } }
      })

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState()
          const online: OnlineUser[] = []
          Object.entries(state).forEach(([userId, presences]: [string, any]) => {
            const p = presences[0]
            if (p) online.push({ user_id: userId, full_name: p.full_name ?? 'Usuario', online_at: p.online_at })
          })
          setUsers(online)
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ full_name: myName, online_at: new Date().toISOString() })
          }
        })
    }

    init()
    return () => { if (channel) sb.removeChannel(channel) }
  }, [])

  // Cerrar tooltip al clickear afuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowTooltip(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const count = users.length

  const Tooltip = () => (
    <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-100 rounded-xl shadow-xl z-[999] min-w-[180px] p-2">
      <p className="text-xs font-medium text-gray-400 px-2 pb-1 border-b border-gray-50 mb-1">En línea ahora</p>
      {users.map(u => (
        <div key={u.user_id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"/>
          <span className="text-xs text-gray-700 truncate">
            {u.full_name}{u.user_id === myId ? ' (vos)' : ''}
          </span>
        </div>
      ))}
    </div>
  )

  if (collapsed) {
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setShowTooltip(v => !v)}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-green-50 hover:bg-green-100 transition-all relative"
        >
          <Users size={14} className="text-green-600"/>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {count}
          </span>
        </button>
        {showTooltip && count > 0 && <Tooltip/>}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setShowTooltip(v => !v)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-green-50 hover:bg-green-100 transition-all"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/>
        <span className="text-xs font-semibold text-green-700">{count}</span>
        <Users size={11} className="text-green-600"/>
      </button>
      {showTooltip && count > 0 && (
        <div
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <Tooltip/>
        </div>
      )}
    </div>
  )
}
