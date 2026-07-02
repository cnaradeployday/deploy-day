'use client'
import { useState, useMemo } from 'react'

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

export default function ResumenFacturasClient({
  facturas, months,
}: {
  facturas: any[]
  months: string[]
}) {
  const [visibleMonths, setVisibleMonths] = useState<Set<string>>(new Set(months))

  function toggleMonth(m: string) {
    setVisibleMonths(prev => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m)
      else next.add(m)
      return next
    })
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

  return (
    <div className="p-6 max-w-full mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Resumen de facturación</h1>
        <p className="text-sm text-gray-400 mt-0.5">Estado de facturas por cliente — últimos 12 meses</p>
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
      <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
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
            {clientList.length === 0 ? (
              <tr>
                <td colSpan={shownMonths.length + 1} className="px-4 py-10 text-center text-sm text-gray-400">
                  Sin datos de facturación en el período
                </td>
              </tr>
            ) : clientList.map(({ id, name }) => (
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
    </div>
  )
}
