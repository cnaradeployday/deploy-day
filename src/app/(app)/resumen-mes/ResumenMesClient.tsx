'use client'
import { useRouter } from 'next/navigation'
import { Download, BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import * as XLSX from 'xlsx'

function nombreMes(m: string) {
  return new Date(m + '-15').toLocaleString('es-AR', { month: 'long', year: 'numeric' })
}

export default function ResumenMesClient({ filas, mes, mesActual, clientes, filterCliente }: {
  filas: {
    id: string; nombre: string; cliente: string; clienteId: string
    horasVendidas: number; horasEstimadas: number; horasConsumidas: number
  }[]
  mes: string
  mesActual: string
  clientes: any[]
  filterCliente: string
}) {
  const router = useRouter()

  const meses: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    meses.push(d.toISOString().slice(0, 7))
  }

  function navTo(params: Record<string, string>) {
    const p = new URLSearchParams()
    p.set('mes', mes)
    if (filterCliente) p.set('cliente', filterCliente)
    Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v); else p.delete(k) })
    router.push('/resumen-mes?' + p.toString())
  }

  const filtered = filterCliente ? filas.filter(f => f.clienteId === filterCliente) : filas

  const totalVendidas = filtered.reduce((s, f) => s + f.horasVendidas, 0)
  const totalEstimadas = filtered.reduce((s, f) => s + f.horasEstimadas, 0)
  const totalConsumidas = filtered.reduce((s, f) => s + f.horasConsumidas, 0)

  function exportar() {
    const data = filtered.map(f => ({
      Mes: nombreMes(mes),
      Cliente: f.cliente,
      Proyecto: f.nombre,
      'Horas vendidas': f.horasVendidas,
      'Horas estimadas': f.horasEstimadas,
      'Horas consumidas': f.horasConsumidas,
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
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Horas vendidas', value: totalVendidas, color: 'text-gray-900' },
          { label: 'Horas estimadas', value: totalEstimadas, color: totalEstimadas > totalVendidas ? 'text-red-500' : 'text-gray-900' },
          { label: 'Horas consumidas', value: totalConsumidas, color: 'text-[#1B9BF0]' },
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
          <div className="grid grid-cols-12 px-5 py-3 text-xs font-medium text-gray-400 border-b border-gray-50 bg-gray-50">
            <span className="col-span-2">Mes</span>
            <span className="col-span-2">Cliente</span>
            <span className="col-span-3">Proyecto</span>
            <span className="text-right col-span-2">Vendidas</span>
            <span className="text-right col-span-1">Estimadas</span>
            <span className="text-right col-span-1">Consumidas</span>
            <span className="text-right col-span-1">%</span>
          </div>
          {filtered.map(f => {
            const pct = f.horasEstimadas > 0 ? Math.round((f.horasConsumidas / f.horasEstimadas) * 100) : null
            const overEstimado = f.horasEstimadas > f.horasVendidas
            const pctColor = pct === null ? 'text-gray-300' : pct >= 100 ? 'text-red-500 font-bold' : pct >= 80 ? 'text-amber-500 font-semibold' : 'text-green-600'
            return (
              <div key={f.id} className="grid grid-cols-12 px-5 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 items-center">
                <span className="col-span-2 text-xs text-gray-400 capitalize">{nombreMes(mes)}</span>
                <span className="col-span-2 text-xs text-gray-500 truncate">{f.cliente}</span>
                <span className="col-span-3 text-sm text-gray-900 truncate font-medium">{f.nombre}</span>
                <span className="col-span-2 text-sm font-semibold text-gray-900 text-right">{f.horasVendidas}h</span>
                <div className="col-span-1 text-right flex items-center justify-end gap-1">
                  <TrendIcon vendidas={f.horasVendidas} estimadas={f.horasEstimadas}/>
                  <span className={'text-sm ' + (overEstimado ? 'text-red-500 font-semibold' : 'text-gray-700')}>{f.horasEstimadas}h</span>
                </div>
                <span className="col-span-1 text-sm text-[#1B9BF0] font-semibold text-right">{f.horasConsumidas}h</span>
                <span className={'col-span-1 text-xs text-right ' + pctColor}>{pct !== null ? pct + '%' : '—'}</span>
              </div>
            )
          })}
          <div className="grid grid-cols-12 px-5 py-3 bg-gray-50 border-t border-gray-100 items-center">
            <span className="col-span-7 text-sm font-semibold text-gray-700">Total</span>
            <span className="col-span-2 text-sm font-bold text-gray-900 text-right">{Math.round(totalVendidas * 10) / 10}h</span>
            <span className={'col-span-1 text-sm font-bold text-right ' + (totalEstimadas > totalVendidas ? 'text-red-500' : 'text-gray-900')}>{Math.round(totalEstimadas * 10) / 10}h</span>
            <span className="col-span-1 text-sm font-bold text-[#1B9BF0] text-right">{Math.round(totalConsumidas * 10) / 10}h</span>
            <span className="col-span-1 text-xs text-gray-400 text-right">
              {totalEstimadas > 0 ? Math.round((totalConsumidas / totalEstimadas) * 100) + '%' : '—'}
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-6 text-xs text-gray-400">
        <span className="flex items-center gap-1.5"><TrendingUp size={12} className="text-red-400"/> Estimadas superan las vendidas</span>
        <span className="flex items-center gap-1.5"><Minus size={12} className="text-amber-400"/> Dentro del rango (80-100%)</span>
        <span className="flex items-center gap-1.5"><TrendingDown size={12} className="text-green-500"/> Uso eficiente (&lt;80%)</span>
      </div>
    </div>
  )
}
