'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, ChevronDown, X, Check } from 'lucide-react'
import { convertToUSD, type Currency } from '@/lib/utils/currency'

const FILTER_STORAGE_KEY = 'resumenFacturas.clientesFiltro'

function formatMesLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number)
  return new Date(y, m - 1, 15)
    .toLocaleString('es-AR', { month: 'short', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

function getEstadoEfectivo(f: any): 'cobrada' | 'vencida' | 'pendiente' {
  if (f.estado === 'cobrada') return 'cobrada'
  if (f.estado === 'vencida') return 'vencida'
  if (f.fecha_vencimiento && new Date(f.fecha_vencimiento) < new Date()) return 'vencida'
  return 'pendiente'
}

function formatImporte(f: any): string {
  return (f.currency === 'USD' ? 'USD ' : '$ ') + Number(f.importe).toLocaleString('es-AR')
}

function fmtUSD(n: number): string {
  return 'USD ' + Math.round(n).toLocaleString('es-AR')
}

const estadoStyle = {
  cobrada:  'bg-green-500 text-white',
  pendiente:'bg-amber-400 text-white',
  vencida:  'bg-red-500 text-white',
}
const estadoLabel = {
  cobrada: 'Pagada',
  pendiente: 'Pendiente',
  vencida: 'Vencida',
}

function ClientesFiltroDropdown({
  clientes, selected, onChange,
}: {
  clientes: { id: string; name: string }[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  const label = selected.size === 0
    ? 'Todos los clientes'
    : selected.size === 1
      ? clientes.find(c => selected.has(c.id))?.name ?? '1 cliente'
      : `${selected.size} clientes seleccionados`

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-sm cursor-pointer bg-white transition-all ${
          open ? 'border-[#1B9BF0] ring-2 ring-[#1B9BF0]' : 'border-gray-200'
        }`}
      >
        <span className={selected.size ? 'text-gray-900' : 'text-gray-400'}>{label}</span>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(new Set()) }}
            className="text-gray-300 hover:text-red-400"
          >
            <X size={13} />
          </button>
        )}
        <ChevronDown size={14} className="text-gray-400" />
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="max-h-64 overflow-y-auto py-1">
            {clientes.map(c => (
              <div
                key={c.id}
                onClick={() => toggle(c.id)}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 flex items-center gap-2"
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                  selected.has(c.id) ? 'bg-[#1B9BF0] border-[#1B9BF0]' : 'border-gray-300'
                }`}>
                  {selected.has(c.id) && <Check size={11} className="text-white" />}
                </div>
                <span className="text-gray-700">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ResumenFacturasClient({
  facturas, months, year, availableYears, clientesAll, tipoCambio,
}: {
  facturas: any[]
  months: string[]
  year: number
  availableYears: number[]
  clientesAll: { id: string; name: string }[]
  tipoCambio: number | null
}) {
  const router = useRouter()
  const [visibleMonths, setVisibleMonths] = useState<Set<string>>(new Set(months))
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set())
  const [loadedFilter, setLoadedFilter] = useState(false)

  // Cargar filtro de clientes recordado
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_STORAGE_KEY)
      if (raw) setSelectedClients(new Set(JSON.parse(raw)))
    } catch {}
    setLoadedFilter(true)
  }, [])

  // Recordar el filtro de clientes para la próxima visita
  useEffect(() => {
    if (!loadedFilter) return
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify([...selectedClients]))
  }, [selectedClients, loadedFilter])

  useEffect(() => {
    setVisibleMonths(new Set(months))
  }, [months])

  function toggleMonth(m: string) {
    setVisibleMonths(prev => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m)
      else next.add(m)
      return next
    })
  }

  function goToYear(y: number) {
    router.push(`/resumen-facturas?year=${y}`)
  }

  const shownMonths = months.filter(m => visibleMonths.has(m))

  const { clientList, facturaMap } = useMemo(() => {
    const clientMap: Record<string, string> = {}
    const fMap: Record<string, Record<string, any>> = {}
    facturas.forEach(f => {
      const cId = f.client_id
      const cName = (f.client as any)?.name ?? '—'
      if (!clientMap[cId]) clientMap[cId] = cName
      if (!fMap[cId]) fMap[cId] = {}
      fMap[cId][f.mes_servicio] = f
    })
    const clientList = Object.entries(clientMap)
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }))
    return { clientList, facturaMap: fMap }
  }, [facturas])

  const shownClientList = selectedClients.size === 0
    ? clientList
    : clientList.filter(c => selectedClients.has(c.id))

  // Ranking de facturación del año, en USD, sobre todos los clientes (independiente del filtro)
  const ranking = useMemo(() => {
    const totals: Record<string, { name: string; usd: number }> = {}
    facturas.forEach(f => {
      const cId = f.client_id
      const cName = (f.client as any)?.name ?? '—'
      const usd = convertToUSD(Number(f.importe), (f.currency ?? 'ARS') as Currency, tipoCambio ?? 0)
      if (!totals[cId]) totals[cId] = { name: cName, usd: 0 }
      totals[cId].usd += usd
    })
    const totalGeneral = Object.values(totals).reduce((s, t) => s + t.usd, 0)
    return Object.values(totals)
      .map(t => ({ ...t, pct: totalGeneral > 0 ? (t.usd / totalGeneral) * 100 : 0 }))
      .sort((a, b) => b.usd - a.usd)
  }, [facturas, tipoCambio])

  const totalRankingUSD = ranking.reduce((s, r) => s + r.usd, 0)

  return (
    <div className="p-6 max-w-full mx-auto">
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Resumen de facturación</h1>
          <p className="text-sm text-gray-400 mt-0.5">Estado de facturas por cliente — año {year}</p>
        </div>

        {/* Selector de año */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-1 py-1">
          <button onClick={() => goToYear(year - 1)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all">
            <ChevronLeft size={16} />
          </button>
          <select
            value={year}
            onChange={e => goToYear(Number(e.target.value))}
            className="text-sm font-semibold text-gray-800 bg-transparent px-2 py-1 focus:outline-none cursor-pointer"
          >
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => goToYear(year + 1)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Filtro de clientes */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <span className="text-xs text-gray-400">Clientes:</span>
        <ClientesFiltroDropdown clientes={clientesAll} selected={selectedClients} onChange={setSelectedClients} />
      </div>

      {/* Month chips */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <span className="text-xs text-gray-400 mr-1">Meses a mostrar:</span>
        {months.map(m => (
          <button key={m} onClick={() => toggleMonth(m)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              visibleMonths.has(m) ? 'bg-[#1B9BF0] text-white' : 'bg-gray-100 text-gray-400'
            }`}>
            {formatMesLabel(m)}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mb-5">
        {(['cobrada', 'pendiente', 'vencida'] as const).map(est => (
          <div key={est} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${
              est === 'cobrada' ? 'bg-green-500' : est === 'pendiente' ? 'bg-amber-400' : 'bg-red-500'
            }`}/>
            <span className="text-xs text-gray-500">
              {est === 'cobrada' ? 'Pagada' : est === 'pendiente' ? 'Pendiente de cobro' : 'Vencida'}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full border border-gray-300"/>
          <span className="text-xs text-gray-500">Sin factura</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto mb-6">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 whitespace-nowrap sticky left-0 bg-white z-10 min-w-[160px]">
                Cliente
              </th>
              {shownMonths.map(m => (
                <th key={m} className="px-2 py-2.5 text-center text-xs font-medium text-gray-400 whitespace-nowrap w-[130px]">
                  {formatMesLabel(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shownClientList.length === 0 ? (
              <tr>
                <td colSpan={shownMonths.length + 1} className="px-4 py-10 text-center text-sm text-gray-400">
                  Sin datos de facturación en el período
                </td>
              </tr>
            ) : shownClientList.map(({ id, name }) => (
              <tr key={id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors">
                <td className="px-4 py-2.5 text-sm font-semibold text-gray-800 whitespace-nowrap sticky left-0 bg-inherit z-10">
                  {name}
                </td>
                {shownMonths.map(m => {
                  const f = facturaMap[id]?.[m]
                  if (!f) {
                    return (
                      <td key={m} className="px-2 py-2.5 text-center">
                        <span className="inline-block border border-gray-200 text-gray-400 text-[11px] px-3 py-1 rounded-lg whitespace-nowrap">
                          Sin factura
                        </span>
                      </td>
                    )
                  }
                  const estado = getEstadoEfectivo(f)
                  return (
                    <td key={m} className="px-2 py-2.5 text-center">
                      <span className={`inline-flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${estadoStyle[estado]}`}>
                        <span>{estadoLabel[estado]}</span>
                        <span className="text-[11px] font-medium opacity-90">{formatImporte(f)}</span>
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ranking de facturación */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Ranking de facturación — {year}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {tipoCambio ? `Todo convertido a USD (TC $${tipoCambio.toLocaleString('es-AR')})` : 'Todo convertido a USD'}
          </p>
        </div>
        {ranking.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">Sin datos de facturación en el período</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 w-10">#</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400">Cliente</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400">Monto acumulado (USD)</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 w-40">% s/ facturación total</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={r.name + i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5 text-sm font-medium text-gray-800">{r.name}</td>
                  <td className="px-4 py-2.5 text-sm font-semibold text-gray-900 text-right">{fmtUSD(r.usd)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#1B9BF0] rounded-full" style={{ width: `${Math.min(r.pct, 100)}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-600 w-12 text-right">{r.pct.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-100 bg-gray-50/50">
                <td className="px-4 py-2.5"></td>
                <td className="px-4 py-2.5 text-xs font-semibold text-gray-500">Total</td>
                <td className="px-4 py-2.5 text-sm font-bold text-gray-900 text-right">{fmtUSD(totalRankingUSD)}</td>
                <td className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">100%</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
