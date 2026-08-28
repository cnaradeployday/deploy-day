'use client'
import { useState, useMemo } from 'react'
import { Bell, Clock, AlertTriangle, StickyNote, LayoutGrid, CheckSquare, Timer, Search, X, Check, Target } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { markNotificationRead } from '../novedades/actions'

const TYPE_META: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  task_assigned:             { icon: CheckSquare,   color: 'text-blue-600',   bg: 'bg-blue-100',   label: 'Tarea asignada' },
  task_due_soon:             { icon: AlertTriangle, color: 'text-amber-600',  bg: 'bg-amber-100',  label: 'Vencimiento' },
  hours_overuse_assigned:    { icon: Timer,         color: 'text-red-600',    bg: 'bg-red-100',    label: 'Horas asignadas' },
  hours_overuse_availability:{ icon: Timer,         color: 'text-orange-600', bg: 'bg-orange-100', label: 'Disponibilidad' },
  no_hours_logged:           { icon: Clock,         color: 'text-purple-600', bg: 'bg-purple-100', label: 'Sin horas' },
  prospect_follow_up_overdue:{ icon: Target,        color: 'text-red-600',    bg: 'bg-red-100',    label: 'Seguimiento CRM' },
  postit_shared:             { icon: StickyNote,    color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Post-it compartido' },
  note_received:             { icon: StickyNote,    color: 'text-green-600',  bg: 'bg-green-100',  label: 'Nota recibida' },
  pizarron_new_post:         { icon: LayoutGrid,    color: 'text-indigo-600', bg: 'bg-indigo-100', label: 'Pizarrón' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ayer'
  return `hace ${days} días`
}

function UserAvatar({ url, name }: { url: string | null; name: string }) {
  if (url) return (
    <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 border border-gray-100">
      <Image src={url} alt={name} width={24} height={24} className="object-cover w-full h-full" unoptimized />
    </div>
  )
  return (
    <div className="w-6 h-6 rounded-full bg-[#E8F4FE] flex items-center justify-center text-[10px] font-semibold text-[#1B9BF0] shrink-0">
      {name?.[0]?.toUpperCase()}
    </div>
  )
}

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'task_assigned', label: 'Tareas asignadas' },
  { value: 'task_due_soon', label: 'Vencimientos' },
  { value: 'hours_overuse_assigned', label: 'Horas asignadas' },
  { value: 'hours_overuse_availability', label: 'Disponibilidad' },
  { value: 'no_hours_logged', label: 'Sin horas' },
  { value: 'prospect_follow_up_overdue', label: 'Seguimiento CRM' },
  { value: 'postit_shared', label: 'Post-its compartidos' },
  { value: 'note_received', label: 'Notas recibidas' },
  { value: 'pizarron_new_post', label: 'Pizarrón' },
]

export default function NovedadesEquipoClient({ notifications: initial }: { notifications: any[] }) {
  const [notifications, setNotifications] = useState(initial)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterRead, setFilterRead] = useState<'all' | 'unread' | 'read'>('all')

  // Unique users
  const users = useMemo(() => {
    const map = new Map<string, any>()
    notifications.forEach(n => { if (n.user) map.set(n.user.id, n.user) })
    return [...map.values()].sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [notifications])

  const [filterUser, setFilterUser] = useState('')

  const filtered = useMemo(() => {
    return notifications.filter(n => {
      if (filterUser && n.user_id !== filterUser) return false
      if (filterType && n.type !== filterType) return false
      if (filterRead === 'unread' && n.read_at) return false
      if (filterRead === 'read' && !n.read_at) return false
      if (search) {
        const q = search.toLowerCase()
        if (!n.title.toLowerCase().includes(q) && !(n.body ?? '').toLowerCase().includes(q) && !(n.user?.full_name ?? '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [notifications, filterUser, filterType, filterRead, search])

  async function handleMarkRead(id: string) {
    setNotifications(prev => prev.filter(n => n.id !== id))
    await markNotificationRead(id)
  }

  const unreadCount = notifications.filter(n => !n.read_at).length
  const hasFilters = filterUser || filterType || filterRead !== 'all' || search

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Novedades del equipo</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {unreadCount > 0 ? `${unreadCount} sin leer en el equipo` : 'Todo el equipo al día'} · {notifications.length} novedades en total
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-3 mb-5 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por usuario, título..."
            className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]" />
        </div>
        <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
          className="px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
          <option value="">Todos los usuarios</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
          {TYPE_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {([['all', 'Todos'], ['unread', 'Sin leer'], ['read', 'Leídos']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFilterRead(v)}
              className={'px-3 py-1 rounded-lg text-xs font-medium transition-all ' + (filterRead === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {l}
            </button>
          ))}
        </div>
        {hasFilters && (
          <button onClick={() => { setSearch(''); setFilterUser(''); setFilterType(''); setFilterRead('all') }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
            <X size={11} /> Limpiar
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-3">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</p>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-300">
          <Bell size={40} className="mb-3 opacity-30" />
          <p className="text-sm text-gray-400">Sin resultados</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
        {filtered.map(n => {
          const meta = TYPE_META[n.type] ?? { icon: Bell, color: 'text-gray-500', bg: 'bg-gray-100', label: '' }
          const Icon = meta.icon
          const isUnread = !n.read_at
          return (
            <div key={n.id}
              className={`flex gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50 ${isUnread ? 'bg-blue-50/30' : ''}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${meta.bg}`}>
                <Icon size={15} className={meta.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <UserAvatar url={n.user?.avatar_url ?? null} name={n.user?.full_name ?? '?'} />
                  <span className="text-xs font-semibold text-gray-600">{n.user?.full_name ?? '—'}</span>
                  <span className="text-[10px] text-gray-300">·</span>
                  <span className="text-[10px] text-gray-300">{meta.label}</span>
                  {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-auto shrink-0" />}
                </div>
                <p className={`text-sm font-medium leading-snug ${isUnread ? 'text-gray-900' : 'text-gray-500'}`}>{n.title}</p>
                {n.body && <p className="text-xs text-gray-400 mt-0.5">{n.body}</p>}
                {(n.metadata?.client_name || n.metadata?.project_name) && (
                  <p className="text-[10px] text-[#1B9BF0] mt-0.5 font-medium">
                    {[n.metadata.client_name, n.metadata.project_name].filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-gray-300">{timeAgo(n.created_at)}</span>
                  {n.link && (
                    <Link href={n.link} className="text-[10px] text-[#1B9BF0] hover:underline font-medium">Ver →</Link>
                  )}
                  <button onClick={() => handleMarkRead(n.id)}
                    className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
                    <Check size={10} /> Leído
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
