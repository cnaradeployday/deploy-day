'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { X, ChevronUp, ChevronDown, CheckCircle, Trash2, Pencil, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

const statusColors: Record<string, string> = {
  creado: 'bg-gray-100 text-gray-500', estimado: 'bg-blue-50 text-blue-600',
  en_proceso: 'bg-amber-50 text-amber-600', terminado: 'bg-green-50 text-green-600',
  presentado: 'bg-purple-50 text-purple-600',
}
const statusLabels: Record<string, string> = {
  creado: 'Creado', estimado: 'Iniciado', en_proceso: 'En proceso',
  terminado: 'Terminado', presentado: 'Presentado'
}
const priorityColors: Record<string, string> = {
  baja: 'bg-gray-100 text-gray-400', media: 'bg-blue-50 text-blue-500',
  alta: 'bg-amber-50 text-amber-600', critica: 'bg-red-50 text-red-600'
}
const nextStatus: Record<string, string> = {
  creado: 'estimado', estimado: 'en_proceso', en_proceso: 'terminado', terminado: 'presentado'
}
const nextStatusLabel: Record<string, string> = {
  creado: 'Estimar', estimado: 'Iniciar', en_proceso: 'Terminar', terminado: 'Presentar'
}

function mesDeDate(d: string | null) {
  if (!d) return ''
  return d.slice(0, 7) // YYYY-MM
}
function nombreMes(m: string) {
  if (!m) return '—'
  return new Date(m + '-15').toLocaleString('es-AR', { month: 'long', year: 'numeric' })
}

interface Tarea {
  id: string; title: string; status: string; priority: string
  due_date: string; estimated_hours: number | null; hours_logged: number
  project: any; direct_responsible: any
}

export default function TareasTable({ tareas, clientes, proyectos, usuarios, filters, hideColumns = [] }: {
  tareas: Tarea[]
  clientes: { value: string; label: string }[]
  proyectos: { value: string; label: string }[]
  usuarios: { value: string; label: string }[]
  filters: Record<string, string | undefined>
  hideColumns?: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [sortKey, setSortKey] = useState('due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [loading, setLoading] = useState<string | null>(null)

  const update = useCallback((key: string, value: string) => {
    const p = new URLSearchParams(params.toString())
    if (value) { p.set(key, value) } else { p.delete(key) }
    router.push(pathname + '?' + p.toString())
  }, [params, pathname, router])

  const clear = () => router.push(pathname)
  const hasFilters = Object.values(filters).some(Boolean)

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  // Meses únicos disponibles en las tareas
  const mesesUnicos = [...new Set(tareas.map(t => mesDeDate(t.due_date)).filter(Boolean))].sort()

  const sorted = [...tareas]
    .filter(t => !filters.mes || mesDeDate(t.due_date) === filters.mes)
    .sort((a, b) => {
      let va: string, vb: string
      if (sortKey === 'client') { va = a.project?.client?.name ?? ''; vb = b.project?.client?.name ?? '' }
      else if (sortKey === 'project') { va = a.project?.name ?? ''; vb = b.project?.name ?? '' }
      else if (sortKey === 'responsible') { va = a.direct_responsible?.full_name ?? ''; vb = b.direct_responsible?.full_name ?? '' }
      else if (sortKey === 'mes') { va = mesDeDate(a.due_date); vb = mesDeDate(b.due_date) }
      else { va = String((a as any)[sortKey] ?? ''); vb = String((b as any)[sortKey] ?? '') }
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })

  async function advanceStatus(taskId: string, currentStatus: string) {
    if (!nextStatus[currentStatus]) return
    setLoading(taskId)
    await createClient().from('tasks').update({ status: nextStatus[currentStatus] }).eq('id', taskId)
    router.refresh()
    setLoading(null)
  }

  async function deleteTask(taskId: string) {
    if (!confirm('Eliminar esta tarea?')) return
    setLoading(taskId)
    const sb = createClient()
    await sb.from('time_entries').delete().eq('task_id', taskId)
    await sb.from('task_collaborators').delete().eq('task_id', taskId)
    await sb.from('task_comments').delete().eq('task_id', taskId)
    await sb.from('tasks').delete().eq('id', taskId)
    router.refresh()
    setLoading(null)
  }

  const show = (col: string) => !hideColumns.includes(col)
  const SortIcon = ({ k }: { k: string }) => {
    if (sortKey !== k) return <ChevronUp size={12} className="opacity-20"/>
    return sortDir === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>
  }

  return (
    <div>
      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Mes</label>
            <select value={filters.mes ?? ''} onChange={e => update('mes', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white capitalize">
              <option value="">Todos</option>
              {mesesUnicos.map(m => (
                <option key={m} value={m}>{nombreMes(m)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Estado</label>
            <select value={filters.status ?? ''} onChange={e => update('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Todos</option>
              {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Prioridad</label>
            <select value={filters.priority ?? ''} onChange={e => update('priority', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Todas</option>
              {['baja','media','alta','critica'].map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>
          {show('client') && clientes.length > 0 && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Cliente</label>
              <select value={filters.cliente ?? ''} onChange={e => update('cliente', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
                <option value="">Todos</option>
                {clientes.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          )}
          {proyectos.length > 0 && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Proyecto</label>
              <select value={filters.proyecto ?? ''} onChange={e => update('proyecto', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
                <option value="">Todos</option>
                {proyectos.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          )}
          {show('responsible') && usuarios.length > 0 && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Responsable</label>
              <select value={filters.responsable ?? ''} onChange={e => update('responsable', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
                <option value="">Todos</option>
                {usuarios.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          )}
        </div>
        {hasFilters && (
          <div className="flex justify-end mt-2">
            <button onClick={clear} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <X size={11}/> Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Tabla desktop */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50">
              {[
                { key: 'mes',             label: 'Mes',         show: true },
                { key: 'title',           label: 'Tarea',       show: true },
                { key: 'client',          label: 'Cliente',     show: show('client') },
                { key: 'project',         label: 'Proyecto',    show: show('project') },
                { key: 'responsible',     label: 'Responsable', show: show('responsible') },
                { key: 'estimated_hours', label: 'Est.',        show: true },
                { key: 'hours_logged',    label: 'Usado',       show: true },
                { key: 'due_date',        label: 'Vence',       show: true },
                { key: 'priority',        label: 'Prioridad',   show: true },
                { key: 'status',          label: 'Estado',      show: true },
                { key: 'actions',         label: '',            show: true },
              ].filter(c => c.show).map(({ key, label }) => (
                <th key={key} onClick={() => key !== 'actions' && toggleSort(key)}
                  className={'px-3 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap ' + (key !== 'actions' ? 'cursor-pointer hover:text-gray-600 select-none' : '')}>
                  <div className="flex items-center gap-1">{label}{key !== 'actions' && <SortIcon k={key}/>}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!sorted.length ? (
              <tr><td colSpan={11} className="text-center py-12 text-sm text-gray-400">Sin tareas</td></tr>
            ) : sorted.map(t => {
              const isOverdue = t.due_date && new Date(t.due_date) < new Date() && !['terminado','presentado'].includes(t.status)
              const pct = t.estimated_hours ? Math.round((t.hours_logged / t.estimated_hours) * 100) : null
              const mes = mesDeDate(t.due_date)
              return (
                <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap capitalize">
                    {mes ? new Date(mes + '-15').toLocaleString('es-AR', { month: 'short', year: '2-digit' }) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-sm font-medium text-gray-900 max-w-[180px] truncate">{t.title}</td>
                  {show('client') && <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{t.project?.client?.name ?? '—'}</td>}
                  {show('project') && <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{t.project?.name ?? '—'}</td>}
                  {show('responsible') && <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{t.direct_responsible?.full_name ?? '—'}</td>}
                  <td className="px-3 py-2.5 text-xs text-gray-500">{t.estimated_hours ? t.estimated_hours + 'h' : '—'}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className={'text-xs font-medium ' + (pct && pct > 90 ? 'text-red-500' : 'text-gray-500')}>{t.hours_logged}h</span>
                      {pct !== null && (
                        <div className="w-10 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={'h-full rounded-full ' + (pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-amber-400' : 'bg-[#1B9BF0]')}
                            style={{ width: Math.min(100, pct) + '%' }}/>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className={'px-3 py-2.5 text-xs whitespace-nowrap ' + (isOverdue ? 'text-red-500 font-medium' : 'text-gray-500')}>
                    {t.due_date ? new Date(t.due_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '—'}
                  </td>
                  <td className="px-3 py-2.5"><span className={'text-xs px-2 py-0.5 rounded-full ' + priorityColors[t.priority]}>{t.priority}</span></td>
                  <td className="px-3 py-2.5"><span className={'text-xs px-2 py-0.5 rounded-full ' + statusColors[t.status]}>{statusLabels[t.status]}</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-0.5">
                      <Link href={'/tareas/' + t.id} title="Ver / editar"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
                        <Pencil size={12}/>
                      </Link>
                      {nextStatus[t.status] && (
                        <button onClick={() => advanceStatus(t.id, t.status)} disabled={loading === t.id}
                          title={nextStatusLabel[t.status]}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-all">
                          <CheckCircle size={12}/>
                        </button>
                      )}
                      <button onClick={() => deleteTask(t.id)} disabled={loading === t.id}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-2">
        {sorted.map(t => {
          const isOverdue = t.due_date && new Date(t.due_date) < new Date() && !['terminado','presentado'].includes(t.status)
          return (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-medium text-gray-900 flex-1 pr-2">{t.title}</p>
                <span className={'text-xs px-2 py-0.5 rounded-full shrink-0 ' + statusColors[t.status]}>{statusLabels[t.status]}</span>
              </div>
              <p className="text-xs text-gray-400 mb-3">{t.project?.client?.name} · {t.project?.name}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {t.due_date && <span className={isOverdue ? 'text-red-500' : ''}>{new Date(t.due_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>}
                  <span>{t.hours_logged}h{t.estimated_hours ? '/' + t.estimated_hours + 'h' : ''}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Link href={'/tareas/' + t.id} className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B9BF0] hover:bg-blue-50">
                    <Pencil size={14}/>
                  </Link>
                  {nextStatus[t.status] && (
                    <button onClick={() => advanceStatus(t.id, t.status)} disabled={loading === t.id}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50">
                      <CheckCircle size={14}/>
                    </button>
                  )}
                  <button onClick={() => deleteTask(t.id)} disabled={loading === t.id}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50">
                    <Trash2 size={14}/>
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
