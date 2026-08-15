'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Target, LayoutGrid, List, Clock, AlertTriangle } from 'lucide-react'
import { formatMoney } from '@/lib/utils/currency'
import { formatDateAR, isPastDate } from '@/lib/utils/date'
import { STAGES, STAGE_LABELS, OPEN_STAGES, SERVICE_LABELS, Prospect, Stage, dealTotal } from './constants'
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

  function refresh() {
    setShowModal(false); setEditing(null); setStageChange(null)
    router.refresh()
  }

  function openNew() { setEditing(null); setShowModal(true) }
  function openEdit(p: Prospect) { setEditing(p); setShowModal(true) }

  async function handleDelete(p: Prospect) {
    if (!confirm(`¿Eliminar el prospecto "${p.prospect_name}"?`)) return
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
      if (filterBusqueda && !p.prospect_name.toLowerCase().includes(filterBusqueda.toLowerCase())) return false
      return true
    })
  }, [prospects, filterResponsable, filterServicio, filterFuente, filterBusqueda])

  const fuentesDisponibles = useMemo(() => [...new Set(prospects.map(p => p.source).filter((s): s is string => !!s))].sort(), [prospects])

  const metrics = useMemo(() => {
    const open = filtered.filter(p => OPEN_STAGES.includes(p.stage))
    const won = filtered.filter(p => p.stage === 'ganado')
    const sum = (list: Prospect[], currency: 'ARS' | 'USD', fn: (p: Prospect) => number) =>
      list.filter(p => p.currency === currency).reduce((s, p) => s + fn(p), 0)

    return {
      pipelineArs: sum(open, 'ARS', p => dealTotal(p) * (p.probability / 100)),
      pipelineUsd: sum(open, 'USD', p => dealTotal(p) * (p.probability / 100)),
      mrrArs: sum(open, 'ARS', p => (p.monthly_fee ?? 0) * (p.probability / 100)),
      mrrUsd: sum(open, 'USD', p => (p.monthly_fee ?? 0) * (p.probability / 100)),
      costoArs: sum(filtered, 'ARS', p => (p.quoting_hours ?? 0) * (p.quoting_hourly_rate ?? 0)),
      costoUsd: sum(filtered, 'USD', p => (p.quoting_hours ?? 0) * (p.quoting_hourly_rate ?? 0)),
      ganadoArs: sum(won, 'ARS', p => dealTotal(p)),
      ganadoUsd: sum(won, 'USD', p => dealTotal(p)),
    }
  }, [filtered])

  const roiArs = metrics.costoArs > 0 ? metrics.ganadoArs / metrics.costoArs : null
  const roiUsd = metrics.costoUsd > 0 ? metrics.ganadoUsd / metrics.costoUsd : null
  const roiSub = [
    roiArs !== null ? `${roiArs.toFixed(1)}x en ARS` : null,
    roiUsd !== null ? `${roiUsd.toFixed(1)}x en USD` : null,
  ].filter(Boolean).join(' · ') || 'Sin datos de costo aún'

  function ProspectCard({ p }: { p: Prospect }) {
    const overdue = isPastDate(p.next_action_date) && !['ganado', 'perdido'].includes(p.stage)
    return (
      <div
        draggable={canWrite}
        onDragStart={e => { e.dataTransfer.setData('text/plain', p.id) }}
        onClick={() => openEdit(p)}
        className="bg-white rounded-xl border border-gray-100 p-3 cursor-pointer hover:border-[#1B9BF0] hover:shadow-sm transition-all group"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-gray-900 leading-snug">{p.prospect_name}</p>
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
          <span className="text-xs font-semibold text-[#1B9BF0]">{p.probability}%</span>
          {p.expected_close_date && <span className="text-[11px] text-gray-400">{formatDateAR(p.expected_close_date)}</span>}
        </div>
        {p.next_action && (
          <div className={`flex items-center gap-1 mt-2 text-[11px] px-2 py-1 rounded-lg ${overdue ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-500'}`}>
            {overdue ? <AlertTriangle size={11}/> : <Clock size={11}/>}
            <span className="truncate">{p.next_action}{p.next_action_date ? ` — ${formatDateAR(p.next_action_date)}` : ''}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Pipeline ponderado (valor total)" ars={metrics.pipelineArs} usd={metrics.pipelineUsd}/>
        <StatCard label="Recurrente mensual ponderado" ars={metrics.mrrArs} usd={metrics.mrrUsd}/>
        <StatCard label="Costo de cotizar" ars={metrics.costoArs} usd={metrics.costoUsd}/>
        <StatCard label="ROI horas cotizando" ars={metrics.ganadoArs} usd={metrics.ganadoUsd} sub={roiSub}/>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Buscar</label>
            <input type="text" value={filterBusqueda} onChange={e => setFilterBusqueda(e.target.value)}
              placeholder="Nombre del prospecto..."
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
        </div>
      </div>

      {!filtered.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          <Target size={32} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">Sin prospectos{prospects.length ? ' para estos filtros' : ''}</p>
        </div>
      ) : view === 'kanban' ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
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
                className={`w-72 shrink-0 rounded-2xl p-2.5 transition-colors ${dragOverStage === stage.key ? 'bg-blue-50' : 'bg-gray-50'}`}>
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Prospecto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Etapa</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 whitespace-nowrap">Prob.</th>
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
                const overdue = isPastDate(p.next_action_date) && !['ganado', 'perdido'].includes(p.stage)
                const responsable = usuarios.find(u => u.id === p.responsible_id)?.full_name
                return (
                  <tr key={p.id} onClick={() => openEdit(p)} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{p.prospect_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STAGE_COLORS[p.stage]}`}>{STAGE_LABELS[p.stage]}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right whitespace-nowrap">{p.probability}%</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{SERVICE_LABELS[p.service_type] ?? p.service_type}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{responsable ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{dealSummary(p)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{p.expected_close_date ? formatDateAR(p.expected_close_date) : '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {p.next_action ? (
                        <span className={`text-xs flex items-center gap-1 ${overdue ? 'text-red-500' : 'text-gray-500'}`}>
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
