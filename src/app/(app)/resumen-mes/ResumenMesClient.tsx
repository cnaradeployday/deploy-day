'use client'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useRef, useEffect } from 'react'
import { Download, BarChart3, TrendingUp, TrendingDown, Minus, RefreshCw, ChevronRight, ChevronDown, Check, AlertTriangle, CornerDownRight, ArrowUp, ArrowDown, ArrowUpDown, Filter, type LucideIcon } from 'lucide-react'
import * as XLSX from 'xlsx'

const ESTADO_LABELS = ['Sin horas vendidas', 'Subejecutando', 'Sobreejecutando', 'En ritmo', 'Pocas hs. programadas', 'Muchas hs. programadas'] as const
type SortKey = 'cliente' | 'vendidas' | 'estimadas' | 'usadas' | 'pct'

function nombreMes(m: string) {
  return new Date(m + '-15').toLocaleString('es-AR', { month: 'long', year: 'numeric' })
}
function nombreMesCorto(m: string) {
  return new Date(m + '-15').toLocaleString('es-AR', { month: 'short', year: '2-digit' })
}

// Tolerancia: +/-20 puntos porcentuales entre % de horas usadas (vs. vendidas) y % del mes transcurrido.
// Tolerancia: +/-20% relativo entre horas estimadas (programadas) y horas vendidas.
function estadoBadges(vendidas: number, estimadas: number, usadas: number, pctTiempo: number) {
  const badges: { label: string; Icon: LucideIcon; cls: string }[] = []
  if (vendidas <= 0) {
    badges.push({ label: 'Sin horas vendidas', Icon: Minus, cls: 'bg-gray-100 text-gray-400' })
    return badges
  }
  const pctEjecucion = usadas / vendidas
  const diffPuntos = (pctEjecucion - pctTiempo) * 100
  if (diffPuntos < -20) badges.push({ label: 'Subejecutando', Icon: TrendingDown, cls: 'bg-amber-50 text-amber-600' })
  else if (diffPuntos > 20) badges.push({ label: 'Sobreejecutando', Icon: TrendingUp, cls: 'bg-red-50 text-red-600' })
  else badges.push({ label: 'En ritmo', Icon: Check, cls: 'bg-green-50 text-green-600' })

  const ratioProgramacion = estimadas / vendidas
  if (ratioProgramacion < 0.8) badges.push({ label: 'Pocas hs. programadas', Icon: AlertTriangle, cls: 'bg-orange-50 text-orange-600' })
  else if (ratioProgramacion > 1.2) badges.push({ label: 'Muchas hs. programadas', Icon: AlertTriangle, cls: 'bg-red-50 text-red-600' })

  return badges
}

function EstadoCell({ vendidas, estimadas, usadas, pctTiempo }: { vendidas: number; estimadas: number; usadas: number; pctTiempo: number }) {
  const badges = estadoBadges(vendidas, estimadas, usadas, pctTiempo)
  return (
    <div className="flex flex-col items-end gap-1">
      {badges.map((b, i) => (
        <span key={i} className={'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ' + b.cls}>
          <b.Icon size={10}/>{b.label}
        </span>
      ))}
    </div>
  )
}

function SortHeader({ label, sortKey, colSpan, align = 'right', activeSort, onSort }: {
  label: string; sortKey: SortKey; colSpan: number; align?: 'left' | 'right'
  activeSort: { key: SortKey; dir: 'asc' | 'desc' }
  onSort: (k: SortKey) => void
}) {
  const isActive = activeSort.key === sortKey
  const Icon = isActive ? (activeSort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <button onClick={() => onSort(sortKey)}
      className={`col-span-${colSpan} flex items-center gap-1 hover:text-gray-600 transition-colors ${align === 'right' ? 'justify-end' : ''} ${isActive ? 'text-gray-600' : ''}`}>
      {label}<Icon size={11} className={isActive ? 'opacity-100' : 'opacity-30'}/>
    </button>
  )
}

function EstadoFilterDropdown({ selected, onChange }: { selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function toggle(label: string) {
    const next = new Set(selected)
    if (next.has(label)) next.delete(label); else next.add(label)
    onChange(next)
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1 hover:text-gray-600 transition-colors ${selected.size > 0 ? 'text-[#1B9BF0] font-semibold' : ''}`}>
        Estado <Filter size={11}/>{selected.size > 0 && <span className="text-[10px]">({selected.size})</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 min-w-[210px] p-2">
          <div className="flex items-center justify-between px-2 pb-1 mb-1 border-b border-gray-50">
            <span className="text-[11px] font-medium text-gray-400">Filtrar por estado</span>
            {selected.size > 0 && <button onClick={() => onChange(new Set())} className="text-[10px] text-[#1B9BF0] hover:underline">Limpiar</button>}
          </div>
          {ESTADO_LABELS.map(label => (
            <label key={label} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-left">
              <input type="checkbox" checked={selected.has(label)} onChange={() => toggle(label)} className="accent-[#1B9BF0]"/>
              <span className="text-xs text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ResumenMesClient({ filas, mes, mesActual, clientes, filterCliente, mesesDisponibles = [] }: {
  filas: {
    id: string; nombre: string; cliente: string; clienteId: string
    horasVendidas: number; horasEstimadas: number; horasConsumidas: number
  }[]
  mes: string
  mesActual: string
  clientes: any[]
  filterCliente: string
  mesesDisponibles?: string[]
}) {
  const router = useRouter()

  // Usar meses del server (basados en segmentos reales) o fallback a 6 meses
  const meses: string[] = mesesDisponibles.length > 0 ? mesesDisponibles : (() => {
    const arr: string[] = []
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      arr.push(d.toISOString().slice(0, 7))
    }
    return arr
  })()

  function navTo(params: Record<string, string>) {
    const p = new URLSearchParams()
    p.set('mes', mes)
    if (filterCliente) p.set('cliente', filterCliente)
    Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v); else p.delete(k) })
    router.push('/resumen-mes?' + p.toString())
  }

  // % del mes ya transcurrido: mes pasado = 100%, mes futuro = 0%, mes actual = dia de hoy / dias del mes
  const pctTiempo = useMemo(() => {
    const [y, mm] = mes.split('-').map(Number)
    const totalDias = new Date(y, mm, 0).getDate()
    const diaRef = mes === mesActual ? new Date().getDate() : mes < mesActual ? totalDias : 0
    return diaRef / totalDias
  }, [mes, mesActual])

  const [estadoFilter, setEstadoFilter] = useState<Set<string>>(new Set())

  const filteredByCliente = filterCliente ? filas.filter(f => f.clienteId === filterCliente) : filas

  const filtered = useMemo(() => {
    if (estadoFilter.size === 0) return filteredByCliente
    return filteredByCliente.filter(f => {
      const labels = estadoBadges(f.horasVendidas, f.horasEstimadas, f.horasConsumidas, pctTiempo).map(b => b.label)
      return labels.some(l => estadoFilter.has(l))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredByCliente, estadoFilter, pctTiempo])

  const totalVendidas = filtered.reduce((s, f) => s + f.horasVendidas, 0)
  const totalEstimadas = filtered.reduce((s, f) => s + f.horasEstimadas, 0)
  const totalConsumidas = filtered.reduce((s, f) => s + f.horasConsumidas, 0)

  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'cliente', dir: 'asc' })
  function onSort(key: SortKey) {
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  const grupos = useMemo(() => {
    const map = new Map<string, { clienteId: string; cliente: string; proyectos: typeof filtered; vendidas: number; estimadas: number; usadas: number }>()
    filtered.forEach(f => {
      const key = f.clienteId || f.cliente
      let g = map.get(key)
      if (!g) { g = { clienteId: f.clienteId, cliente: f.cliente, proyectos: [], vendidas: 0, estimadas: 0, usadas: 0 }; map.set(key, g) }
      g.proyectos.push(f)
      g.vendidas += f.horasVendidas
      g.estimadas += f.horasEstimadas
      g.usadas += f.horasConsumidas
    })
    const arr = [...map.values()]
    arr.forEach(g => g.proyectos.sort((a, b) => a.nombre.localeCompare(b.nombre)))
    const dir = sort.dir === 'asc' ? 1 : -1
    const pctOf = (g: { estimadas: number; usadas: number }) => g.estimadas > 0 ? g.usadas / g.estimadas : -1
    arr.sort((a, b) => {
      switch (sort.key) {
        case 'vendidas': return dir * (a.vendidas - b.vendidas)
        case 'estimadas': return dir * (a.estimadas - b.estimadas)
        case 'usadas': return dir * (a.usadas - b.usadas)
        case 'pct': return dir * (pctOf(a) - pctOf(b))
        default: return dir * a.cliente.localeCompare(b.cliente)
      }
    })
    return arr
  }, [filtered, sort])

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  function toggleExpand(clienteId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(clienteId)) next.delete(clienteId); else next.add(clienteId)
      return next
    })
  }

  function exportar() {
    const data = filtered.map(f => ({
      Mes: nombreMes(mes),
      Cliente: f.cliente,
      Proyecto: f.nombre,
      'Horas vendidas': f.horasVendidas,
      'Horas estimadas': f.horasEstimadas,
      'Horas usadas': f.horasConsumidas,
      'Diferencia': f.horasVendidas - f.horasEstimadas,
      '% consumido': f.horasEstimadas > 0 ? Math.round((f.horasConsumidas / f.horasEstimadas) * 100) + '%' : '—',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Resumen del mes')
    XLSX.writeFile(wb, 'resumen-' + mes + '.xlsx')
  }

  function TrendIcon({ vendidas, estimadas }: { vendidas: number; estimadas: number }) {
    if (estimadas === 0) return <Minus size={13} className="text-gray-300"/>
    if (estimadas > vendidas) return <TrendingUp size={13} className="text-red-400"/>
    if (estimadas < vendidas * 0.8) return <TrendingDown size={13} className="text-green-500"/>
    return <Minus size={13} className="text-amber-400"/>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 size={18} className="text-[#1B9BF0]"/> Resumen del mes
          </h1>
          <p className="text-sm text-gray-400 mt-0.5 capitalize">{nombreMes(mes)} · {filtered.length} proyectos</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mes} onChange={e => navTo({ mes: e.target.value })}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white capitalize">
            {meses.map(m => <option key={m} value={m}>{nombreMes(m)}</option>)}
          </select>
          <button onClick={exportar}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            <Download size={14}/> Excel
          </button>
          <button onClick={() => { router.refresh(); window.location.reload() }}
            title="Refrescar datos"
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-all">
            <RefreshCw size={14}/>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Horas vendidas', value: totalVendidas, color: 'text-gray-900' },
          { label: 'Horas estimadas', value: totalEstimadas, color: totalEstimadas > totalVendidas ? 'text-red-500' : 'text-gray-900' },
          { label: 'Horas usadas', value: totalConsumidas, color: 'text-[#1B9BF0]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className={'text-2xl font-bold ' + color}>{Math.round(value * 10) / 10}h</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">Cliente</label>
          <select value={filterCliente} onChange={e => navTo({ cliente: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
            <option value="">Todos los clientes</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {filterCliente && (
          <button onClick={() => navTo({ cliente: '' })} className="text-xs text-gray-400 hover:text-gray-600 mt-4">Limpiar</button>
        )}
      </div>

      {!filtered.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          <BarChart3 size={32} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">Sin proyectos activos para este período</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-12 px-5 py-3 text-xs font-medium text-gray-400 border-b border-gray-50 bg-gray-50 items-center">
            <span className="col-span-1">Mes</span>
            <SortHeader label="Cliente" sortKey="cliente" colSpan={3} align="left" activeSort={sort} onSort={onSort}/>
            <SortHeader label="Vendidas" sortKey="vendidas" colSpan={2} activeSort={sort} onSort={onSort}/>
            <SortHeader label="Estimadas" sortKey="estimadas" colSpan={1} activeSort={sort} onSort={onSort}/>
            <SortHeader label="Usadas" sortKey="usadas" colSpan={1} activeSort={sort} onSort={onSort}/>
            <SortHeader label="%" sortKey="pct" colSpan={1} activeSort={sort} onSort={onSort}/>
            <div className="col-span-3 flex justify-end">
              <EstadoFilterDropdown selected={estadoFilter} onChange={setEstadoFilter}/>
            </div>
          </div>
          {grupos.map(g => {
            const isOpen = expanded.has(g.clienteId)
            const pctG = g.estimadas > 0 ? Math.round((g.usadas / g.estimadas) * 100) : null
            const overEstimadoG = g.estimadas > g.vendidas
            const pctColorG = pctG === null ? 'text-gray-300' : pctG >= 100 ? 'text-red-500 font-bold' : pctG >= 80 ? 'text-amber-500 font-semibold' : 'text-green-600'
            return (
              <div key={g.clienteId || g.cliente}>
                <div onClick={() => toggleExpand(g.clienteId)} className="grid grid-cols-12 px-5 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 items-center cursor-pointer">
                  <span className="col-span-1 text-xs text-gray-400 capitalize">{nombreMesCorto(mes)}</span>
                  <span className="col-span-3 text-sm text-gray-900 font-semibold flex items-center gap-1.5 min-w-0">
                    {isOpen ? <ChevronDown size={14} className="text-gray-400 shrink-0"/> : <ChevronRight size={14} className="text-gray-400 shrink-0"/>}
                    <span className="truncate">{g.cliente}</span>
                    <span className="text-[10px] text-gray-300 font-normal shrink-0">({g.proyectos.length})</span>
                  </span>
                  <span className="col-span-2 text-sm font-semibold text-gray-900 text-right">{Math.round(g.vendidas * 10) / 10}h</span>
                  <div className="col-span-1 text-right flex items-center justify-end gap-1">
                    <span className={'text-sm ' + (overEstimadoG ? 'text-red-500 font-semibold' : 'text-gray-700')}>{Math.round(g.estimadas * 10) / 10}h</span>
                  </div>
                  <span className="col-span-1 text-sm text-[#1B9BF0] font-semibold text-right">{Math.round(g.usadas * 10) / 10}h</span>
                  <span className={'col-span-1 text-xs text-right ' + pctColorG}>{pctG !== null ? pctG + '%' : '—'}</span>
                  <div className="col-span-3" onClick={e => e.stopPropagation()}>
                    <EstadoCell vendidas={g.vendidas} estimadas={g.estimadas} usadas={g.usadas} pctTiempo={pctTiempo}/>
                  </div>
                </div>
                {isOpen && g.proyectos.map(f => {
                  const pct = f.horasEstimadas > 0 ? Math.round((f.horasConsumidas / f.horasEstimadas) * 100) : null
                  const overEstimado = f.horasEstimadas > f.horasVendidas
                  const pctColor = pct === null ? 'text-gray-300' : pct >= 100 ? 'text-red-500 font-bold' : pct >= 80 ? 'text-amber-500 font-semibold' : 'text-green-600'
                  return (
                    <div key={f.id} className="grid grid-cols-12 px-5 py-2.5 border-b border-gray-50 last:border-0 bg-gray-50/60 hover:bg-gray-50 items-center">
                      <span className="col-span-1"/>
                      <span className="col-span-3 text-xs text-gray-500 truncate pl-5 flex items-center gap-1.5 min-w-0"><CornerDownRight size={11} className="text-gray-300 shrink-0"/><span className="truncate">{f.nombre}</span></span>
                      <span className="col-span-2 text-sm text-gray-700 text-right">{f.horasVendidas}h</span>
                      <div className="col-span-1 text-right flex items-center justify-end gap-1">
                        <TrendIcon vendidas={f.horasVendidas} estimadas={f.horasEstimadas}/>
                        <span className={'text-xs ' + (overEstimado ? 'text-red-500 font-semibold' : 'text-gray-600')}>{f.horasEstimadas}h</span>
                      </div>
                      <span className="col-span-1 text-sm text-[#1B9BF0] text-right">{f.horasConsumidas}h</span>
                      <span className={'col-span-1 text-xs text-right ' + pctColor}>{pct !== null ? pct + '%' : '—'}</span>
                      <div className="col-span-3">
                        <EstadoCell vendidas={f.horasVendidas} estimadas={f.horasEstimadas} usadas={f.horasConsumidas} pctTiempo={pctTiempo}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
          <div className="grid grid-cols-12 px-5 py-3 bg-gray-50 border-t border-gray-100 items-center">
            <span className="col-span-4 text-sm font-semibold text-gray-700">Total</span>
            <span className="col-span-2 text-sm font-bold text-gray-900 text-right">{Math.round(totalVendidas * 10) / 10}h</span>
            <span className={'col-span-1 text-sm font-bold text-right ' + (totalEstimadas > totalVendidas ? 'text-red-500' : 'text-gray-900')}>{Math.round(totalEstimadas * 10) / 10}h</span>
            <span className="col-span-1 text-sm font-bold text-[#1B9BF0] text-right">{Math.round(totalConsumidas * 10) / 10}h</span>
            <span className="col-span-1 text-xs text-gray-400 text-right">
              {totalEstimadas > 0 ? Math.round((totalConsumidas / totalEstimadas) * 100) + '%' : '—'}
            </span>
            <span className="col-span-3"/>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-gray-400">
        <span className="flex items-center gap-1.5"><TrendingUp size={12} className="text-red-400"/> Estimadas superan las vendidas</span>
        <span className="flex items-center gap-1.5"><Minus size={12} className="text-amber-400"/> Dentro del rango (80-100%)</span>
        <span className="flex items-center gap-1.5"><TrendingDown size={12} className="text-green-500"/> Uso eficiente (&lt;80%)</span>
        <span className="flex items-center gap-1.5"><Check size={12} className="text-green-600"/> Ritmo de uso vs. % del mes transcurrido (tolerancia ±20 puntos)</span>
        <span className="flex items-center gap-1.5"><AlertTriangle size={12} className="text-orange-500"/> Horas programadas vs. vendidas (tolerancia ±20%)</span>
      </div>
    </div>
  )
}
