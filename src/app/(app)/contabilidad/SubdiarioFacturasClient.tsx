'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronDown, ChevronUp, X, FileText, Pencil } from 'lucide-react'
import ExportExcelButton from '@/components/shared/ExportExcelButton'
import { formatDateAR } from '@/lib/utils/date'

export type SubdiarioFactura = {
  id: string
  fecha_emision: string
  numero: string
  cuit: string
  razon_social: string
  cliente: string
  estado: string
  importe: number
  importe_neto: number | null
  importe_iva: number | null
  currency: string
  mes_servicio: string | null
}

const ESTADOS = ['pendiente', 'cobrada', 'vencida']
const estadoLabel: Record<string, string> = { pendiente: 'Pendiente', cobrada: 'Cobrada', vencida: 'Vencida' }
const estadoColors: Record<string, string> = {
  pendiente: 'bg-amber-50 text-amber-600',
  cobrada:   'bg-green-50 text-green-600',
  vencida:   'bg-red-50 text-red-600',
}

function formatMes(mes: string | null) {
  if (!mes) return '—'
  return new Date(mes + '-15').toLocaleString('es-AR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())
}

function CheckDropdown({
  label, options, selected, onChange,
}: {
  label: string
  options: { value: string; label: string }[]
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

  function toggle(v: string) {
    const next = new Set(selected)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    onChange(next)
  }

  const allSelected = selected.size === options.length
  const summary = allSelected ? 'Todos' : selected.size === 0 ? 'Ninguno' : `${selected.size} de ${options.length}`

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`px-3 py-2 border rounded-xl text-sm flex items-center gap-2 bg-white transition-all ${open ? 'border-[#1B9BF0] ring-2 ring-[#1B9BF0]' : 'border-gray-200'}`}>
        <span className="text-gray-500">{label}:</span>
        <span className={allSelected ? 'text-gray-400' : 'text-gray-900 font-medium'}>{summary}</span>
        <ChevronDown size={13} className="text-gray-400"/>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="max-h-64 overflow-y-auto py-1">
            {options.map(o => (
              <label key={o.value} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={selected.has(o.value)} onChange={() => toggle(o.value)} className="rounded accent-[#1B9BF0]"/>
                <span className="text-gray-700 truncate">{o.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

type SortKey = 'fecha_emision' | 'numero' | 'cuit' | 'razon_social' | 'cliente' | 'monto' | 'estado'

export default function SubdiarioFacturasClient({
  title, subtitle, facturas, clientes, meses, montoKey, montoLabel, showEstado, exportFilename,
}: {
  title: string
  subtitle: string
  facturas: SubdiarioFactura[]
  clientes: string[]
  meses: string[]
  montoKey: 'importe' | 'importe_neto' | 'importe_iva'
  montoLabel: string
  showEstado: boolean
  exportFilename: string
}) {
  const [checkedClientes, setCheckedClientes] = useState<Set<string>>(() => new Set(clientes))
  const [checkedMeses, setCheckedMeses] = useState<Set<string>>(() => new Set(meses))
  const [checkedEstados, setCheckedEstados] = useState<Set<string>>(() => new Set(ESTADOS))
  const [colFilters, setColFilters] = useState({ numero: '', cuit: '', razon_social: '', cliente: '' })
  const [sortKey, setSortKey] = useState<SortKey>('fecha_emision')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function setColFilter(k: keyof typeof colFilters, v: string) {
    setColFilters(f => ({ ...f, [k]: v }))
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronUp size={11} className="opacity-20"/>
    return sortDir === 'asc' ? <ChevronUp size={11}/> : <ChevronDown size={11}/>
  }

  const filtered = useMemo(() => facturas.filter(f => {
    if (!checkedClientes.has(f.cliente)) return false
    if (!checkedMeses.has(f.mes_servicio ?? '')) return false
    if (showEstado && !checkedEstados.has(f.estado)) return false
    if (colFilters.numero && !f.numero.toLowerCase().includes(colFilters.numero.toLowerCase())) return false
    if (colFilters.cuit && !(f.cuit ?? '').toLowerCase().includes(colFilters.cuit.toLowerCase())) return false
    if (colFilters.razon_social && !(f.razon_social ?? '').toLowerCase().includes(colFilters.razon_social.toLowerCase())) return false
    if (colFilters.cliente && !f.cliente.toLowerCase().includes(colFilters.cliente.toLowerCase())) return false
    return true
  }), [facturas, checkedClientes, checkedMeses, checkedEstados, colFilters, showEstado])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let va: any, vb: any
    if (sortKey === 'monto') { va = a[montoKey] ?? 0; vb = b[montoKey] ?? 0 }
    else { va = (a as any)[sortKey] ?? ''; vb = (b as any)[sortKey] ?? '' }
    const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))
    return sortDir === 'asc' ? cmp : -cmp
  }), [filtered, sortKey, sortDir, montoKey])

  const hasFilters = checkedClientes.size !== clientes.length || checkedMeses.size !== meses.length
    || (showEstado && checkedEstados.size !== ESTADOS.length)
    || Object.values(colFilters).some(v => v)

  function resetFiltros() {
    setCheckedClientes(new Set(clientes))
    setCheckedMeses(new Set(meses))
    setCheckedEstados(new Set(ESTADOS))
    setColFilters({ numero: '', cuit: '', razon_social: '', cliente: '' })
  }

  const total = sorted.reduce((s, f) => s + (Number(f[montoKey]) || 0), 0)

  const exportData = sorted.map(f => ({
    'Fecha factura': formatDateAR(f.fecha_emision),
    'Número': f.numero,
    'CUIT': f.cuit,
    'Razón social': f.razon_social,
    'Nombre del cliente': f.cliente,
    [montoLabel]: Number(f[montoKey] ?? 0),
    ...(showEstado ? { Estado: estadoLabel[f.estado] ?? f.estado } : {}),
  }))

  const cols: { key: SortKey; label: string }[] = [
    { key: 'fecha_emision', label: 'Fecha factura' },
    { key: 'numero',        label: 'Número' },
    { key: 'cuit',          label: 'CUIT' },
    { key: 'razon_social',  label: 'Razón social' },
    { key: 'cliente',       label: 'Nombre del cliente' },
    { key: 'monto',         label: montoLabel },
    ...(showEstado ? [{ key: 'estado' as SortKey, label: 'Estado' }] : []),
  ]

  return (
    <div className="p-6 w-full">
      <Link href="/contabilidad" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Contabilidad
      </Link>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        <ExportExcelButton data={exportData} filename={exportFilename}/>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex flex-wrap gap-3 items-center">
        <CheckDropdown label="Clientes" options={clientes.map(c => ({ value: c, label: c }))} selected={checkedClientes} onChange={setCheckedClientes}/>
        <CheckDropdown label="Meses" options={meses.map(m => ({ value: m, label: formatMes(m) }))} selected={checkedMeses} onChange={setCheckedMeses}/>
        {showEstado && (
          <CheckDropdown label="Estados" options={ESTADOS.map(e => ({ value: e, label: estadoLabel[e] }))} selected={checkedEstados} onChange={setCheckedEstados}/>
        )}
        {hasFilters && (
          <button onClick={resetFiltros} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5">
            <X size={12}/> Restablecer
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{sorted.length} factura{sorted.length !== 1 ? 's' : ''} · Total {montoLabel}: {total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</span>
      </div>

      {!sorted.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          <FileText size={32} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">Sin facturas SAS que coincidan</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                {cols.map(({ key, label }) => (
                  <th key={key} onClick={() => toggleSort(key)}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap cursor-pointer hover:text-gray-600 select-none">
                    <div className="flex items-center gap-1">{label}<SortIcon k={key}/></div>
                  </th>
                ))}
                <th className="px-4 py-3"/>
              </tr>
              <tr className="border-b border-gray-50 bg-gray-50">
                <th className="px-4 py-2"/>
                <th className="px-2 py-2">
                  <input value={colFilters.numero} onChange={e => setColFilter('numero', e.target.value)} placeholder="Filtrar..."
                    className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#1B9BF0]"/>
                </th>
                <th className="px-2 py-2">
                  <input value={colFilters.cuit} onChange={e => setColFilter('cuit', e.target.value)} placeholder="Filtrar..."
                    className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#1B9BF0]"/>
                </th>
                <th className="px-2 py-2">
                  <input value={colFilters.razon_social} onChange={e => setColFilter('razon_social', e.target.value)} placeholder="Filtrar..."
                    className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#1B9BF0]"/>
                </th>
                <th className="px-2 py-2">
                  <input value={colFilters.cliente} onChange={e => setColFilter('cliente', e.target.value)} placeholder="Filtrar..."
                    className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#1B9BF0]"/>
                </th>
                <th className="px-2 py-2"/>
                {showEstado && <th className="px-2 py-2"/>}
                <th className="px-2 py-2"/>
              </tr>
            </thead>
            <tbody>
              {sorted.map(f => (
                <tr key={f.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDateAR(f.fecha_emision)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{f.numero}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{f.cuit || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{f.razon_social || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{f.cliente}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                    {(Number(f[montoKey]) || 0).toLocaleString('es-AR', { style: 'currency', currency: f.currency === 'USD' ? 'USD' : 'ARS' })}
                  </td>
                  {showEstado && (
                    <td className="px-4 py-3">
                      <span className={'text-xs px-2 py-0.5 rounded-full whitespace-nowrap ' + estadoColors[f.estado]}>{estadoLabel[f.estado] ?? f.estado}</span>
                    </td>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/facturas-clientes/${f.id}/editar`}
                      className="inline-flex p-1.5 rounded-lg text-gray-300 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
                      <Pencil size={13}/>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
