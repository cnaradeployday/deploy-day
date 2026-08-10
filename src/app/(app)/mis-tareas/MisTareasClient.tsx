'use client'
import { logActivity } from '@/lib/logActivity'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { Download, CheckCircle, X, Plus, ChevronUp, ChevronDown, Pencil, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDateAR, formatDateShortAR, isPastDate, monthBounds } from '@/lib/utils/date'

const statusColors: Record<string, string> = {
  creado: 'bg-gray-100 text-gray-500', estimado: 'bg-blue-50 text-blue-600',
  en_proceso: 'bg-amber-50 text-amber-600', terminado: 'bg-green-50 text-green-600',
  presentado: 'bg-purple-50 text-purple-600',
  en_revision: 'bg-indigo-50 text-indigo-600', listo_para_entregar: 'bg-teal-50 text-teal-600',
  enviado_cliente: 'bg-pink-50 text-pink-600', finalizado: 'bg-green-50 text-green-600',
}
const statusLabels: Record<string, string> = {
  creado: 'Creado', estimado: 'Iniciado', en_proceso: 'En proceso',
  terminado: 'Terminado', presentado: 'Presentado',
  en_revision: 'En revisión', listo_para_entregar: 'Listo para entregar',
  enviado_cliente: 'Enviado al cliente', finalizado: 'Finalizado',
}
const priorityColors: Record<string, string> = {
  baja: 'bg-gray-100 text-gray-400', media: 'bg-blue-50 text-blue-500',
  alta: 'bg-amber-50 text-amber-600', critica: 'bg-red-50 text-red-600'
}
const nextStatus: Record<string, string> = {
  creado: 'estimado', estimado: 'en_proceso', en_proceso: 'terminado', terminado: 'presentado'
}

interface Props {
  tareas: any[]
  proyectos: { value: string; label: string }[]
  clientes: { value: string; label: string }[]
  filters: Record<string, string | undefined>
  mesActual: string
  canCreateTask?: boolean
  horasEstimadasDelMes?: number
  userId?: string
  canSeeEstimatedHours?: boolean
}

export default function MisTareasClient({
  tareas, proyectos, clientes, filters, mesActual,
  canCreateTask = true, horasEstimadasDelMes = 0, userId = '', canSeeEstimatedHours = true
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [sortKey, setSortKey] = useState('due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [loading, setLoading] = useState<string | null>(null)
  const [tareasLocal, setTareasLocal] = useState<any[]>(tareas)
  const [search, setSearch] = useState('')

  useEffect(() => { setTareasLocal(tareas) }, [tareas])

  const update = useCallback((key: string, value: string) => {
    const p = new URLSearchParams(params.toString())
    if (value) p.set(key, value); else p.delete(key)
    router.push(pathname + '?' + p.toString())
  }, [params, pathname, router])

  // Status multi-select: null = default (all except terminado/finalizado)
  const ALL_STATUSES = Object.keys(statusLabels)
  const DEFAULT_STATUSES = ALL_STATUSES.filter(s => s !== 'terminado' && s !== 'finalizado')
  const selectedStatuses: string[] = filters.status
    ? filters.status.split(',')
    : DEFAULT_STATUSES

  const [statusOpen, setStatusOpen] = useState(false)
  const statusRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function toggleStatus(s: string) {
    let next: string[]
    if (selectedStatuses.includes(s)) {
      next = selectedStatuses.filter(x => x !== s)
    } else {
      next = [...selectedStatuses, s]
    }
    // If same as default, clear the param
    const isDefault = next.length === DEFAULT_STATUSES.length && DEFAULT_STATUSES.every(d => next.includes(d))
    update('status', isDefault ? '' : next.join(','))
  }

  const statusLabel = (() => {
    if (selectedStatuses.length === ALL_STATUSES.length) return 'Todos'
    if (selectedStatuses.length === 0) return 'Ninguno'
    if (selectedStatuses.length === DEFAULT_STATUSES.length && DEFAULT_STATUSES.every(s => selectedStatuses.includes(s))) return 'Todos menos Terminado'
    if (selectedStatuses.length === 1) return statusLabels[selectedStatuses[0]]
    return selectedStatuses.length + ' estados'
  })()

  const mostrarTodas = filters.todas === '1'
  function toggleTodas() { update('todas', mostrarTodas ? '' : '1') }

  const clear = () => { setSearch(''); router.push(pathname) }
  const hasFilters = !!(filters.priority || filters.proyecto || filters.cliente || filters.status || filters.todas)

  const meses: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    meses.push(d.toISOString().slice(0, 7))
  }
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  meses.push(nextMonth.toISOString().slice(0, 7))

  function nombreMes(m: string) {
    return new Date(m + '-15').toLocaleString('es-AR', { month: 'long', year: 'numeric' })
  }

  const mes = filters.mes ?? mesActual
  const { primerDia, ultimoDia } = monthBounds(mes)

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ k }: { k: string }) => {
    if (sortKey !== k) return <ChevronUp size={11} className="opacity-20"/>
    return sortDir === 'asc' ? <ChevronUp size={11}/> : <ChevronDown size={11}/>
  }

  const buscadas = search.trim()
    ? tareasLocal.filter(t => {
        const q = search.trim().toLowerCase()
        return t.title.toLowerCase().includes(q)
          || (t.project?.client?.name ?? '').toLowerCase().includes(q)
          || (t.project?.name ?? '').toLowerCase().includes(q)
          || (t.direct_responsible?.full_name ?? '').toLowerCase().includes(q)
      })
    : tareasLocal

  const sorted = [...buscadas].sort((a, b) => {
    if (sortKey === 'my_assigned_hours' || sortKey === 'hours_logged') {
      const na = Number(a[sortKey] ?? 0); const nb = Number(b[sortKey] ?? 0)
      return sortDir === 'asc' ? na - nb : nb - na
    }
    let va = '', vb = ''
    if (sortKey === 'client') { va = a.project?.client?.name ?? ''; vb = b.project?.client?.name ?? '' }
    else if (sortKey === 'project') { va = a.project?.name ?? ''; vb = b.project?.name ?? '' }
    else if (sortKey === 'responsible') { va = a.direct_responsible?.full_name ?? ''; vb = b.direct_responsible?.full_name ?? '' }
    else { va = String(a[sortKey] ?? ''); vb = String(b[sortKey] ?? '') }
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
  })

  const totalUsadas = tareasLocal.reduce((s, t) => s + (t.hours_logged ?? 0), 0)
  const totalRestantes = horasEstimadasDelMes - totalUsadas

  async function advanceStatus(taskId: string, status: string) {
    if (!nextStatus[status] || loading) return
    setLoading(taskId)
    setTareasLocal(prev => prev.map(t => t.id === taskId ? { ...t, status: nextStatus[status] } : t))
    const { error } = await createClient().from('tasks').update({ status: nextStatus[status] }).eq('id', taskId)
    if (!error) logActivity({ action: 'cambiar estado', section: 'tareas', entityId: taskId, detail: status + ' → ' + nextStatus[status] })
    if (error) {
      setTareasLocal(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
      alert('Error: ' + error.message)
    } else {
      router.refresh()
    }
    setLoading(null)
  }

  function exportar() {
    const data = tareasLocal.map(t => ({
      Tarea: t.title, Rol: t.es_colaborador ? 'Colaborador' : 'Responsable',
      Cliente: t.project?.client?.name ?? '—', Proyecto: t.project?.name ?? '—',
      Estado: statusLabels[t.status] ?? t.status, Prioridad: t.priority,
      ...(canSeeEstimatedHours ? { 'Mis horas': t.my_assigned_hours ?? '—' } : {}),
      'Horas usadas': t.hours_logged ?? 0,
      Vence: t.due_date ? formatDateAR(t.due_date) : '—',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Mis tareas')
    XLSX.writeFile(wb, 'mis-tareas-' + mes + '.xlsx')
  }

  return (
    <div className="p-4 md:p-6 max-w-full">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Mis tareas</h1>
          <p className="text-sm text-gray-400 mt-0.5 capitalize">{nombreMes(mes)} · {tareasLocal.length} tarea{tareasLocal.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mes} onChange={e => update('mes', e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white capitalize">
            {meses.map(m => <option key={m} value={m}>{nombreMes(m)}</option>)}
          </select>
          <button onClick={exportar} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            <Download size={14}/> Excel
          </button>
          {canCreateTask && (
            <Link href="/tareas/nueva"
              className="flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
              <Plus size={15}/> Nueva tarea
            </Link>
          )}
        </div>
      </div>

      <div className="relative max-w-sm mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
        <input type="text" value={search} onChange={ev => setSearch(ev.target.value)}
          placeholder="Buscar por tarea, cliente o responsable..."
          className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={13}/></button>}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Horas estimadas (mes)', value: Math.round(horasEstimadasDelMes * 10) / 10, color: 'text-gray-900' },
          { label: 'Horas usadas (mes)',    value: Math.round(totalUsadas * 10) / 10,           color: 'text-[#1B9BF0]' },
          { label: 'Restantes',             value: Math.round(totalRestantes * 10) / 10,         color: totalRestantes < 0 ? 'text-red-500' : 'text-green-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400">{label}</p>
            <p className={'text-xl font-bold mt-0.5 ' + color}>{value}h</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Estado multi-select */}
          <div ref={statusRef} className="relative">
            <label className="block text-xs text-gray-400 mb-1">Estado</label>
            <button type="button" onClick={() => setStatusOpen(o => !o)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white text-left flex items-center justify-between gap-1">
              <span className="truncate text-gray-700">{statusLabel}</span>
              <ChevronDown size={12} className="shrink-0 text-gray-400"/>
            </button>
            {statusOpen && (
              <div className="absolute z-20 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1">
                {ALL_STATUSES.map(s => (
                  <label key={s} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={selectedStatuses.includes(s)}
                      onChange={() => toggleStatus(s)}
                      className="rounded accent-[#1B9BF0]"/>
                    <span className="text-xs text-gray-700">{statusLabels[s]}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Prioridad</label>
            <select value={filters.priority ?? ''} onChange={e => update('priority', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Todas</option>
              {['baja','media','alta','critica'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Cliente</label>
            <select value={filters.cliente ?? ''} onChange={e => update('cliente', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Todos</option>
              {clientes.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Proyecto</label>
            <select value={filters.proyecto ?? ''} onChange={e => update('proyecto', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Todos</option>
              {proyectos.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div onClick={toggleTodas}
              className={'relative w-8 h-4 rounded-full transition-colors ' + (mostrarTodas ? 'bg-[#1B9BF0]' : 'bg-gray-200')}>
              <div className={'absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ' + (mostrarTodas ? 'translate-x-4' : 'translate-x-0.5')}/>
            </div>
            <span className="text-xs text-gray-500">Todas las tareas pendientes</span>
          </label>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{sorted.length} de {tareasLocal.length} tareas{search ? ' · "' + search + '"' : ''}</span>
            {(hasFilters || search) && (
              <button onClick={clear} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                <X size={12}/> Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabla desktop */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full table-fixed">
          <colgroup>
            <col style={{width:'16%'}}/><col style={{width:'8%'}}/><col style={{width:'10%'}}/>
            <col style={{width:'14%'}}/><col style={{width:'13%'}}/>
            {canSeeEstimatedHours && <col style={{width:'5%'}}/>}
            <col style={{width:'9%'}}/><col style={{width:'7%'}}/><col style={{width:'8%'}}/>
            <col style={{width:'9%'}}/><col style={{width:'6%'}}/>
          </colgroup>
          <thead>
            <tr className="border-b border-gray-50">
              {[
                { key: 'title', label: 'Tarea', show: true }, { key: 'es_colaborador', label: 'Rol', show: true },
                { key: 'client', label: 'Cliente', show: true }, { key: 'project', label: 'Proyecto', show: true },
                { key: 'responsible', label: 'Responsable', show: true }, { key: 'my_assigned_hours', label: 'Est.', show: canSeeEstimatedHours },
                { key: 'hours_logged', label: 'Usado', show: true }, { key: 'due_date', label: 'Vence', show: true },
                { key: 'priority', label: 'Prioridad', show: true }, { key: 'status', label: 'Estado', show: true },
                { key: 'actions', label: '', show: true },
              ].filter(c => c.show).map(({ key, label }) => (
                <th key={key} onClick={() => key !== 'actions' && toggleSort(key)}
                  className={'px-3 py-3 text-left text-xs font-medium text-gray-400 ' + (key !== 'actions' ? 'cursor-pointer hover:text-gray-600 select-none' : '')}>
                  <div className="flex items-center gap-1">{label}{key !== 'actions' && <SortIcon k={key}/>}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!sorted.length ? (
              <tr><td colSpan={canSeeEstimatedHours ? 11 : 10} className="text-center py-12 text-sm text-gray-400">Sin tareas asignadas</td></tr>
            ) : sorted.map(t => {
              const isOverdue = t.due_date && isPastDate(t.due_date) && !['terminado','presentado','finalizado'].includes(t.status)
              const myHours = t.my_assigned_hours ?? 0
              const pct = myHours > 0 ? Math.min(100, Math.round(((t.hours_logged ?? 0) / myHours) * 100)) : null
              const isLoading = loading === t.id
              const esOtroMes = t.due_date && (t.due_date < primerDia || t.due_date > ultimoDia)
              const canAdvance = !!nextStatus[t.status] && !t.requires_review
              return (
                <tr key={t.id} className={'border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors' + (esOtroMes ? ' opacity-60' : '')}>
                  <td className="px-3 py-3 text-sm font-medium text-gray-900 truncate" title={t.title}>
                    {t.title}
                    {esOtroMes && t.due_date && <span className="ml-1 text-[10px] text-gray-400 bg-gray-100 px-1 rounded">{t.due_date.slice(0,7)}</span>}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${t.es_colaborador ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                      {t.es_colaborador ? 'Colab.' : 'Resp.'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500 truncate">{t.project?.client?.name ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 truncate">{t.project?.name ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 truncate">{t.direct_responsible?.full_name ?? '—'}</td>
                  {canSeeEstimatedHours && (
                    <td className="px-3 py-3 text-xs text-gray-700 font-semibold">{myHours > 0 ? myHours + 'h' : '—'}</td>
                  )}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <span className={'text-xs font-medium ' + (pct && pct > 90 ? 'text-red-500' : 'text-gray-500')}>{t.hours_logged ?? 0}h</span>
                      {pct !== null && (
                        <div className="w-8 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={'h-full rounded-full ' + (pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-amber-400' : 'bg-[#1B9BF0]')} style={{ width: Math.min(100, pct) + '%' }}/>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className={'px-3 py-3 text-xs ' + (isOverdue ? 'text-red-500 font-medium' : 'text-gray-500')}>
                    {t.due_date ? formatDateShortAR(t.due_date) : '—'}
                  </td>
                  <td className="px-3 py-3"><span className={'text-xs px-1.5 py-0.5 rounded-full ' + priorityColors[t.priority]}>{t.priority}</span></td>
                  <td className="px-3 py-3"><span className={'text-xs px-1.5 py-0.5 rounded-full ' + statusColors[t.status]}>{statusLabels[t.status]}</span></td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Link href={`/tareas/${t.id}`} prefetch={false}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all" title="Ver tarea">
                        <Pencil size={12}/>
                      </Link>
                      {canAdvance && (
                        <button onClick={() => advanceStatus(t.id, t.status)} disabled={isLoading}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-all disabled:opacity-40" title="Avanzar estado">
                          <CheckCircle size={12}/>
                        </button>
                      )}
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
          const isOverdue = t.due_date && isPastDate(t.due_date) && !['terminado','presentado'].includes(t.status)
          const myHours = t.my_assigned_hours ?? 0
          const isLoading = loading === t.id
          const esOtroMes = t.due_date && (t.due_date < primerDia || t.due_date > ultimoDia)
          const canAdvance = !!nextStatus[t.status]
          return (
            <div key={t.id} className={'bg-white rounded-2xl border p-4 ' + (esOtroMes ? 'border-gray-50 opacity-70' : 'border-gray-100')}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 pr-2">
                  <p className="text-sm font-medium text-gray-900">{t.title}</p>
                  {esOtroMes && t.due_date && <span className="text-[10px] text-gray-400">{t.due_date.slice(0,7)}</span>}
                </div>
                <span className={'text-xs px-2 py-0.5 rounded-full shrink-0 ' + statusColors[t.status]}>{statusLabels[t.status]}</span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${t.es_colaborador ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                  {t.es_colaborador ? 'Colaborador' : 'Responsable'}
                </span>
                <span className="text-xs text-gray-400 truncate">{t.project?.client?.name} · {t.project?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {t.due_date && <span className={isOverdue ? 'text-red-500' : ''}>{formatDateShortAR(t.due_date)}</span>}
                  <span>{t.hours_logged ?? 0}h{canSeeEstimatedHours && myHours > 0 ? '/' + myHours + 'h' : ''}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Link href={`/tareas/${t.id}`} prefetch={false}
                    className="p-2 rounded-lg text-gray-400 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
                    <Pencil size={14}/>
                  </Link>
                  {canAdvance && (
                    <button onClick={() => advanceStatus(t.id, t.status)} disabled={isLoading}
                      className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-all disabled:opacity-40">
                      <CheckCircle size={14}/>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
