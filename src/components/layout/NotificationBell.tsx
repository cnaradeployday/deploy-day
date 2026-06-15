'use client'
import { useState, useEffect, useRef, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, X, Check, CheckCheck, Clock, AlertTriangle, StickyNote, LayoutGrid, CheckSquare, Timer, Loader2 } from 'lucide-react'
import { checkComputedNotifications, fetchNotifications, markNotificationRead, markAllNotificationsRead } from '@/app/(app)/novedades/actions'
import Link from 'next/link'

const TYPE_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  task_assigned:            { icon: CheckSquare,   color: 'text-blue-600',   bg: 'bg-blue-50' },
  task_due_soon:            { icon: AlertTriangle, color: 'text-amber-600',  bg: 'bg-amber-50' },
  hours_overuse_assigned:   { icon: Timer,         color: 'text-red-600',    bg: 'bg-red-50' },
  hours_overuse_availability:{ icon: Timer,        color: 'text-orange-600', bg: 'bg-orange-50' },
  no_hours_logged:          { icon: Clock,         color: 'text-purple-600', bg: 'bg-purple-50' },
  postit_shared:            { icon: StickyNote,    color: 'text-yellow-600', bg: 'bg-yellow-50' },
  note_received:            { icon: StickyNote,    color: 'text-green-600',  bg: 'bg-green-50' },
  pizarron_new_post:        { icon: LayoutGrid,    color: 'text-indigo-600', bg: 'bg-indigo-50' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `hace ${days}d`
}

export default function NotificationBell({ userId, collapsed }: { userId: string; collapsed: boolean }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const panelRef = useRef<HTMLDivElement>(null)

  // Initial unread count on mount
  useEffect(() => {
    if (!userId) return
    const sb = createClient()
    sb.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).is('read_at', null)
      .then(({ count }) => setUnread(count ?? 0))

    const channel = sb.channel('notif-bell-' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (p) => {
          setUnread(u => u + 1)
          setNotifications(prev => [p.new as any, ...prev])
        })
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [userId])

  // Close when clicking outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function handleOpen() {
    if (open) { setOpen(false); return }
    setOpen(true)
    setLoading(true)
    // Run computed checks + fetch
    startTransition(async () => {
      await checkComputedNotifications()
      const result = await fetchNotifications()
      setNotifications(result.data)
      setUnread(result.unread)
      setLoading(false)
    })
  }

  async function handleMarkRead(id: string, link?: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    setUnread(u => Math.max(0, u - 1))
    await markNotificationRead(id)
    if (link) setOpen(false)
  }

  async function handleMarkAll() {
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    setUnread(0)
    await markAllNotificationsRead()
  }

  const badgeNum = unread > 9 ? '9+' : String(unread)

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
          open ? 'bg-[#E8F4FE] text-[#1B9BF0]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        <div className="relative shrink-0">
          <Bell size={15} strokeWidth={open ? 2 : 1.5} color={open ? '#1B9BF0' : '#6b7280'} />
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none px-0.5">
              {badgeNum}
            </span>
          )}
        </div>
        {!collapsed && <span className="flex-1 text-left">Novedades</span>}
        {!collapsed && unread > 0 && (
          <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">{badgeNum}</span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="fixed z-[60] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ top: 8, left: collapsed ? 64 : 232, width: 360, maxHeight: 'calc(100vh - 16px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-[#1B9BF0]" />
              <p className="text-sm font-semibold text-gray-900">Novedades</p>
              {unread > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">{badgeNum} sin leer</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button onClick={handleMarkAll} title="Marcar todo como leído"
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all">
                  <CheckCheck size={14} />
                </button>
              )}
              <button onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {(loading || isPending) && notifications.length === 0 && (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={20} className="animate-spin text-gray-300" />
              </div>
            )}

            {!loading && !isPending && notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-300">
                <Bell size={32} className="mb-3 opacity-40" />
                <p className="text-sm">Sin novedades por ahora</p>
              </div>
            )}

            {notifications.map(n => {
              const meta = TYPE_META[n.type] ?? { icon: Bell, color: 'text-gray-500', bg: 'bg-gray-50' }
              const Icon = meta.icon
              const isUnread = !n.read_at
              return (
                <div key={n.id}
                  className={`group flex gap-3 px-4 py-3 border-b border-gray-50 transition-colors hover:bg-gray-50 ${isUnread ? 'bg-blue-50/30' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${meta.bg}`}>
                    <Icon size={14} className={meta.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs font-semibold leading-snug ${isUnread ? 'text-gray-900' : 'text-gray-600'}`}>
                        {n.title}
                      </p>
                      {isUnread && (
                        <button onClick={() => handleMarkRead(n.id)}
                          className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-gray-200 transition-all"
                          title="Marcar como leído">
                          <Check size={11} className="text-gray-400" />
                        </button>
                      )}
                    </div>
                    {n.body && <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{n.body}</p>}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-gray-300">{timeAgo(n.created_at)}</span>
                      {n.link && (
                        <Link href={n.link} onClick={() => handleMarkRead(n.id, n.link)}
                          className="text-[10px] text-[#1B9BF0] hover:underline font-medium">
                          Ver →
                        </Link>
                      )}
                    </div>
                  </div>
                  {isUnread && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-2" />}
                </div>
              )
            })}

            {(loading || isPending) && notifications.length > 0 && (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={14} className="animate-spin text-gray-300" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
