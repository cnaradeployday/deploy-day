'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users } from 'lucide-react'

interface OnlineUser {
  user_id: string
  full_name: string
}

const _state = {
  channel: null as any,
  myId: null as string | null,
  users: [] as OnlineUser[],
  listeners: new Set<(u: OnlineUser[]) => void>(),
  initialized: false,
}

function broadcast(users: OnlineUser[]) {
  _state.users = users
  _state.listeners.forEach(fn => fn([...users]))
}

async function init() {
  if (_state.initialized) return
  _state.initialized = true

  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) { _state.initialized = false; return }
  _state.myId = user.id

  const { data: profile } = await sb.from('users').select('full_name').eq('id', user.id).single()
  const myName = profile?.full_name ?? user.email ?? 'Usuario'

  // Canal compartido — todos los usuarios deben usar el mismo nombre
  const CHANNEL_NAME = 'deployday-online-users'

  // Remover canal anterior si existe (por hot reload en dev)
  if (_state.channel) {
    try { await sb.removeChannel(_state.channel) } catch {}
    _state.channel = null
  }

  const channel = sb.channel(CHANNEL_NAME, {
    config: { presence: { key: user.id } }
  })
  _state.channel = channel

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState()
    const online: OnlineUser[] = Object.entries(state).map(([uid, presences]: [string, any]) => ({
      user_id: uid,
      full_name: presences[0]?.full_name ?? 'Usuario',
    }))
    broadcast(online)
  })

  channel.subscribe(async (status: string) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({ full_name: myName, online_at: new Date().toISOString() })
    }
  })
}

export default function OnlineUsers({ collapsed = false, canSee = true }: { collapsed?: boolean; canSee?: boolean }) {
  const [users, setUsers] = useState<OnlineUser[]>(_state.users)
  const [myId, setMyId] = useState<string | null>(_state.myId)
  const [showTooltip, setShowTooltip] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const listener = (u: OnlineUser[]) => {
      setUsers(u)
      setMyId(_state.myId)
    }
    _state.listeners.add(listener)
    init().then(() => {
      setMyId(_state.myId)
      setUsers([..._state.users])
    })
    return () => { _state.listeners.delete(listener) }
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowTooltip(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!canSee) return null

  const count = users.length

  const Tooltip = ({ up = false }: { up?: boolean }) => (
    <div className={`absolute ${up ? 'bottom-full mb-2' : 'top-full mt-1'} left-0 bg-white border border-gray-100 rounded-xl shadow-xl z-[999] min-w-[180px] p-2`}>
      <p className="text-xs font-medium text-gray-400 px-2 pb-1 border-b border-gray-50 mb-1">En línea ahora</p>
      {users.length === 0
        ? <p className="text-xs text-gray-400 px-2 py-1">Solo vos en este momento</p>
        : users.map(u => (
          <div key={u.user_id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0"/>
            <span className="text-xs text-gray-700 truncate">
              {u.full_name}{u.user_id === myId ? ' (vos)' : ''}
            </span>
          </div>
        ))
      }
    </div>
  )

  if (collapsed) {
    return (
      <div ref={ref} className="relative">
        <button onClick={() => setShowTooltip(v => !v)}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-green-50 hover:bg-green-100 transition-all relative">
          <Users size={14} className="text-green-600"/>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {count}
          </span>
        </button>
        {showTooltip && <Tooltip up/>}
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
      {showTooltip && (
        <div onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
          <Tooltip/>
        </div>
      )}
    </div>
  )
}
