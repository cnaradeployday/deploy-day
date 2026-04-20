'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users } from 'lucide-react'

interface OnlineUser {
  user_id: string
  full_name: string
}

// ── Singleton global ──────────────────────────────────────────────────────────
// El componente se monta DOS veces (sidebar desktop + header mobile).
// Usamos variables fuera del módulo para que compartan un único canal de presencia.
let _channel: any = null
let _myId: string | null = null
let _users: OnlineUser[] = []
let _listeners: Set<(u: OnlineUser[]) => void> = new Set()
let _ready = false

function broadcast(users: OnlineUser[]) {
  _users = users
  _listeners.forEach(fn => fn(users))
}

async function ensureChannel() {
  if (_ready) return
  _ready = true // marcar antes de await para evitar doble init

  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) { _ready = false; return }
  _myId = user.id

  const { data: profile } = await sb.from('users').select('full_name').eq('id', user.id).single()
  const myName = profile?.full_name ?? user.email ?? 'Usuario'

  const channel = sb.channel('dd-presence-v4', {
    config: { presence: { key: user.id } }
  })
  _channel = channel

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
// ─────────────────────────────────────────────────────────────────────────────

export default function OnlineUsers({ collapsed = false }: { collapsed?: boolean }) {
  const [users, setUsers] = useState<OnlineUser[]>(_users)
  const [myId, setMyId] = useState<string | null>(_myId)
  const [showTooltip, setShowTooltip] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Suscribirse a updates del singleton
    const listener = (u: OnlineUser[]) => {
      setUsers([...u])
      setMyId(_myId)
    }
    _listeners.add(listener)

    // Arrancar el canal (idempotente)
    ensureChannel().then(() => {
      setMyId(_myId)
      setUsers([..._users])
    })

    return () => { _listeners.delete(listener) }
  }, [])

  // Cerrar tooltip al clickear afuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowTooltip(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const count = users.length

  const Tooltip = ({ up = false }: { up?: boolean }) => (
    <div className={`absolute ${up ? 'bottom-full mb-2' : 'top-full mt-1'} left-0 bg-white border border-gray-100 rounded-xl shadow-xl z-[999] min-w-[180px] p-2`}>
      <p className="text-xs font-medium text-gray-400 px-2 pb-1 border-b border-gray-50 mb-1">En línea ahora</p>
      {count === 0
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
