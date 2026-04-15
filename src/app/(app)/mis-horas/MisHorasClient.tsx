'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { Download, Clock } from 'lucide-react'

const estadoLiqLabels: Record<string, string> = {
  borrador: 'Realizadas',
  confirmado_colaborador: 'Confirmadas',
  aprobado_gerente: 'Aprobadas',
  factura_subida: 'Factura enviada',
  pagado: 'Cobradas',
}
const estadoLiqColors: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-500',
  confirmado_colaborador: 'bg-blue-50 text-blue-600',
  aprobado_gerente: 'bg-amber-50 text-amber-600',
  factura_subida: 'bg-purple-50 text-purple-600',
  pagado: 'bg-green-50 text-green-600',
}

export default function MisHorasClient({ entries, mes, mesActual, estadoLiquidacion, filterTarea, filterCliente }: {
  entries: any[]
  mes: string
  mesActual: string
  estadoLiquidacion: string | null
  filterTarea?: string
  filterCliente?: string
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
    if (filterTarea) p.set('tarea', filterTarea)
    if (filterCliente) p.set('cliente', filterCliente)
    Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v); else p.delete(k) })
    router.push('/mis-horas?' + p.toString())
  }

  // Filtros locales
  let filtered = [...entries]
  if (filterTarea) filtered = filtered.filter(e => e.task?.id === filterTarea)
  if (filterCliente) filtered = filtered.filter(e => e.task?.project?.client?.name === filterCliente)

  const totalHoras = filtered.reduce((s, e) => s + e.hours_logged, 0)
  const estadoLabel = estadoLiqLabels[estadoLiquidacion ?? 'borrador'] ?? 'Realizadas'
  const estadoColor = estadoLiqColors[estadoLiquidacion ?? 'borrador'] ?? 'bg-gray-100 text-gray-500'
  const nombreMes = new Date(mes + '-15').toLocaleString('es-AR', { month: 'long', year: 'numeric' })

  const tareasUnicas = [...new Map(entries.map(e => [e.task?.id, e.task])).values()].filter(Boolean)
  const clientesUnicos = [...new Set(entries.map(e => e.task?.project?.client?.name).filter(Boolean))]

  function exportar() {
    const data = filtered.map(e => ({
      Mes: mes,
      Fecha: e.entry_date,
      Tarea: e.task?.title ?? '—',
      Cliente: e.task?.project?.client?.name ?? '—',
      Proyecto: e.task?.project?.name ?? '—',
      Horas: e.hours_logged,
      Estado: estadoLabel,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Mis horas')
    XLSX.writeFile(wb, 'mis-horas-' + mes + '.xlsx')
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Mis horas</h1>
          <p className="text-sm text-gray-400 mt-0.5 capitalize">{nombreMes} · {Math.round(totalHoras * 100) / 100}h totales</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mes} onChange={e => navTo({ mes: e.target.value })}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white capitalize">
            {meses.map(m => (
              <option key={m} value={m}>{new Date(m + '-15').toLocaleString('es-AR', { month: 'long', year: 'numeric' })}</option>
            ))}
          </select>
          <button onClick={exportar}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            <Download size={14}/> Excel
          </button>
        </div>
      </div>

      {/* Estado liquidación */}
      <div className={'mb-4 px-4 py-3 rounded-2xl text-sm flex items-center justify-between ' + estadoColor}>
        <span>Estado del mes: <strong>{estadoLabel}</strong></span>
        <Link href="/liquidaciones" className="text-xs underline opacity-70 hover:opacity-100">Ver liquidaciones →</Link>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Tarea</label>
            <select value={filterTarea ?? ''} onChange={e => navTo({ tarea: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Todas</option>
              {tareasUnicas.map((t: any) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Cliente</label>
            <select value={filterCliente ?? ''} onChange={e => navTo({ cliente: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Todos</option>
              {clientesUnicos.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Estado</label>
            <div className={'px-3 py-2 rounded-xl text-xs font-medium ' + estadoColor}>{estadoLabel}</div>
          </div>
        </div>
        {(filterTarea || filterCliente) && (
          <div className="flex justify-end mt-2">
            <button onClick={() => navTo({ tarea: '', cliente: '' })}
              className="text-xs text-gray-400 hover:text-gray-600">Limpiar filtros</button>
          </div>
        )}
      </div>

      {!filtered.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          <Clock size={32} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">Sin horas en {nombreMes}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-6 px-5 py-3 text-xs font-medium text-gray-400 border-b border-gray-50 bg-gray-50">
            <span>Mes</span>
            <span className="col-span-2">Tarea</span>
            <span>Cliente</span>
            <span className="text-right">Horas</span>
            <span className="text-right">Estado</span>
          </div>
          {filtered.map(e => (
            <div key={e.id} className="grid grid-cols-6 px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 items-center">
              <span className="text-xs text-gray-400 capitalize">
                {new Date(e.entry_date).toLocaleString('es-AR', { month: 'short', year: '2-digit' })}
              </span>
              <div className="col-span-2">
                <p className="text-sm text-gray-900 truncate">{e.task?.title ?? '—'}</p>
                <p className="text-xs text-gray-400">{e.task?.project?.name}</p>
              </div>
              <span className="text-xs text-gray-500">{e.task?.project?.client?.name ?? '—'}</span>
              <span className="text-sm font-semibold text-gray-900 text-right">{e.hours_logged}h</span>
              <span className={'text-right'}>
                <span className={'text-xs px-2 py-0.5 rounded-full ' + estadoColor}>{estadoLabel}</span>
              </span>
            </div>
          ))}
          <div className="grid grid-cols-6 px-5 py-3 bg-gray-50 border-t border-gray-100">
            <span className="col-span-4 text-sm font-semibold text-gray-700">Total</span>
            <span className="text-sm font-bold text-[#1B9BF0] text-right">{Math.round(totalHoras * 100) / 100}h</span>
            <span/>
          </div>
        </div>
      )}
    </div>
  )
}
