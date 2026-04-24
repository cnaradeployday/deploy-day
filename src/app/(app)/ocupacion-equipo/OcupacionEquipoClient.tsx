'use client'
import { useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { ChevronUp, ChevronDown, Download, RefreshCw, Users } from 'lucide-react'

type SortKey = 'nombre' | 'disponibilidad' | 'programadas' | 'disponibles' | 'realizadas'

function nombreMes(m: string) {
  return new Date(m + '-15').toLocaleString('es-AR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

export default function OcupacionEquipoClient({ filas, mes, mesActual, mesesDisponibles }: {
  filas: any[]; mes: string; mesActual: string; mesesDisponibles: string[]
}) {
  const router = useRouter()
  const [sortKey, setSortKey] = useState<SortKey>('nombre')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronUp size={11} className="opacity-20"/>
    return sortDir === 'asc' ? <ChevronUp size={11}/> : <ChevronDown size={11}/>
  }

  const sorted = useMemo(() => [...filas].sort((a, b) => {
    const va = a[sortKey], vb = b[sortKey]
    const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))
    return sortDir === 'asc' ? cmp : -cmp
  }), [filas, sortKey, sortDir])

  const totales = {
    disponibilidad: Math.round(filas.reduce((s,f) => s + f.disponibilidad, 0) * 10) / 10,
    programadas:    Math.round(filas.reduce((s,f) => s + f.programadas, 0) * 10) / 10,
    disponibles:    Math.round(filas.reduce((s,f) => s + f.disponibles, 0) * 10) / 10,
    realizadas:     Math.round(filas.reduce((s,f) => s + f.realizadas, 0) * 10) / 10,
  }

  function exportar() {
    const data = [
      ...sorted.map(f => ({
        'Nombre': f.nombre, 'Disponibilidad (h)': f.disponibilidad,
        'Estimadas (h)': f.programadas, 'Disponibles (h)': f.disponibles, 'Realizadas (h)': f.realizadas,
      })),
      { 'Nombre': 'TOTAL', 'Disponibilidad (h)': totales.disponibilidad,
        'Estimadas (h)': totales.programadas, 'Disponibles (h)': totales.disponibles, 'Realizadas (h)': totales.realizadas },
    ]
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ocupacion')
    XLSX.writeFile(wb, 'ocupacion-' + mes + '.xlsx')
  }

  const cols: { key: SortKey; label: string; title?: string }[] = [
    { key: 'nombre',         label: 'Nombre' },
    { key: 'disponibilidad', label: 'Disponibilidad', title: 'Horas cargadas en el perfil del usuario' },
    { key: 'programadas',    label: 'Estimadas',    title: 'Horas estimadas en tareas del mes' },
    { key: 'disponibles',    label: 'Disponibles',    title: 'Disponibilidad − Programadas' },
    { key: 'realizadas',     label: 'Realizadas',     title: 'Horas cargadas en time entries del mes' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Users size={18} className="text-[#1B9BF0]"/> Ocupación del equipo
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{nombreMes(mes)} · {filas.length} personas</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mes} onChange={e => router.push('/ocupacion-equipo?mes=' + e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
            {mesesDisponibles.map(m => <option key={m} value={m}>{nombreMes(m)}</option>)}
          </select>
          <button onClick={exportar}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 bg-white">
            <Download size={14}/> Excel
          </button>
          <button onClick={() => { router.refresh(); window.location.reload() }} title="Refrescar"
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 bg-white">
            <RefreshCw size={14}/>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Disponibilidad total', value: totales.disponibilidad, color: 'text-gray-900' },
          { label: 'Horas estimadas',    value: totales.programadas,    color: 'text-amber-600' },
          { label: 'Horas disponibles',    value: totales.disponibles,    color: totales.disponibles < 0 ? 'text-red-500' : 'text-green-600' },
          { label: 'Horas realizadas',     value: totales.realizadas,     color: 'text-[#1B9BF0]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400">{label}</p>
            <p className={'text-xl font-bold mt-0.5 ' + color}>{value}h</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-50">
              {cols.map(({ key, label, title }) => (
                <th key={key} onClick={() => toggleSort(key)} title={title}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600 select-none whitespace-nowrap">
                  <div className="flex items-center gap-1">{label}<SortIcon k={key}/></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(f => {
              const pct = f.disponibilidad > 0 ? Math.min(100, Math.round((f.realizadas / f.disponibilidad) * 100)) : null
              const excedida = f.disponibilidad > 0 && f.programadas > f.disponibilidad
              return (
                <tr key={f.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{f.nombre}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{f.disponibilidad > 0 ? f.disponibilidad + 'h' : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-sm font-medium">
                    <span className={excedida ? 'text-red-500' : 'text-gray-700'}>
                      {f.programadas > 0 ? f.programadas + 'h' : <span className="text-gray-300">—</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold">
                    <span className={f.disponibilidad === 0 ? 'text-gray-300' : f.disponibles < 0 ? 'text-red-500' : 'text-green-600'}>
                      {f.disponibilidad > 0 ? f.disponibles + 'h' : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={f.realizadas > 0 ? 'text-sm font-medium text-[#1B9BF0]' : 'text-sm text-gray-300'}>
                        {f.realizadas > 0 ? f.realizadas + 'h' : '—'}
                      </span>
                      {pct !== null && f.realizadas > 0 && (
                        <div className="flex items-center gap-1">
                          <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={'h-full rounded-full ' + (pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-amber-400' : 'bg-[#1B9BF0]')}
                              style={{ width: pct + '%' }}/>
                          </div>
                          <span className="text-xs text-gray-400">{pct}%</span>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-100 bg-gray-50">
              <td className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Total</td>
              <td className="px-4 py-3 text-sm font-bold text-gray-900">{totales.disponibilidad}h</td>
              <td className="px-4 py-3 text-sm font-bold text-amber-600">{totales.programadas}h</td>
              <td className="px-4 py-3 text-sm font-bold text-green-600">{totales.disponibles}h</td>
              <td className="px-4 py-3 text-sm font-bold text-[#1B9BF0]">{totales.realizadas}h</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
