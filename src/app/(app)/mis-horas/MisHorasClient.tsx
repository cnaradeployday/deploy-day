'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { Download, Calendar, Clock } from 'lucide-react'

const estadoColors: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-500',
  confirmado_colaborador: 'bg-blue-50 text-blue-600',
  aprobado_gerente: 'bg-amber-50 text-amber-600',
  factura_subida: 'bg-purple-50 text-purple-600',
  pagado: 'bg-green-50 text-green-600',
}
const estadoLabels: Record<string, string> = {
  borrador: 'Realizadas',
  confirmado_colaborador: 'Confirmadas',
  aprobado_gerente: 'Aprobadas',
  factura_subida: 'Factura enviada',
  pagado: 'Cobradas',
}

export default function MisHorasClient({ entries, mes, mesActual, estadoLiquidacion }: {
  entries: any[]
  mes: string
  mesActual: string
  estadoLiquidacion: string | null
}) {
  const router = useRouter()
  const totalHoras = entries.reduce((s, e) => s + e.hours_logged, 0)

  const meses: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    meses.push(d.toISOString().slice(0, 7))
  }

  function exportar() {
    const data = entries.map(e => ({
      Fecha: e.entry_date,
      Tarea: e.task?.title ?? '—',
      Cliente: e.task?.project?.client?.name ?? '—',
      Horas: e.hours_logged,
      Notas: e.notes ?? '',
      Estado: estadoLabels[estadoLiquidacion ?? 'borrador'] ?? 'Realizadas',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Mis horas')
    XLSX.writeFile(wb, 'mis-horas-' + mes + '.xlsx')
  }

  const nombreMes = new Date(mes + '-15').toLocaleString('es-AR', { month: 'long', year: 'numeric' })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Mis horas</h1>
          <p className="text-sm text-gray-400 mt-0.5 capitalize">{nombreMes} · {Math.round(totalHoras * 100) / 100}h totales</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mes} onChange={e => router.push('/mis-horas?mes=' + e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
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

      {estadoLiquidacion && (
        <div className={'mb-4 px-4 py-3 rounded-2xl text-sm flex items-center justify-between ' + (estadoColors[estadoLiquidacion] ?? 'bg-gray-100 text-gray-500')}>
          <span>Estado de liquidación: <strong>{estadoLabels[estadoLiquidacion] ?? estadoLiquidacion}</strong></span>
          <Link href="/liquidaciones" className="text-xs underline">Ver liquidaciones</Link>
        </div>
      )}

      {!entries.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          <Clock size={32} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">Sin horas cargadas en {nombreMes}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-5 px-5 py-3 text-xs font-medium text-gray-400 border-b border-gray-50 bg-gray-50">
            <span>Fecha</span>
            <span className="col-span-2">Tarea</span>
            <span>Cliente</span>
            <span className="text-right">Horas</span>
          </div>
          {entries.map(e => (
            <div key={e.id} className="grid grid-cols-5 px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 items-center">
              <span className="text-xs text-gray-500">{new Date(e.entry_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
              <div className="col-span-2">
                <p className="text-sm text-gray-900 truncate">{e.task?.title ?? '—'}</p>
                <p className="text-xs text-gray-400">{e.task?.project?.name}</p>
              </div>
              <span className="text-xs text-gray-500">{e.task?.project?.client?.name ?? '—'}</span>
              <span className="text-sm font-semibold text-gray-900 text-right">{e.hours_logged}h</span>
            </div>
          ))}
          <div className="grid grid-cols-5 px-5 py-3 bg-gray-50 border-t border-gray-100">
            <span className="col-span-4 text-sm font-semibold text-gray-700">Total</span>
            <span className="text-sm font-bold text-[#1B9BF0] text-right">{Math.round(totalHoras * 100) / 100}h</span>
          </div>
        </div>
      )}
    </div>
  )
}
