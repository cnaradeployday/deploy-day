'use client'
import { logActivity } from '@/lib/logActivity'
import { useEffect, useRef, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, FileText, Trash2, ChevronUp, ChevronDown, X, AlertTriangle, Pencil, CheckCircle } from 'lucide-react'
import { formatDateAR, isPastDate, todayISO } from '@/lib/utils/date'

function formatMes(mes: string | null) {
  if (!mes) return '—'
  return new Date(mes + '-15').toLocaleString('es-AR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

function toUSD(importe: number, currency: string, tc: number | null): number {
  if (currency === 'USD') return importe
  if (!tc) return 0
  return importe / tc
}

function getEstadoEfectivo(f: any): string {
  if (f.estado === 'cobrada') return 'cobrada'
  if (f.estado === 'vencida') return 'vencida'
  if (f.fecha_vencimiento && isPastDate(f.fecha_vencimiento)) return 'vencida'
  return 'pendiente'
}

const estadoColors: Record<string, string> = {
  pendiente: 'bg-amber-50 text-amber-600',
  cobrada:   'bg-green-50 text-green-600',
  vencida:   'bg-red-50 text-red-600',
}

type SortKey = 'numero' | 'cliente' | 'mes_servicio' | 'fecha_emision' | 'fecha_vencimiento' | 'importe_usd' | 'estado'

const ESTADOS = ['pendiente', 'cobrada', 'vencida']
const estadoDropdownLabel: Record<string, string> = { pendiente: 'Pendiente', cobrada: 'Cobrada', vencida: 'Vencida' }

function CheckDropdown({
  label, options, selected, onChange, searchable,
}: {
  label: string
  options: { value: string; label: string }[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
  searchable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  function toggle(v: string) {
    const next = new Set(selected)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    onChange(next)
  }

  const allSelected = selected.size === options.length
  const summary = allSelected ? 'Todos' : selected.size === 0 ? 'Ninguno' : `${selected.size} de ${options.length}`

  const filteredOptions = searchable && search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.trim().toLowerCase()))
    : options

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`px-3 py-2 border rounded-xl text-sm flex items-center gap-2 bg-white transition-all ${
          open ? 'border-[#1B9BF0] ring-2 ring-[#1B9BF0]' : 'border-gray-200'
        }`}>
        <span className="text-gray-500">{label}:</span>
        <span className={allSelected ? 'text-gray-400' : 'text-gray-900 font-medium'}>{summary}</span>
        <ChevronDown size={13} className="text-gray-400"/>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {searchable && (
            <div className="px-2 pt-2">
              <input
                type="text"
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"
              />
            </div>
          )}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 mt-1">
            <button type="button" onClick={() => onChange(new Set(options.map(o => o.value)))}
              className="text-xs text-[#1B9BF0] hover:underline">
              Seleccionar todos
            </button>
            <button type="button" onClick={() => onChange(new Set())}
              className="text-xs text-gray-400 hover:underline">
              Deseleccionar todos
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-3 text-sm text-gray-400 text-center">Sin resultados</p>
            ) : filteredOptions.map(o => (
              <label key={o.value} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={selected.has(o.value)} onChange={() => toggle(o.value)}
                  className="rounded accent-[#1B9BF0]"/>
                <span className="text-gray-700 truncate">{o.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function FacturasClientesClient({
  facturas, tipoCambio, clientes, meses
}: {
  facturas: any[]
  tipoCambio: number | null
  clientes: string[]
  meses: string[]
}) {
  const router = useRouter()
  // Todo tildado por default, salvo "Cobrada" que arranca destildada
  const [checkedEstados, setCheckedEstados] = useState<Set<string>>(() => new Set(ESTADOS.filter(e => e !== 'cobrada')))
  const [checkedClientes, setCheckedClientes] = useState<Set<string>>(() => new Set(clientes))
  const [checkedMeses, setCheckedMeses] = useState<Set<string>>(() => new Set(meses))
  const [sortKey, setSortKey] = useState<SortKey>('fecha_vencimiento')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [cobrandoId, setCobrandoId] = useState<string | null>(null)
  const [fechaCobro, setFechaCobro] = useState(todayISO())

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronUp size={11} className="opacity-20"/>
    return sortDir === 'asc' ? <ChevronUp size={11}/> : <ChevronDown size={11}/>
  }

  // Enriquecer con estado efectivo y USD
  const enriched = useMemo(() => facturas.map(f => ({
    ...f,
    estado_efectivo: getEstadoEfectivo(f),
    importe_usd: toUSD(f.importe, f.currency ?? 'ARS', tipoCambio),
  })), [facturas, tipoCambio])

  // Filtrar
  const filtered = useMemo(() => enriched.filter(f => {
    if (!checkedEstados.has(f.estado_efectivo)) return false
    if (!checkedClientes.has((f.client as any)?.name ?? '')) return false
    if (!checkedMeses.has(f.mes_servicio ?? '')) return false
    return true
  }), [enriched, checkedEstados, checkedClientes, checkedMeses])

  const DEFAULT_ESTADOS = ESTADOS.filter(e => e !== 'cobrada')
  const hasFilters = checkedEstados.size !== DEFAULT_ESTADOS.length || !DEFAULT_ESTADOS.every(e => checkedEstados.has(e))
    || checkedClientes.size !== clientes.length || checkedMeses.size !== meses.length
  function resetFiltros() {
    setCheckedEstados(new Set(DEFAULT_ESTADOS))
    setCheckedClientes(new Set(clientes))
    setCheckedMeses(new Set(meses))
  }

  // Ordenar
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let va: any, vb: any
    if (sortKey === 'cliente')        { va = (a.client as any)?.name ?? ''; vb = (b.client as any)?.name ?? '' }
    else if (sortKey === 'importe_usd') { va = a.importe_usd; vb = b.importe_usd }
    else if (sortKey === 'estado')    { va = a.estado_efectivo; vb = b.estado_efectivo }
    else                              { va = a[sortKey] ?? ''; vb = b[sortKey] ?? '' }
    const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))
    return sortDir === 'asc' ? cmp : -cmp
  }), [filtered, sortKey, sortDir])

  // KPIs sobre datos filtrados con estado efectivo
  const pendientes = filtered.filter(f => f.estado_efectivo === 'pendiente')
  const cobradas   = filtered.filter(f => f.estado_efectivo === 'cobrada')
  const vencidas   = filtered.filter(f => f.estado_efectivo === 'vencida')

  const sumUSD = (arr: any[]) => arr.reduce((s, f) => s + f.importe_usd, 0)
  const fmtUSD = (n: number) => 'USD ' + Math.round(n).toLocaleString('es-AR')

  async function marcarCobrada(id: string) {
    setCobrandoId(id)
    await createClient().from('facturas_clientes').update({
      estado: 'cobrada', fecha_cobro: fechaCobro
    }).eq('id', id)
    setCobrandoId(null)
    router.refresh()
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const { error } = await createClient().from('facturas_clientes').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); setDeletingId(null); return }
    logActivity({ action: 'eliminar factura', section: 'facturas', detail: 'Factura eliminada id: ' + id })
    setConfirmId(null)
    setDeletingId(null)
    router.refresh()
  }

  const cols: { key: SortKey; label: string }[] = [
    { key: 'numero',           label: 'Número' },
    { key: 'cliente',          label: 'Cliente' },
    { key: 'mes_servicio',     label: 'Mes servicio' },
    { key: 'fecha_emision',    label: 'Emisión' },
    { key: 'fecha_vencimiento',label: 'Vencimiento' },
    { key: 'importe_usd',      label: tipoCambio ? 'Importe (USD)' : 'Importe' },
    { key: 'estado',           label: 'Estado' },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Modal confirmar eliminación */}
      {confirmId && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-500"/>
              </div>
              <div>
                <p className="font-semibold text-gray-900">¿Eliminar factura?</p>
                <p className="text-sm text-gray-400">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmId(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmId)} disabled={deletingId === confirmId}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                {deletingId === confirmId ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Facturas a clientes</h1>
          {tipoCambio && <p className="text-xs text-gray-400 mt-0.5">TC: ${tipoCambio.toLocaleString('es-AR')} · todo convertido a USD</p>}
        </div>
        <Link href="/facturas-clientes/nueva"
          className="flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
          <Plus size={15}/> Nueva factura
        </Link>
      </div>

      {/* KPIs en USD */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Pendientes',     count: pendientes.length, usd: sumUSD(pendientes), color: 'text-amber-600' },
          { label: 'Total a cobrar', count: pendientes.length + vencidas.length, usd: sumUSD(pendientes) + sumUSD(vencidas), color: 'text-[#1B9BF0]' },
          { label: 'Vencidas',       count: vencidas.length,   usd: sumUSD(vencidas),   color: 'text-red-500' },
        ].map(({ label, count, usd, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 px-4 py-4">
            <p className="text-xs text-gray-400">{label}</p>
            <p className={'text-2xl font-bold ' + color}>{count}</p>
            <p className="text-xs text-gray-400 mt-0.5">{tipoCambio ? fmtUSD(usd) : '—'}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex flex-wrap gap-3 items-center">
        <CheckDropdown label="Estados" options={ESTADOS.map(e => ({ value: e, label: estadoDropdownLabel[e] }))}
          selected={checkedEstados} onChange={setCheckedEstados}/>
        <CheckDropdown label="Clientes" options={clientes.map(c => ({ value: c, label: c }))}
          selected={checkedClientes} onChange={setCheckedClientes} searchable/>
        <CheckDropdown label="Meses" options={meses.map(m => ({ value: m, label: formatMes(m) }))}
          selected={checkedMeses} onChange={setCheckedMeses}/>
        {hasFilters && (
          <button onClick={resetFiltros}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5">
            <X size={12}/> Restablecer
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{sorted.length} factura{sorted.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Tabla */}
      {!sorted.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          <FileText size={32} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">Sin facturas</p>
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Cobro</th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody>
              {sorted.map(f => {
                const est = f.estado_efectivo
                return (
                  <tr key={f.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={'/facturas-clientes/' + f.id}
                        className="text-sm font-medium text-[#1B9BF0] hover:underline whitespace-nowrap">
                        {f.numero}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{(f.client as any)?.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatMes(f.mes_servicio)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {formatDateAR(f.fecha_emision)}
                    </td>
                    <td className={'px-4 py-3 text-xs font-medium whitespace-nowrap ' + (est === 'vencida' ? 'text-red-500' : 'text-gray-500')}>
                      {formatDateAR(f.fecha_vencimiento)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                      {(f.currency === 'USD' ? 'USD ' : '$') + Number(f.importe).toLocaleString('es-AR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={'text-xs px-2 py-0.5 rounded-full whitespace-nowrap ' + estadoColors[est]}>
                        {est}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {f.fecha_cobro ? formatDateAR(f.fecha_cobro) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={'/facturas-clientes/' + f.id + '/editar'}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
                        <Pencil size={13}/>
                      </Link>
                      {est !== 'cobrada' && (
                        <button onClick={() => marcarCobrada(f.id)} disabled={cobrandoId === f.id}
                          title="Marcar cobrada"
                          className="p-1.5 rounded-lg text-gray-300 hover:text-green-600 hover:bg-green-50 transition-all disabled:opacity-40">
                          <CheckCircle size={13}/>
                        </button>
                      )}
                      <button onClick={() => setConfirmId(f.id)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all">
                        <Trash2 size={13}/>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
