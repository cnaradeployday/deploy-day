'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Target, LayoutGrid, List, Clock, AlertTriangle } from 'lucide-react'
import { formatMoney } from '@/lib/utils/currency'
import { formatDateAR, isPastDate } from '@/lib/utils/date'
import { STAGES, STAGE_LABELS, OPEN_STAGES, SERVICE_LABELS, Prospect, Stage, dealTotal, PROBABILITY_LABELS, PROBABILITY_COLORS, classifyProbability } from './constants'
import ProspectModal from './ProspectModal'
import StageChangeModal from './StageChangeModal'

const STAGE_COLORS: Record<Stage, string> = {
  contacto_inicial: 'bg-gray-100 text-gray-600',
  reunion_relevamiento: 'bg-blue-50 text-blue-600',
  cotizacion_enviada: 'bg-amber-50 text-amber-600',
  negociacion: 'bg-purple-50 text-purple-600',
  ganado: 'bg-green-50 text-green-600',
  perdido: 'bg-red-50 text-red-500',
}

function isOverdue(p: Prospect): boolean {
  return isPastDate(p.next_action_date) && !['ganado', 'perdido'].includes(p.stage)
}

function dealSummary(p: Prospect): string {
  const parts: string[] = []
  if (p.one_shot_amount) parts.push(formatMoney(p.one_shot_amount, p.currency) + ' one-shot')
  if (p.monthly_fee) parts.push(formatMoney(p.monthly_fee, p.currency) + '/mes' + (p.estimated_months ? ` x${p.estimated_months}` : ''))
  return parts.length ? parts.join(' + ') : '—'
}

function StatCard({ label, ars, usd, sub }: { label: string; ars: number; usd: number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-xs text-gray-400 mb-1.5">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{formatMoney(ars, 'ARS')}</p>
      {usd > 0 && <p className="text-sm text-gray-500">{formatMoney(usd, 'USD')}</p>}
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function CrmClient({ prospects, clientes, usuarios, canWrite, currentUserId }: {
  prospects: Prospect[]
  clientes: { id: string; name: string }[]
  usuarios: { id: string; full_name: string }[]
  canWrite: boolean
  currentUserId: string
}) {
  const router = useRouter()
  const [view, setView] = useState<'kanban' | 'tabla'>('kanban')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Prospect | null>(null)
  const [stageChange, setStageChange] = useState<{ prospect: Prospect; newStage: 'ganado' | 'perdido' } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<Stage | null>(null)

  const [filterResponsable, setFilterResponsable] = useState('')
  const [filterServicio, setFilterServicio] = useState('')
  const [filterFuente, setFilterFuente] = useState('')
  const [filterBusqueda, setFilterBusqueda] = useState('')
  const [filterFechaDesde, setFilterFechaDesde] = useState('')
  const [filterFechaHasta, setFilterFechaHasta] = useState('')
  const [filterVencidas, setFilterVencidas] = useState(false)

  function refresh() {
    setShowModal(false); setEditing(null); setStageChange(null)
    router.refresh()
  }

  function openNew() { setEditing(null); setShowModal(true) }
  function openEdit(p: Prospect) { setEditing(p); setShowModal(true) }

  async function handleDelete(p: Prospect) {
    if (!confirm(`¿Eliminar "${p.project_name}" (${p.prospect_name})?`)) return
    setDeletingId(p.id)
    const { error } = await createClient().from('prospects').delete().eq('id', p.id)
    setDeletingId(null)
    if (error) { alert('Error: ' + error.message); return }
    router.refresh()
  }

  async function changeStage(p: Prospect, newStage: Stage) {
    if (newStage === p.stage) return
    if (newStage === 'ganado' || newStage === 'perdido') {
      setStageChange({ prospect: p, newStage })
      return
    }
    const { error } = await createClient().from('prospects')
      .update({ stage: newStage, probability: STAGES.find(s => s.key === newStage)!.probability })
      .eq('id', p.id)
    if (error) { alert('Error: ' + error.message); return }
    router.refresh()
  }

  const filtered = useMemo(() => {
    return prospects.filter(p => {
      if (filterResponsable && p.responsible_id !== filterResponsable) return false
      if (filterServicio && p.service_type !== filterServicio) return false
      if (filterFuente && (p.source ?? '') !== filterFuente) return false
      if (filterBusqueda && !(p.project_name + ' ' + p.prospect_name).toLowerCase().includes(filterBusqueda.toLowerCase())) return false
      if (filterVencidas && !isOverdue(p)) return false
      if (filterFechaDesde && (!p.next_action_date || p.next_action_date < filterFechaDesde)) return false
      if (filterFechaHasta && (!p.next_action_date || p.next_action_date > filterFechaHasta)) return false
      return true
    })
  }, [prospects, filterResponsable, filterServicio, filterFuente, filterBusqueda, filterFechaDesde, filterFechaHasta, filterVencidas])

  const hasFilters = !!(filterResponsable || filterServicio || filterFuente || filterBusqueda || filterFechaDesde || filterFechaHasta || filterVencidas)
  function clearFilters() {
    setFilterResponsable(''); setFilterServicio(''); setFilterFuente(''); setFilterBusqueda('')
    setFilterFechaDesde(''); setFilterFechaHasta(''); setFilterVencidas(false)
  }
  const overdueCount = prospects.filter(isOverdue).length

  const fuentesDisponibles = useMemo(() => [...new Set(prospects.map(p => p.source).filter((s): s is string => !!s))].sort(), [prospects])

  const metrics = useMemo(() => {
    const open = filtered.filter(p => OPEN_STAGES.includes(p.stage))
    const sum = (list: Prospect[], currency: 'ARS' | 'USD', fn: (p: Prospect) => number) =>
      list.filter(p => p.currency === currency).reduce((s, p) => s + fn(p), 0)
    const byLevel = (level: 'alta' | 'media' | 'baja') => open.filter(p => classifyProbability(p.probability) === level)

    return {
      pipelineArs: sum(open, 'ARS', p => dealTotal(p)),
      pipelineUsd: sum(open, 'USD', p => dealTotal(p)),
      altaArs: sum(byLevel('alta'), 'ARS', dealTotal),
      altaUsd: sum(byLevel('alta'), 'USD', dealTotal),
      mediaArs: sum(byLevel('media'), 'ARS', dealTotal),
      mediaUsd: sum(byLevel('media'), 'USD', dealTotal),
      bajaArs: sum(byLevel('baja'), 'ARS', dealTotal),
      bajaUsd: sum(byLevel('baja'), 'USD', dealTotal),
    }
  }, [filtered])

  function ProspectCard({ p }: { p: Prospect }) {
    const overdue = isOverdue(p)
    return (
      <div
        draggable={canWrite}
        onDragStart={e => { e.dataTransfer.setData('text/plain', p.id) }}
        onClick={() => openEdit(p)}
        className="bg-white rounded-xl border border-gray-100 p-3 cursor-pointer hover:border-[#1B9BF0] hover:shadow-sm transition-all group"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 leading-snug truncate">{p.project_name}</p>
            <p className="text-xs text-gray-400 truncate">{p.prospect_name}</p>
          </div>
          {canWrite && (
            <button onClick={e => { e.stopPropagation(); handleDelete(p) }} disabled={deletingId === p.id}
              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all shrink-0">
              <Trash2 size={13}/>
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{SERVICE_LABELS[p.service_type] ?? p.service_type}</p>
        <p className="text-xs text-gray-600 mt-1.5 font-medium">{dealSummary(p)}</p>
        <div className="flex items-center justify-between mt-2">
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${PROBABILITY_COLORS[classifyProbability(p.probability)]}`}>
            {PROBABILITY_LABELS[classifyProbability(p.probability)]}
          </span>
          {p.expected_close_date && <span className="text-[11px] text-gray-400">{formatDateAR(p.expected_close_date)}</span>}
        </div>
        {p.next_action && (
          <div className={`flex items-center gap-1 mt-2 text-[11px] px-2 py-1 rounded-lg ${overdue ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-50 text-gray-500'}`}>
            {overdue ? <AlertTriangle size={11}/> : <Clock size={11}/>}
            <span className="truncate">{p.next_action}{p.next_action_date ? ` — ${formatDateAR(p.next_action_date)}` : ''}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-full">
      {showModal && (
        <ProspectModal prospect={editing} clientes={clientes} usuarios={usuarios} currentUserId={currentUserId}
          onClose={() => { setShowModal(false); setEditing(null) }} onSaved={refresh}/>
      )}
      {stageChange && (
        <StageChangeModal prospect={stageChange.prospect} newStage={stageChange.newStage} clientes={clientes} currentUserId={currentUserId}
          onClose={() => setStageChange(null)} onDone={refresh}/>
      )}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Target size={18} className="text-[#1B9BF0]"/> CRM — Prospectación
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{filtered.length} de {prospects.length} prospectos</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-xl p-1">
            <button onClick={() => setView('kanban')} className={`p-1.5 rounded-lg transition-all ${view === 'kanban' ? 'bg-white shadow-sm text-[#1B9BF0]' : 'text-gray-400'}`}>
              <LayoutGrid size={15}/>
            </button>
            <button onClick={() => setView('tabla')} className={`p-1.5 rounded-lg transition-all ${view === 'tabla' ? 'bg-white shadow-sm text-[#1B9BF0]' : 'text-gray-400'}`}>
              <List size={15}/>
            </button>
          </div>
          {canWrite && (
            <button onClick={openNew}
              className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">
              <Plus size={15}/> Nuevo prospecto
            </button>
          )}
        </div>
      </div>

      {/* Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Pipeline (valor total)" ars={metrics.pipelineArs} usd={metrics.pipelineUsd}
          sub="One-shots + fee mensual × meses, sin ponderar por probabilidad"/>
        <StatCard label="Probabilidad alta" ars={metrics.altaArs} usd={metrics.altaUsd}/>
        <StatCard label="Probabilidad media" ars={metrics.mediaArs} usd={metrics.mediaUsd}/>
        <StatCard label="Probabilidad baja" ars={metrics.bajaArs} usd={metrics.bajaUsd}/>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs text-gray-400 mb-1">Buscar</label>
            <input type="text" value={filterBusqueda} onChange={e => setFilterBusqueda(e.target.value)}
              placeholder="Proyecto o prospecto..."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Responsable</label>
            <select value={filterResponsable} onChange={e => setFilterResponsable(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Todos</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Servicio</label>
            <select value={filterServicio} onChange={e => setFilterServicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Todos</option>
              {Object.entries(SERVICE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Fuente</label>
            <select value={filterFuente} onChange={e => setFilterFuente(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Todas</option>
              {fuentesDisponibles.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Seguimiento desde</label>
            <input type="date" value={filterFechaDesde} onChange={e => setFilterFechaDesde(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Seguimiento hasta</label>
            <input type="date" value={filterFechaHasta} onChange={e => setFilterFechaHasta(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2 mt-3">
          <button onClick={() => setFilterVencidas(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filterVencidas ? 'bg-red-500 text-white' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}>
            <AlertTriangle size={12}/> {overdueCount} vencida{overdueCount !== 1 ? 's' : ''}
          </button>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-gray-600">Limpiar filtros</button>
          )}
        </div>
      </div>

      {!filtered.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          <Target size={32} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">Sin prospectos{prospects.length ? ' para estos filtros' : ''}</p>
        </div>
      ) : view === 'kanban' ? (
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:snap-none -mx-4 px-4 md:mx-0 md:px-0">
          {STAGES.map(stage => {
            const items = filtered.filter(p => p.stage === stage.key)
            return (
              <div key={stage.key}
                onDragOver={e => { e.preventDefault(); setDragOverStage(stage.key) }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={e => {
                  e.preventDefault()
                  setDragOverStage(null)
                  const id = e.dataTransfer.getData('text/plain')
                  const p = prospects.find(pr => pr.id === id)
                  if (p && canWrite) changeStage(p, stage.key)
                }}
                className={`w-[85vw] sm:w-72 shrink-0 snap-start rounded-2xl p-2.5 transition-colors ${dragOverStage === stage.key ? 'bg-blue-50' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between px-1.5 py-1 mb-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${STAGE_COLORS[stage.key]}`}>{stage.label}</span>
                  <span className="text-xs text-gray-400">{items.length}</span>
                </div>
                <div className="space-y-2 min-h-[40px]">
                  {items.map(p => <ProspectCard key={p.id} p={p}/>)}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Proyecto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Prospecto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Etapa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Prob.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Servicio</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Responsable</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Importe</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Cierre est.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Seguimiento</th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const overdue = isOverdue(p)
                const responsable = usuarios.find(u => u.id === p.responsible_id)?.full_name
                return (
                  <tr key={p.id} onClick={() => openEdit(p)} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{p.project_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{p.prospect_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STAGE_COLORS[p.stage]}`}>{STAGE_LABELS[p.stage]}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${PROBABILITY_COLORS[classifyProbability(p.probability)]}`}>
                        {PROBABILITY_LABELS[classifyProbability(p.probability)]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{SERVICE_LABELS[p.service_type] ?? p.service_type}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{responsable ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{dealSummary(p)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{p.expected_close_date ? formatDateAR(p.expected_close_date) : '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {p.next_action ? (
                        <span className={`text-xs flex items-center gap-1 px-2 py-0.5 rounded-full ${overdue ? 'bg-red-100 text-red-600 animate-pulse' : 'text-gray-500'}`}>
                          {overdue ? <AlertTriangle size={11}/> : <Clock size={11}/>}
                          {p.next_action_date ? formatDateAR(p.next_action_date) : p.next_action}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {canWrite && (
                          <>
                            <button onClick={e => { e.stopPropagation(); openEdit(p) }}
                              className="p-1.5 rounded-lg text-gray-300 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
                              <Pencil size={13}/>
                            </button>
                            <button onClick={e => { e.stopPropagation(); handleDelete(p) }} disabled={deletingId === p.id}
                              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40">
                              <Trash2 size={13}/>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
