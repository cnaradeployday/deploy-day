'use client'
import { useState } from 'react'
import { Bell, CheckCheck, Clock, AlertTriangle, StickyNote, LayoutGrid, CheckSquare, Timer, Check } from 'lucide-react'
import { markNotificationRead, markAllNotificationsRead, markTaskDone } from './actions'
import Link from 'next/link'

function extractTaskId(dedupKey: string | null): string | null {
  if (!dedupKey) return null
  const m = dedupKey.match(/^task_(?:due_soon|overdue)_([0-9a-f-]{36})_/)
  return m ? m[1] : null
}

const TYPE_META: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  task_assigned:             { icon: CheckSquare,   color: 'text-blue-600',   bg: 'bg-blue-100',   label: 'Tarea asignada' },
  task_due_soon:             { icon: AlertTriangle, color: 'text-amber-600',  bg: 'bg-amber-100',  label: 'Vencimiento' },
  hours_overuse_assigned:    { icon: Timer,         color: 'text-red-600',    bg: 'bg-red-100',    label: 'Horas asignadas' },
  hours_overuse_availability:{ icon: Timer,         color: 'text-orange-600', bg: 'bg-orange-100', label: 'Disponibilidad' },
  no_hours_logged:           { icon: Clock,         color: 'text-purple-600', bg: 'bg-purple-100', label: 'Sin horas' },
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

function groupByDate(items: any[]): { label: string; items: any[] }[] {
  const groups: Record<string, any[]> = {}
  for (const n of items) {
    const d = new Date(n.created_at)
    const todayStr = new Date().toDateString()
    const yesterdayStr = new Date(Date.now() - 86400000).toDateString()
    let label: string
    if (d.toDateString() === todayStr) label = 'Hoy'
    else if (d.toDateString() === yesterdayStr) label = 'Ayer'
    else label = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!groups[label]) groups[label] = []
    groups[label].push(n)
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }))
}

export default function NovedadesClient({ initialNotifications }: { initialNotifications: any[] }) {
  const [notifications, setNotifications] = useState(initialNotifications)

  const unread = notifications.filter(n => !n.read_at).length

  async function handleMarkRead(id: string) {
    setNotifications(prev => prev.filter(n => n.id !== id))
    await markNotificationRead(id)
  }

  async function handleMarkTaskDone(notifId: string, taskId: string) {
    await markTaskDone(taskId)
    setNotifications(prev => prev.filter(n => n.id !== notifId))
    await markNotificationRead(notifId)
  }

  async function handleMarkAll() {
    setNotifications([])
    await markAllNotificationsRead()
  }

  const groups = groupByDate(notifications)

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Novedades</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {unread > 0 ? `${unread} sin leer` : 'Todo al día'}
          </p>
        </div>
        {unread > 0 && (
          <button onClick={handleMarkAll}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all">
            <CheckCheck size={14} /> Marcar todo como leído
          </button>
        )}
      </div>

      {notifications.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 text-gray-300">
          <Bell size={48} className="mb-4 opacity-30" />
          <p className="text-sm font-medium text-gray-400">Sin novedades por ahora</p>
          <p className="text-xs text-gray-300 mt-1">Te avisamos cuando haya algo importante</p>
        </div>
      )}

      <div className="space-y-6">
        {groups.map(group => (
          <div key={group.label}>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3 px-1">
              {group.label}
            </p>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
              {group.items.map(n => {
                const meta = TYPE_META[n.type] ?? { icon: Bell, color: 'text-gray-500', bg: 'bg-gray-100', label: '' }
                const Icon = meta.icon
                const isUnread = !n.read_at
                const taskId = n.type === 'task_due_soon' ? extractTaskId(n.dedup_key) : null
                return (
                  <div key={n.id}
                    className={`group flex gap-4 px-5 py-4 transition-colors hover:bg-gray-50 ${isUnread ? 'bg-blue-50/40' : ''}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${meta.bg}`}>
                      <Icon size={16} className={meta.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 justify-between">
                        <p className={`text-sm font-semibold leading-snug ${isUnread ? 'text-gray-900' : 'text-gray-600'}`}>
                          {n.title}
                        </p>
                        <button onClick={() => handleMarkRead(n.id)}
                          className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                          title="Marcar como leído">
                          <Check size={10} /> Leído
                        </button>
                      </div>
                      {n.body && <p className="text-sm text-gray-400 mt-0.5 leading-relaxed">{n.body}</p>}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-[11px] text-gray-300">{timeAgo(n.created_at)}</span>
                        {meta.label && <span className="text-[11px] text-gray-300">·</span>}
                        <span className="text-[11px] text-gray-300">{meta.label}</span>
                        {taskId && (
                          <button onClick={() => handleMarkTaskDone(n.id, taskId)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-all">
                            <Check size={10} /> Marcar como terminada
                          </button>
                        )}
                        {n.link && (
                          <Link href={n.link}
                            className="text-[11px] text-[#1B9BF0] hover:underline font-medium ml-auto">
                            Ver →
                          </Link>
                        )}
                      </div>
                    </div>
                    {isUnread && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
