'use client'
import { useState, useMemo } from 'react'

type Factura = {
  id: string
  client_id: string
  mes_servicio: string | null
  importe: number
  currency: string
  estado: string
  fecha_vencimiento: string | null
  numero: string
}

type Cliente = { id: string; name: string }
type EstadoEfectivo = 'cobrada' | 'pendiente' | 'vencida'

function getEstadoEfectivo(f: Factura): EstadoEfectivo {
  if (f.estado === 'cobrada') return 'cobrada'
  if (f.estado === 'vencida') return 'vencida'
  if (f.fecha_vencimiento && new Date(f.fecha_vencimiento) < new Date()) return 'vencida'
  return 'pendiente'
}

function worstStatus(statuses: EstadoEfectivo[]): EstadoEfectivo {
  if (statuses.includes('vencida')) return 'vencida'
  if (statuses.includes('pendiente')) return 'pendiente'
  return 'cobrada'
}

function formatMes(mes: string): string {
  return new Date(mes + '-15').toLocaleString('es-AR', { month: 'short', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

function formatMonto(importe: number, currency: string): string {
  const n = Number(importe).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return currency === 'USD' ? `USD ${n}` : `$ ${n}`
}

const cellBg: Record<EstadoEfectivo, string> = {
  cobrada:  'bg-green-50 border-green-200',
  pendiente: 'bg-amber-50 border-amber-200',
  vencida:   'bg-red-50 border-red-200',
}

const cellText: Record<EstadoEfectivo, string> = {
  cobrada:  'text-green-700',
  pendiente: 'text-amber-700',
  vencida:   'text-red-700',
}

export default function ResumenFacturasClient({
  clientes, facturas, hace12Meses,
}: {
  clientes: Cliente[]
  facturas: Factura[]
  hace12Meses: string
}) {
  const allMonths = useMemo(() => {
    const [y, m] = hace12Meses.split('-').map(Number)
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(y, m - 1 + i, 1)
      return d.toISOString().slice(0, 7)
    })
  }, [hace12Meses])

  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(() => new Set(allMonths))

  const visibleMonths = useMemo(
    () => allMonths.filter(m => selectedMonths.has(m)),
    [allMonths, selectedMonths],
  )

  function toggleMonth(m: string) {
    setSelectedMonths(prev => {
      const next = new Set(prev)
      if (next.has(m)) {
        if (next.size > 1) next.delete(m)
      } else {
        next.add(m)
      }
      return next
    })
  }

  const facturaMap = useMemo(() => {
    const map = new Map<string, Factura[]>()
    for (const f of facturas) {
      if (!f.mes_servicio) continue
      const key = `${f.client_id}|${f.mes_servicio}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(f)
    }
    return map
  }, [facturas])

  return (
    <div className="p-6 max-w-full">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Resumen de facturación</h1>
        <p className="text-xs text-gray-400 mt-0.5">Estado de facturas por cliente — últimos 12 meses</p>
      </div>

      {/* Filtro de meses */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500 shrink-0">Meses a mostrar:</span>
          {allMonths.map(m => (
            <button
              key={m}
              onClick={() => toggleMonth(m)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                selectedMonths.has(m)
                  ? 'bg-[#1B9BF0] text-white border-[#1B9BF0]'
                  : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-600'
              }`}
            >
              {formatMes(m)}
            </button>
          ))}
          {selectedMonths.size < allMonths.length && (
            <button
              onClick={() => setSelectedMonths(new Set(allMonths))}
              className="text-xs text-[#1B9BF0] hover:underline px-1"
            >
              Ver todos
            </button>
          )}
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-5 mb-4 flex-wrap">
        {([
          ['cobrada',    'bg-green-50 border-green-200', 'text-green-700', 'Pagada'],
          ['pendiente',  'bg-amber-50 border-amber-200', 'text-amber-700', 'Pendiente de cobro'],
          ['vencida',    'bg-red-50 border-red-200',     'text-red-700',   'Vencida'],
          ['sin_factura','bg-white border-gray-200',     'text-gray-300',  'Sin factura'],
        ] as const).map(([, bg, , label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-3.5 h-3.5 rounded border ${bg}`} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Tabla */}
      {!clientes.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-sm text-gray-400">
          Sin clientes activos
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
          <table className="border-collapse" style={{ minWidth: '100%' }}>
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap bg-white sticky left-0 z-10 min-w-[180px] border-r border-gray-100">
                  Cliente
                </th>
                {visibleMonths.map(m => (
                  <th key={m} className="px-3 py-3 text-center text-xs font-medium text-gray-400 whitespace-nowrap min-w-[120px]">
                    {formatMes(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientes.map(cliente => (
                <tr key={cliente.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-2.5 text-sm font-medium text-gray-700 whitespace-nowrap bg-white sticky left-0 z-10 border-r border-gray-100">
                    {cliente.name}
                  </td>
                  {visibleMonths.map(mes => {
                    const facs = facturaMap.get(`${cliente.id}|${mes}`) ?? []

                    if (!facs.length) {
                      return (
                        <td key={mes} className="px-2 py-2 text-center">
                          <div className="rounded-lg border border-gray-200 px-2 py-1.5 bg-white">
                            <span className="text-[11px] text-gray-300 font-medium tracking-wide">PENDIENTE</span>
                          </div>
                        </td>
                      )
                    }

                    const statuses = facs.map(getEstadoEfectivo)
                    const worst = worstStatus(statuses)

                    return (
                      <td key={mes} className="px-2 py-2">
                        <div className={`rounded-lg border px-2 py-1.5 space-y-0.5 ${cellBg[worst]}`}>
                          {facs.map(f => {
                            const est = getEstadoEfectivo(f)
                            return (
                              <div key={f.id} className={`text-xs font-semibold whitespace-nowrap ${cellText[est]}`}>
                                {formatMonto(f.importe, f.currency)}
                              </div>
                            )
                          })}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
