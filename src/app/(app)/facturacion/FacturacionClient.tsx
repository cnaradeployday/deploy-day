'use client'
import { useRouter } from 'next/navigation'
import { Download, Receipt, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import * as XLSX from 'xlsx'

function nombreMes(m: string) {
  return new Date(m + '-15').toLocaleString('es-AR', { month: 'long', year: 'numeric' })
}
function fmtUSD(n: number | null) {
  if (!n) return '—'
  return 'U$D ' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtARS(n: number | null) {
  if (!n) return '—'
  return '$' + Math.round(n).toLocaleString('es-AR')
}

export default function FacturacionClient({ filas, mes, mesActual, tipoCambio, fechaCotiz, totalHoras, totalUSD, totalARS }: {
  filas: any[]; mes: string; mesActual: string
  tipoCambio: number | null; fechaCotiz: string | null
  totalHoras: number; totalUSD: number; totalARS: number
}) {
  const router = useRouter()
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  const meses: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    meses.push(d.toISOString().slice(0, 7))
  }

  function toggle(id: string) {
    setExpandidos(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  function exportar() {
    const rows: any[] = []
    filas.forEach((c: any) => c.proyectos.forEach((p: any) => rows.push({
      Mes: nombreMes(mes), Cliente: c.clienteNombre, Proyecto: p.nombre,
      'Horas': p.horasVendidas, 'Precio/h': p.precioHora ?? '—', Moneda: p.moneda,
      'USD': p.facturacionUSD ?? '—', 'ARS': p.facturacionARS ?? '—',
      'Tipo de cambio': tipoCambio ?? '—',
    })))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Facturación')
    XLSX.writeFile(wb, 'facturacion-' + mes + '.xlsx')
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Receipt size={18} className="text-[#1B9BF0]"/> Facturación
          </h1>
          <p className="text-sm text-gray-400 mt-0.5 capitalize">
            {nombreMes(mes)} · {filas.length} clientes
            {tipoCambio && fechaCotiz && <span className="ml-2">· TC: <strong>${Number(tipoCambio).toLocaleString('es-AR')}</strong> <span className="text-gray-300">({new Date(fechaCotiz + 'T12:00:00').toLocaleDateString('es-AR')})</span></span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mes} onChange={e => router.push('/facturacion?mes=' + e.target.value)}
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
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
          <p className="text-xs text-gray-400 mb-1">Clientes activos</p>
          <p className="text-2xl font-bold text-gray-900">{filas.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
          <p className="text-xs text-gray-400 mb-1">Horas vendidas</p>
          <p className="text-2xl font-bold text-gray-900">{totalHoras}h</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
          <p className="text-xs text-gray-400 mb-1">Facturación total</p>
          <p className="text-2xl font-bold text-[#1B9BF0]">{fmtUSD(totalUSD)}</p>
          {tipoCambio && <p className="text-xs text-gray-400 mt-0.5">{fmtARS(totalARS)}</p>}
        </div>
      </div>

      {!tipoCambio && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 mb-4 text-sm text-amber-700">
          ⚠️ Sin cotización USD para este mes. Cargá una en <strong>Cotizaciones USD</strong> para ver totales en ARS.
        </div>
      )}

      {!filas.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          <Receipt size={32} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">Sin proyectos con horas asignadas en {nombreMes(mes)}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-12 px-5 py-3 text-xs font-medium text-gray-400 bg-gray-50 border-b border-gray-100">
            <span className="col-span-4">Cliente / Proyecto</span>
            <span className="col-span-2 text-right">Horas</span>
            <span className="col-span-2 text-right">Precio/h</span>
            <span className="col-span-2 text-right">USD</span>
            <span className="col-span-2 text-right">ARS</span>
          </div>

          {filas.map((c: any) => {
            const exp = expandidos.has(c.clienteId)
            const shoras = c.proyectos.reduce((s: number, p: any) => s + p.horasVendidas, 0)
            const susd = c.proyectos.reduce((s: number, p: any) => s + (p.facturacionUSD ?? 0), 0)
            const sars = c.proyectos.reduce((s: number, p: any) => s + (p.facturacionARS ?? 0), 0)
            const multi = c.proyectos.length > 1
            return (
              <div key={c.clienteId} className="border-b border-gray-50 last:border-0">
                <div onClick={() => multi && toggle(c.clienteId)}
                  className={"grid grid-cols-12 px-5 py-3.5 items-center " + (multi ? "cursor-pointer hover:bg-gray-50" : "")}>
                  <div className="col-span-4 flex items-center gap-2">
                    {multi ? (exp ? <ChevronDown size={14} className="text-gray-400 shrink-0"/> : <ChevronRight size={14} className="text-gray-400 shrink-0"/>) : <span className="w-3.5"/>}
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{c.clienteNombre}</p>
                      {!multi && <p className="text-xs text-gray-400">{c.proyectos[0].nombre}</p>}
                      {multi && <p className="text-xs text-gray-400">{c.proyectos.length} proyectos</p>}
                    </div>
                  </div>
                  <span className="col-span-2 text-sm font-semibold text-gray-900 text-right">{shoras}h</span>
                  <span className="col-span-2 text-right text-xs text-gray-400">
                    {!multi && c.proyectos[0].precioHora ? `${c.proyectos[0].moneda === 'USD' ? 'U$D' : '$'} ${c.proyectos[0].precioHora}` : '—'}
                  </span>
                  <span className="col-span-2 text-sm font-bold text-[#1B9BF0] text-right">{fmtUSD(susd)}</span>
                  <span className="col-span-2 text-xs text-gray-500 text-right">{fmtARS(sars)}</span>
                </div>
                {exp && multi && (
                  <div className="bg-gray-50/50 border-t border-gray-50">
                    {c.proyectos.map((p: any) => (
                      <div key={p.id} className="grid grid-cols-12 px-5 py-2.5 items-center border-b border-gray-50 last:border-0">
                        <div className="col-span-4 pl-6 text-xs text-gray-700">{p.nombre}</div>
                        <span className="col-span-2 text-xs text-gray-600 text-right">{p.horasVendidas}h</span>
                        <span className="col-span-2 text-right text-xs text-gray-500">
                          {p.precioHora ? `${p.moneda === 'USD' ? 'U$D' : '$'} ${p.precioHora}` : '—'}
                        </span>
                        <span className="col-span-2 text-xs text-[#1B9BF0] font-semibold text-right">{fmtUSD(p.facturacionUSD)}</span>
                        <span className="col-span-2 text-xs text-gray-500 text-right">{fmtARS(p.facturacionARS)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          <div className="grid grid-cols-12 px-5 py-4 bg-gray-50 border-t border-gray-200">
            <span className="col-span-4 text-sm font-bold text-gray-700">Total</span>
            <span className="col-span-2 text-sm font-bold text-gray-900 text-right">{totalHoras}h</span>
            <span className="col-span-2"/>
            <span className="col-span-2 text-sm font-bold text-[#1B9BF0] text-right">{fmtUSD(totalUSD)}</span>
            <span className="col-span-2 text-sm font-semibold text-gray-700 text-right">{fmtARS(totalARS)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
