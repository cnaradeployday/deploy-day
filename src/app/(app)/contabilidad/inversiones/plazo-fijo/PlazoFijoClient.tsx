'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Pencil, Trash2, PiggyBank, X, ChevronUp, ChevronDown } from 'lucide-react'
import ExportExcelButton from '@/components/shared/ExportExcelButton'
import MultiSelectFilter from '@/components/shared/MultiSelectFilter'
import { formatDateAR, todayISO } from '@/lib/utils/date'

type Estado = 'VIGENTE' | 'RENOVADO' | 'CANCELADO'
type PlazoFijo = {
  id: string
  entidad: string
  fecha_inicio: string
  fecha_vencimiento: string
  monto: number
  tna: number
  monto_vencimiento: number | null
  estado: Estado
  notas: string | null
}
type SortKey = 'entidad' | 'fecha_inicio' | 'fecha_vencimiento' | 'monto' | 'tna' | 'monto_vencimiento' | 'estado'

const ESTADOS: { value: Estado; label: string }[] = [
  { value: 'VIGENTE', label: 'Vigente' },
  { value: 'RENOVADO', label: 'Renovado' },
  { value: 'CANCELADO', label: 'Cancelado' },
]
const estadoColors: Record<Estado, string> = {
  VIGENTE: 'bg-green-50 text-green-600',
  RENOVADO: 'bg-sky-50 text-sky-600',
  CANCELADO: 'bg-gray-100 text-gray-500',
}

const fmtMoney = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
const filterInputClass = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]'

function calcularMontoVencimiento(monto: string, tna: string, fechaInicio: string, fechaVencimiento: string) {
  const m = parseFloat(monto), t = parseFloat(tna)
  if (isNaN(m) || isNaN(t) || !fechaInicio || !fechaVencimiento) return ''
  const dias = (new Date(fechaVencimiento + 'T00:00:00').getTime() - new Date(fechaInicio + 'T00:00:00').getTime()) / 86400000
  if (dias <= 0) return ''
  return (m * (1 + (t / 100) * (dias / 365))).toFixed(2)
}

export default function PlazoFijoClient({ plazos }: { plazos: PlazoFijo[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [montoVtoTouched, setMontoVtoTouched] = useState(false)
  const [form, setForm] = useState({
    entidad: '', fecha_inicio: todayISO(), fecha_vencimiento: '',
    monto: '', tna: '', monto_vencimiento: '', estado: 'VIGENTE' as Estado, notas: '',
  })

  function openNew() {
    setEditingId(null)
    setMontoVtoTouched(false)
    setForm({ entidad: '', fecha_inicio: todayISO(), fecha_vencimiento: '', monto: '', tna: '', monto_vencimiento: '', estado: 'VIGENTE', notas: '' })
    setShowForm(true)
  }

  function openEdit(p: PlazoFijo) {
    setEditingId(p.id)
    setMontoVtoTouched(true)
    setForm({
      entidad: p.entidad, fecha_inicio: p.fecha_inicio, fecha_vencimiento: p.fecha_vencimiento,
      monto: String(p.monto), tna: String(p.tna),
      monto_vencimiento: p.monto_vencimiento != null ? String(p.monto_vencimiento) : '',
      estado: p.estado, notas: p.notas ?? '',
    })
    setShowForm(true)
  }

  function updateCampo(patch: Partial<typeof form>) {
    setForm(f => {
      const next = { ...f, ...patch }
      if (!montoVtoTouched) {
        const calc = calcularMontoVencimiento(next.monto, next.tna, next.fecha_inicio, next.fecha_vencimiento)
        if (calc) next.monto_vencimiento = calc
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const sb = createClient()
    const payload = {
      entidad: form.entidad,
      fecha_inicio: form.fecha_inicio,
      fecha_vencimiento: form.fecha_vencimiento,
      monto: parseFloat(form.monto) || 0,
      tna: parseFloat(form.tna) || 0,
      monto_vencimiento: form.monto_vencimiento ? parseFloat(form.monto_vencimiento) : null,
      estado: form.estado,
      notas: form.notas || null,
    }
    const { error } = editingId
      ? await sb.from('inversiones_plazo_fijo').update(payload).eq('id', editingId)
      : await sb.from('inversiones_plazo_fijo').insert({ ...payload, created_by: (await sb.auth.getUser()).data.user?.id })
    setLoading(false)
    if (error) { alert('Error: ' + error.message); return }
    setShowForm(false)
    setEditingId(null)
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este plazo fijo?')) return
    setDeletingId(id)
    const { error } = await createClient().from('inversiones_plazo_fijo').delete().eq('id', id)
    setDeletingId(null)
    if (error) { alert('Error: ' + error.message); return }
    router.refresh()
  }

  // Filtros
  const [fFechaDesde, setFFechaDesde] = useState('')
  const [fFechaHasta, setFFechaHasta] = useState('')
  const [fEntidades, setFEntidades] = useState<string[]>([])
  const [fEstados, setFEstados] = useState<string[]>([])

  function clearFilters() {
    setFFechaDesde(''); setFFechaHasta(''); setFEntidades([]); setFEstados([])
  }
  const hasFilters = !!(fFechaDesde || fFechaHasta || fEntidades.length || fEstados.length)

  const entidadOptions = useMemo(() => {
    const uniq = [...new Set(plazos.map(p => p.entidad))].sort((a, b) => a.localeCompare(b))
    return uniq.map(e => ({ value: e, label: e }))
  }, [plazos])

  const filtered = useMemo(() => {
    return plazos.filter(p => {
      if (fFechaDesde && p.fecha_inicio < fFechaDesde) return false
      if (fFechaHasta && p.fecha_inicio > fFechaHasta) return false
      if (fEntidades.length && !fEntidades.includes(p.entidad)) return false
      if (fEstados.length && !fEstados.includes(p.estado)) return false
      return true
    })
  }, [plazos, fFechaDesde, fFechaHasta, fEntidades, fEstados])

  const [sortKey, setSortKey] = useState<SortKey>('fecha_inicio')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }
  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronUp size={11} className="opacity-20"/>
    return sortDir === 'asc' ? <ChevronUp size={11}/> : <ChevronDown size={11}/>
  }
  const NUMERIC_KEYS: SortKey[] = ['monto', 'tna', 'monto_vencimiento']
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const isNum = NUMERIC_KEYS.includes(sortKey)
    const va = a[sortKey] ?? (isNum ? 0 : '')
    const vb = b[sortKey] ?? (isNum ? 0 : '')
    const cmp = isNum ? (va as number) - (vb as number) : String(va).localeCompare(String(vb))
    return sortDir === 'asc' ? cmp : -cmp
  }), [filtered, sortKey, sortDir])

  const totalColocado = filtered.filter(p => p.estado !== 'CANCELADO').reduce((s, p) => s + Number(p.monto), 0)
  const totalAlVencimiento = filtered.filter(p => p.estado !== 'CANCELADO').reduce((s, p) => s + Number(p.monto_vencimiento ?? p.monto), 0)

  const exportData = useMemo(() => filtered.map(p => ({
    Entidad: p.entidad,
    'Fecha inicio': formatDateAR(p.fecha_inicio),
    'Fecha vencimiento': formatDateAR(p.fecha_vencimiento),
    Monto: Number(p.monto),
    'TNA %': Number(p.tna),
    'Monto al vencimiento': p.monto_vencimiento != null ? Number(p.monto_vencimiento) : '',
    Estado: ESTADOS.find(e => e.value === p.estado)?.label ?? p.estado,
    Notas: p.notas ?? '',
  })), [filtered])

  return (
    <div className="p-6 w-full">
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-gray-900">{editingId ? 'Editar plazo fijo' : 'Agregar plazo fijo'}</p>
              <button onClick={() => { setShowForm(false); setEditingId(null) }} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1.5">Entidad</label>
                <input type="text" value={form.entidad} onChange={e => updateCampo({ entidad: e.target.value })} required
                  placeholder="Banco Galicia" className={filterInputClass}/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Fecha de inicio</label>
                <input type="date" value={form.fecha_inicio} onChange={e => updateCampo({ fecha_inicio: e.target.value })} required
                  className={filterInputClass}/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Fecha de vencimiento</label>
                <input type="date" value={form.fecha_vencimiento} onChange={e => updateCampo({ fecha_vencimiento: e.target.value })} required
                  className={filterInputClass}/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Monto colocado</label>
                <input type="number" step="0.01" value={form.monto} onChange={e => updateCampo({ monto: e.target.value })} required
                  className={filterInputClass}/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">TNA %</label>
                <input type="number" step="0.01" value={form.tna} onChange={e => updateCampo({ tna: e.target.value })} required
                  className={filterInputClass}/>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1.5">Monto al vencimiento</label>
                <input type="number" step="0.01" value={form.monto_vencimiento}
                  onChange={e => { setMontoVtoTouched(true); setForm(f => ({ ...f, monto_vencimiento: e.target.value })) }}
                  className={filterInputClass}/>
                <p className="text-[11px] text-gray-400 mt-1">Se calcula automáticamente (interés simple), pero podés ajustarlo.</p>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1.5">Estado</label>
                <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value as Estado }))}
                  className={filterInputClass + ' bg-white'}>
                  {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1.5">Notas</label>
                <input type="text" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                  className={filterInputClass}/>
              </div>
              <div className="col-span-2 flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null) }}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
                  {loading ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Link href="/contabilidad/inversiones" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Inversiones
      </Link>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <PiggyBank size={18} className="text-[#1B9BF0]"/> Plazo fijo
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Colocaciones a plazo fijo</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportExcelButton data={exportData} filename="plazo_fijo"/>
          <button onClick={openNew}
            className="flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
            <Plus size={15}/> Agregar plazo fijo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">Total colocado (vigente/renovado)</p>
          <p className="text-sm font-semibold text-gray-900">{fmtMoney(totalColocado)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">Total estimado al vencimiento</p>
          <p className="text-sm font-semibold text-gray-900">{fmtMoney(totalAlVencimiento)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Fecha desde</label>
            <input type="date" value={fFechaDesde} onChange={e => setFFechaDesde(e.target.value)} className={filterInputClass}/>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Fecha hasta</label>
            <input type="date" value={fFechaHasta} onChange={e => setFFechaHasta(e.target.value)} className={filterInputClass}/>
          </div>
          <MultiSelectFilter label="Entidad" options={entidadOptions} selected={fEntidades} onChange={setFEntidades}/>
          <MultiSelectFilter label="Estado" options={ESTADOS.map(e => ({ value: e.value, label: e.label }))} selected={fEstados} onChange={setFEstados}/>
        </div>
        <div className="flex items-center justify-between">
          {hasFilters ? (
            <button onClick={clearFilters} className="text-xs text-[#1B9BF0] hover:underline">Deseleccionar todos</button>
          ) : <span/>}
          <span className="text-xs text-gray-400">{filtered.length} plazo{filtered.length !== 1 ? 's' : ''} fijo{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {!filtered.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          <PiggyBank size={32} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">{plazos.length ? 'Ningún plazo fijo coincide con los filtros' : 'Sin plazos fijos cargados'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                {([
                  ['entidad', 'Entidad', 'left'], ['fecha_inicio', 'Fecha inicio', 'left'], ['fecha_vencimiento', 'Fecha vencimiento', 'left'],
                  ['monto', 'Monto', 'right'], ['tna', 'TNA %', 'right'], ['monto_vencimiento', 'Monto al vto.', 'right'], ['estado', 'Estado', 'left'],
                ] as [SortKey, string, 'left' | 'right'][]).map(([key, label, align]) => (
                  <th key={key} onClick={() => toggleSort(key)}
                    className={`px-4 py-3 text-${align} text-xs font-medium text-gray-400 whitespace-nowrap cursor-pointer hover:text-gray-600 select-none`}>
                    <div className={'flex items-center gap-1' + (align === 'right' ? ' justify-end' : '')}>{label}<SortIcon k={key}/></div>
                  </th>
                ))}
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{p.entidad}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDateAR(p.fecha_inicio)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDateAR(p.fecha_vencimiento)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">{fmtMoney(Number(p.monto))}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">{Number(p.tna).toFixed(2)}%</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right whitespace-nowrap">
                    {p.monto_vencimiento != null ? fmtMoney(Number(p.monto_vencimiento)) : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={'text-xs px-2 py-0.5 rounded-full ' + estadoColors[p.estado]}>
                      {ESTADOS.find(e => e.value === p.estado)?.label ?? p.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button onClick={() => openEdit(p)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
                      <Pencil size={13}/>
                    </button>
                    <button onClick={() => handleDelete(p.id)} disabled={deletingId === p.id}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40">
                      <Trash2 size={13}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold text-sm text-gray-900">
                <td className="px-4 py-3" colSpan={3}>Total</td>
                <td className="px-4 py-3 text-right">{fmtMoney(filtered.reduce((s, p) => s + Number(p.monto), 0))}</td>
                <td className="px-4 py-3"/>
                <td className="px-4 py-3 text-right">{fmtMoney(filtered.reduce((s, p) => s + Number(p.monto_vencimiento ?? 0), 0))}</td>
                <td className="px-4 py-3" colSpan={2}/>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
