'use client'
import { logActivity } from '@/lib/logActivity'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { Download, Clock, X, Plus, ChevronUp, ChevronDown, Loader2, Play } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
// Only allow transitions up to en_proceso from the list view
// Terminar / Presentar are only accessible inside the task
const nextStatusFromList: Record<string, string> = {
  creado: 'estimado',
  estimado: 'en_proceso',
}
const nextLabelFromList: Record<string, string> = {
  creado: 'Iniciar',
  estimado: 'En proceso',
}

// All transitions (used for optimistic UI rollback)
const nextStatus: Record<string, string> = {
  creado: 'estimado', estimado: 'en_proceso', en_proceso: 'terminado', terminado: 'presentado'
}

// Default column widths in px
const DEFAULT_WIDTHS = [200, 82, 108, 148, 138, 58, 88, 82, 88, 100, 130]

interface Props {
  tareas: any[]
  proyectos: { value: string; label: string }[]
  clientes: { value: string; label: string }[]
  filters: Record<string, string | undefined>
  mesActual: string
  canCreateTask?: boolean
  horasEstimadasDelMes?: number
}

export default function MisTareasClient({
  tareas, proyectos, clientes, filters, mesActual,
  canCreateTask = true, horasEstimadasDelMes = 0
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [sortKey, setSortKey] = useState('due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [loading, setLoading] = useState<string | null>(null)
  const [tareasLocal, setTareasLocal] = useState<any[]>(tareas)

  // Column resize state
  const [colWidths, setColWidths] = useState<number[]>(DEFAULT_WIDTHS)
  const resizingRef = useRef<{ idx: number; startX: number; startW: number } | null>(null)
  const didResizeRef = useRef(false)
  const tableRef = useRef<HTMLTableElement>(null)

  useEffect(() => { setTareasLocal(tareas) }, [tareas])

  // Global mouse handlers for column resize
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!resizingRef.current) return
      didResizeRef.current = true
      const dx = e.clientX - resizingRef.current.startX
      const newW = Math.max(48, resizingRef.current.startW + dx)
      const idx = resizingRef.current.idx
      setColWidths(prev => prev.map((w, i) => i === idx ? newW : w))
    }
    function onMouseUp() {
      resizingRef.current = null
      // Keep didResizeRef true briefly so click handler can check it
      setTimeout(() => { didResizeRef.current = false }, 50)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  function startResize(e: React.MouseEvent, idx: number) {
    e.preventDefault()
    e.stopPropagation()
    resizingRef.current = { idx, startX: e.clientX, startW: colWidths[idx] }
    didResizeRef.current = false
  }

  const update = useCallback((key: string, value: string) => {
    const p = new URLSearchParams(params.toString())
    if (value) p.set(key, value); else p.delete(key)
    router.push(pathname + '?' + p.toString())
  }, [params, pathname, router])

  const clear = () => router.push(pathname)
  const hasFilters = Object.values(filters).some(v => v && v !== filters.mes)

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
  const [anio, mesNum] = mes.split('-').map(Number)
  const primerDia = new Date(anio, mesNum - 1, 1).toISOString().split('T')[0]
  const ultimoDia = new Date(anio, mesNum, 0).toISOString().split('T')[0]

  function toggleSort(key: string) {
    if (didResizeRef.current) return
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ k }: { k: string }) => {
    if (sortKey !== k) return <ChevronUp size={11} className="opacity-20 shrink-0"/>
    return sortDir === 'asc' ? <ChevronUp size={11} className="shrink-0"/> : <ChevronDown size={11} className="shrink-0"/>
  }

  const sorted = [...tareasLocal].sort((a, b) => {
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
    if (!nextStatusFromList[status] || loading) return
    setLoading(taskId)
    setTareasLocal(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: nextStatusFromList[status] } : t
    ))
    const { error } = await createClient().from('tasks').update({ status: nextStatusFromList[status] }).eq('id', taskId)
    if (!error) logActivity({ action: 'cambiar estado', section: 'tareas', entityId: taskId, detail: status + ' → ' + nextStatusFromList[status] })
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
      'Mis horas': t.my_assigned_hours ?? '—', 'Horas usadas': t.hours_logged ?? 0,
      Vence: t.due_date ? new Date(t.due_date).toLocaleDateString('es-AR') : '—',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Mis tareas')
    XLSX.writeFile(wb, 'mis-tareas-' + mes + '.xlsx')
  }

  const columns = [
    { key: 'title',             label: 'Tarea' },
    { key: 'es_colaborador',    label: 'Rol' },
    { key: 'client',            label: 'Cliente' },
    { key: 'project',           label: 'Proyecto' },
    { key: 'responsible',       label: 'Responsable' },
    { key: 'my_assigned_hours', label: 'Est.' },
    { key: 'hours_logged',      label: 'Usado' },
    { key: 'due_date',          label: 'Vence' },
    { key: 'priority',          label: 'Prioridad' },
    { key: 'status',            label: 'Estado' },
    { key: 'avances',           label: 'Cargar avances' },
  ]

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
          <div>
            <label className="block text-xs text-gray-400 mb-1">Estado</label>
            <select value={filters.status ?? ''} onChange={e => update('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Todos</option>
              {Object.entries(statusLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
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
        {hasFilters && (
          <div className="flex justify-end mt-3 pt-3 border-t border-gray-50">
            <button onClick={clear} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
              <X size={12}/> Limpiar
            </button>
          </div>
        )}
      </div>

      {/* Tabla desktop — overflow-x-auto para permitir columnas más anchas y resize */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 overflow-x-auto">
        <table ref={tableRef} style={{ tableLayout: 'fixed', minWidth: colWidths.reduce((a, b) => a + b, 0) + 'px', width: '100%' }}>
          <colgroup>
            {colWidths.map((w, i) => <col key={i} style={{ width: w + 'px' }}/>)}
          </colgroup>
          <thead>
            <tr className="border-b border-gray-50">
              {columns.map(({ key, label }, i) => (
                <th
                  key={key}
                  onClick={() => key !== 'avances' && toggleSort(key)}
                  style={{ position: 'relative', userSelect: 'none' }}
                  className={'px-3 py-3 text-left text-xs font-medium text-gray-400 ' + (key !== 'avances' ? 'cursor-pointer hover:text-gray-600' : '')}
                >
                  <div className="flex items-center gap-1 overflow-hidden">
                    <span className="truncate">{label}</span>
                    {key !== 'avances' && <SortIcon k={key}/>}
                  </div>
                  {/* Resize handle */}
                  <div
                    onMouseDown={e => startResize(e, i)}
                    className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-300 opacity-0 hover:opacity-100 transition-opacity z-10"
                    title="Arrastrar para redimensionar"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!sorted.length ? (
              <tr><td colSpan={11} className="text-center py-12 text-sm text-gray-400">Sin tareas asignadas</td></tr>
            ) : sorted.map(t => {
              const isOverdue = t.due_date && new Date(t.due_date) < new Date() && !['terminado','presentado'].includes(t.status)
              const myHours = t.my_assigned_hours ?? 0
              const pct = myHours > 0 ? Math.min(100, Math.round(((t.hours_logged ?? 0) / myHours) * 100)) : null
              const isLoading = loading === t.id
              const esOtroMes = t.due_date && (t.due_date < primerDia || t.due_date > ultimoDia)
              const canAdvance = !!nextStatusFromList[t.status]
              return (
                <tr key={t.id} className={'border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors' + (esOtroMes ? ' opacity-60' : '')}>
                  <td className="px-3 py-3 text-sm font-medium text-gray-900 overflow-hidden">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="truncate" title={t.title}>{t.title}</span>
                      {esOtroMes && t.due_date && (
                        <span className="shrink-0 text-[10px] text-gray-400 bg-gray-100 px-1 rounded">{t.due_date.slice(0,7)}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap ${t.es_colaborador ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                      {t.es_colaborador ? 'Colab.' : 'Resp.'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500 truncate" title={t.project?.client?.name}>{t.project?.client?.name ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 truncate" title={t.project?.name}>{t.project?.name ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 truncate" title={t.direct_responsible?.full_name}>{t.direct_responsible?.full_name ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-700 font-semibold whitespace-nowrap">{myHours > 0 ? myHours + 'h' : '—'}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <span className={'text-xs font-medium whitespace-nowrap ' + (pct && pct > 90 ? 'text-red-500' : 'text-gray-500')}>{t.hours_logged ?? 0}h</span>
                      {pct !== null && (
                        <div className="w-8 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
                          <div className={'h-full rounded-full ' + (pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-amber-400' : 'bg-[#1B9BF0]')} style={{ width: Math.min(100, pct) + '%' }}/>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className={'px-3 py-3 text-xs whitespace-nowrap ' + (isOverdue ? 'text-red-500 font-medium' : 'text-gray-500')}>
                    {t.due_date ? new Date(t.due_date).toLocaleDateString('es-AR', { day:'numeric', month:'short' }) : '—'}
                  </td>
                  <td className="px-3 py-3">
                    <span className={'text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap ' + priorityColors[t.priority]}>{t.priority}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={'text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap ' + statusColors[t.status]}>{statusLabels[t.status]}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {/* Cargar avances — botón visible con texto */}
                      <Link
                        href={'/tareas/' + t.id + '?from=mis-tareas'}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1B9BF0] rounded-xl text-xs font-medium transition-all whitespace-nowrap"
                        title="Ir a la tarea para cargar avances y cronómetro"
                      >
                        <Clock size={12}/> Cargar
                      </Link>
                      {/* Avanzar estado — solo Iniciar o En proceso, NO Terminar */}
                      {canAdvance && (
                        <button
                          onClick={() => advanceStatus(t.id, t.status)}
                          disabled={!!loading}
                          title={nextLabelFromList[t.status]}
                          className="flex items-center gap-1 px-2 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl text-xs font-medium transition-all disabled:opacity-40 whitespace-nowrap"
                        >
                          {isLoading
                            ? <Loader2 size={11} className="animate-spin"/>
                            : <Play size={10}/>
                          }
                          {nextLabelFromList[t.status]}
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
          const isOverdue = t.due_date && new Date(t.due_date) < new Date() && !['terminado','presentado'].includes(t.status)
          const myHours = t.my_assigned_hours ?? 0
          const isLoading = loading === t.id
          const esOtroMes = t.due_date && (t.due_date < primerDia || t.due_date > ultimoDia)
          const canAdvance = !!nextStatusFromList[t.status]
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
                  {t.due_date && <span className={isOverdue ? 'text-red-500' : ''}>{new Date(t.due_date).toLocaleDateString('es-AR', { day:'numeric', month:'short' })}</span>}
                  <span>{t.hours_logged ?? 0}h{myHours > 0 ? '/' + myHours + 'h' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={'/tareas/' + t.id + '?from=mis-tareas'}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1B9BF0] rounded-xl text-xs font-medium transition-all">
                    <Clock size={13}/> Cargar avances
                  </Link>
                  {canAdvance && (
                    <button
                      onClick={() => advanceStatus(t.id, t.status)}
                      disabled={!!loading}
                      title={nextLabelFromList[t.status]}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl text-xs font-medium disabled:opacity-40"
                    >
                      {isLoading ? <Loader2 size={13} className="animate-spin"/> : <Play size={11}/>}
                      {nextLabelFromList[t.status]}
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
