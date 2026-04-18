'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronUp, ChevronDown, FolderKanban, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

const serviceLabels: Record<string, string> = {
  marketing_digital: 'Marketing digital',
  desarrollo_producto: 'Desarrollo de producto',
  desarrollo_software: 'Desarrollo de software',
  otro: 'Otro',
}

function formatDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function nombreMes(m: string) {
  return new Date(m + '-15').toLocaleString('es-AR', { month: 'long', year: 'numeric' })
}

function MultiSelect({ label, options, selected, onChange }: {
  label: string; options: { value: string; label: string }[]
  selected: string[]; onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])
  return (
    <div className="relative">
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <button type="button" onClick={() => setOpen(!open)}
        className={"w-full px-3 py-2 border rounded-xl text-xs text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white " + (selected.length ? 'border-[#1B9BF0] text-[#1B9BF0]' : 'border-gray-200 text-gray-500')}>
        <span className="truncate">{selected.length === 0 ? 'Todos' : selected.length === 1 ? (options.find(o => o.value === selected[0])?.label ?? selected[0]) : selected.length + ' seleccionados'}</span>
        <ChevronDown size={11} className="shrink-0 ml-1"/>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)}/>
          <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-52 overflow-y-auto">
            {options.map(o => (
              <label key={o.value} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer text-xs text-gray-700">
                <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} className="rounded border-gray-300"/>
                <span className="truncate">{o.label}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

type SortKey = 'nombre' | 'cliente' | 'servicio' | 'horasMes' | 'soldHours' | 'precioHora' | 'startDate' | 'endDate'

export default function ProyectosMesClient({ filas, clientes, mes, mesActual }: {
  filas: any[]; clientes: any[]; mes: string; mesActual: string
}) {
  const router = useRouter()
  const [sortKey, setSortKey] = useState<SortKey>('nombre')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selCliente, setSelCliente] = useState<string[]>([])
  const [selServicio, setSelServicio] = useState<string[]>([])
  const [selActivo, setSelActivo] = useState<string[]>([])
  const [selMoneda, setSelMoneda] = useState<string[]>([])

  const meses: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    meses.push(d.toISOString().slice(0, 7))
  }

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    let list = [...filas]
    if (selCliente.length) list = list.filter(f => selCliente.includes(f.clienteId))
    if (selServicio.length) list = list.filter(f => selServicio.includes(f.servicio))
    if (selActivo.length) list = list.filter(f => selActivo.includes(f.isActive ? 'activo' : 'inactivo'))
    if (selMoneda.length) list = list.filter(f => selMoneda.includes(f.moneda))
    list.sort((a, b) => {
      const numKeys = ['horasMes', 'soldHours', 'precioHora']
      if (numKeys.includes(sortKey)) {
        const na = Number(a[sortKey] ?? 0), nb = Number(b[sortKey] ?? 0)
        return sortDir === 'asc' ? na - nb : nb - na
      }
      const va = String(a[sortKey] ?? ''), vb = String(b[sortKey] ?? '')
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })
    return list
  }, [filas, selCliente, selServicio, selActivo, selMoneda, sortKey, sortDir])

  const hasFilters = selCliente.length || selServicio.length || selActivo.length || selMoneda.length

  function clearFilters() { setSelCliente([]); setSelServicio([]); setSelActivo([]); setSelMoneda([]) }

  function exportar() {
    const data = filtered.map(f => ({
      Mes: nombreMes(mes), Cliente: f.cliente, Proyecto: f.nombre,
      Servicio: serviceLabels[f.servicio] ?? f.servicio,
      'Horas del mes': f.horasMes, 'Horas totales': f.soldHours,
      'Precio/hora': f.precioHora ?? '—', Moneda: f.moneda,
      Inicio: formatDate(f.startDate), Fin: formatDate(f.endDate),
      Estado: f.isActive ? 'Activo' : 'Inactivo',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Proyectos del mes')
    XLSX.writeFile(wb, 'proyectos-mes-' + mes + '.xlsx')
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronUp size={11} className="opacity-20"/>
    return sortDir === 'asc' ? <ChevronUp size={11} className="text-[#1B9BF0]"/> : <ChevronDown size={11} className="text-[#1B9BF0]"/>
  }

  const cols: { key: SortKey; label: string; span: string }[] = [
    { key: 'nombre',    label: 'Proyecto',        span: 'col-span-2' },
    { key: 'cliente',   label: 'Cliente',          span: 'col-span-2' },
    { key: 'servicio',  label: 'Tipo de servicio', span: 'col-span-2' },
    { key: 'horasMes',  label: 'Horas del mes',    span: 'col-span-1 text-right' },
    { key: 'soldHours', label: 'Horas totales',    span: 'col-span-1 text-right' },
    { key: 'precioHora',label: 'Precio/h',         span: 'col-span-1 text-right' },
    { key: 'startDate', label: 'Inicio',           span: 'col-span-1 text-center' },
    { key: 'endDate',   label: 'Fin',              span: 'col-span-1 text-center' },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <FolderKanban size={18} className="text-[#1B9BF0]"/> Proyectos del mes
          </h1>
          <p className="text-sm text-gray-400 mt-0.5 capitalize">{nombreMes(mes)} · {filtered.length} de {filas.length} proyectos</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mes} onChange={e => router.push('/proyectos-mes?mes=' + e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white capitalize">
            {meses.map(m => <option key={m} value={m}>{nombreMes(m)}</option>)}
          </select>
          <button onClick={exportar}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            <Download size={14}/> Excel
          </button>
        </div>
      </div>

      {/* Filtros multi */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MultiSelect label="Cliente" options={clientes.map(c => ({ value: c.id, label: c.name }))} selected={selCliente} onChange={setSelCliente}/>
          <MultiSelect label="Tipo de servicio" options={Object.entries(serviceLabels).map(([k,v]) => ({ value: k, label: v }))} selected={selServicio} onChange={setSelServicio}/>
          <MultiSelect label="Estado" options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} selected={selActivo} onChange={setSelActivo}/>
          <MultiSelect label="Moneda" options={[{ value: 'USD', label: 'USD' }, { value: 'ARS', label: 'ARS' }]} selected={selMoneda} onChange={setSelMoneda}/>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
          <span className="text-xs text-gray-400">{filtered.length} de {filas.length} proyectos</span>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-gray-600">Limpiar filtros</button>
          )}
        </div>
      </div>

      {/* Tabla */}
      {!filtered.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          <FolderKanban size={32} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">Sin proyectos en {nombreMes(mes)}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-11 px-5 py-3 text-xs font-medium text-gray-400 bg-gray-50 border-b border-gray-100">
            {cols.map(({ key, label, span }) => (
              <button key={key} onClick={() => toggleSort(key)}
                className={span + ' flex items-center gap-1 hover:text-gray-600 transition-colors ' + (span.includes('right') ? 'justify-end' : span.includes('center') ? 'justify-center' : '')}>
                {label} <SortIcon k={key}/>
              </button>
            ))}
          </div>
          {filtered.map(f => (
            <div key={f.id} className="grid grid-cols-11 px-5 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 items-center transition-colors">
              <div className="col-span-2">
                <p className="text-sm font-medium text-gray-900 truncate">{f.nombre}</p>
              </div>
              <span className="col-span-2 text-sm text-gray-600 truncate">{f.cliente}</span>
              <span className="col-span-2 text-xs text-gray-500">{serviceLabels[f.servicio] ?? f.servicio}</span>
              <span className="col-span-1 text-sm font-bold text-[#1B9BF0] text-right">{f.horasMes}h</span>
              <span className="col-span-1 text-sm text-gray-700 text-right">{f.soldHours}h</span>
              <span className="col-span-1 text-xs text-gray-500 text-right">
                {f.precioHora ? `${f.moneda === 'USD' ? 'U$D' : '$'} ${f.precioHora}` : '—'}
              </span>
              <span className="col-span-1 text-xs text-gray-500 text-center">{formatDate(f.startDate)}</span>
              <span className="col-span-1 text-xs text-gray-500 text-center">{formatDate(f.endDate)}</span>
            </div>
          ))}
          {/* Total */}
          <div className="grid grid-cols-11 px-5 py-3 bg-gray-50 border-t border-gray-100">
            <span className="col-span-6 text-sm font-bold text-gray-700">Total</span>
            <span className="col-span-1 text-sm font-bold text-[#1B9BF0] text-right">
              {Math.round(filtered.reduce((s, f) => s + f.horasMes, 0) * 10) / 10}h
            </span>
            <span className="col-span-1 text-sm font-bold text-gray-900 text-right">
              {filtered.reduce((s, f) => s + f.soldHours, 0)}h
            </span>
            <span className="col-span-3"/>
          </div>
        </div>
      )}
    </div>
  )
}
