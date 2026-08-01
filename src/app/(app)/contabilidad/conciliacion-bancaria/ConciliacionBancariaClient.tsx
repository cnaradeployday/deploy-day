'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Pencil, Trash2, Landmark, X } from 'lucide-react'
import ExportExcelButton from '@/components/shared/ExportExcelButton'
import MultiSelectFilter from '@/components/shared/MultiSelectFilter'

type Clasificacion = { id: string; descripcion: string; clasificacion: string }
type Movimiento = {
  id: string
  fecha: string
  descripcion: string
  credito_debito: number
  saldo: number
  clasificacion: string | null
}

const fmt = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
const filterInputClass = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]'

export default function ConciliacionBancariaClient({ movimientos, clasificaciones }: {
  movimientos: Movimiento[]
  clasificaciones: Clasificacion[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ fecha: new Date().toISOString().split('T')[0], clasificacion_id: '', credito_debito: '', saldo: '' })
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function openNew() {
    setEditingId(null)
    setForm({ fecha: new Date().toISOString().split('T')[0], clasificacion_id: '', credito_debito: '', saldo: '' })
    setShowForm(true)
  }

  function openEdit(m: Movimiento) {
    setEditingId(m.id)
    setForm({
      fecha: m.fecha,
      clasificacion_id: clasificaciones.find(c => c.descripcion === m.descripcion)?.id ?? '',
      credito_debito: String(m.credito_debito),
      saldo: String(m.saldo),
    })
    setShowForm(true)
  }

  const [fFechaDesde, setFFechaDesde] = useState('')
  const [fFechaHasta, setFFechaHasta] = useState('')
  const [fDescripciones, setFDescripciones] = useState<string[]>([])
  const [fClasificaciones, setFClasificaciones] = useState<string[]>([])
  const [fTipo, setFTipo] = useState<string[]>([])
  const [fSaldoMin, setFSaldoMin] = useState('')
  const [fSaldoMax, setFSaldoMax] = useState('')

  function clearFilters() {
    setFFechaDesde(''); setFFechaHasta(''); setFDescripciones([]); setFClasificaciones([])
    setFTipo([]); setFSaldoMin(''); setFSaldoMax('')
  }
  const hasFilters = !!(fFechaDesde || fFechaHasta || fDescripciones.length || fClasificaciones.length || fTipo.length || fSaldoMin || fSaldoMax)

  const descripcionOptions = useMemo(() => {
    const uniq = [...new Set(movimientos.map(m => m.descripcion))].sort((a, b) => a.localeCompare(b))
    return uniq.map(d => ({ value: d, label: d }))
  }, [movimientos])

  const clasificacionOptions = useMemo(() => {
    const uniq = [...new Set(movimientos.map(m => m.clasificacion).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b))
    return uniq.map(c => ({ value: c, label: c }))
  }, [movimientos])

  const filtered = useMemo(() => {
    return movimientos.filter(m => {
      if (fFechaDesde && m.fecha < fFechaDesde) return false
      if (fFechaHasta && m.fecha > fFechaHasta) return false
      if (fDescripciones.length && !fDescripciones.includes(m.descripcion)) return false
      if (fClasificaciones.length && !fClasificaciones.includes(m.clasificacion ?? '')) return false
      if (fTipo.length) {
        const tipo = m.credito_debito < 0 ? 'debito' : 'credito'
        if (!fTipo.includes(tipo)) return false
      }
      if (fSaldoMin && Number(m.saldo) < parseFloat(fSaldoMin)) return false
      if (fSaldoMax && Number(m.saldo) > parseFloat(fSaldoMax)) return false
      return true
    })
  }, [movimientos, fFechaDesde, fFechaHasta, fDescripciones, fClasificaciones, fTipo, fSaldoMin, fSaldoMax])

  const selected = clasificaciones.find(c => c.id === form.clasificacion_id) ?? null

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) { alert('Elegí una descripción'); return }
    setLoading(true)
    const sb = createClient()
    const payload = {
      fecha: form.fecha,
      descripcion: selected.descripcion,
      clasificacion_id: selected.id,
      clasificacion: selected.clasificacion,
      credito_debito: parseFloat(form.credito_debito) || 0,
      saldo: parseFloat(form.saldo) || 0,
    }
    const { error } = editingId
      ? await sb.from('conciliacion_bancaria').update(payload).eq('id', editingId)
      : await sb.from('conciliacion_bancaria').insert({ ...payload, created_by: (await sb.auth.getUser()).data.user?.id })
    setLoading(false)
    if (error) { alert('Error: ' + error.message); return }
    setForm(f => ({ ...f, clasificacion_id: '', credito_debito: '', saldo: '' }))
    setShowForm(false)
    setEditingId(null)
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este movimiento?')) return
    setDeletingId(id)
    const { error } = await createClient().from('conciliacion_bancaria').delete().eq('id', id)
    setDeletingId(null)
    if (error) { alert('Error: ' + error.message); return }
    router.refresh()
  }

  const ultimoSaldo = movimientos.length ? movimientos[movimientos.length - 1].saldo : 0

  const exportData = useMemo(() => filtered.map(m => ({
    Fecha: new Date(m.fecha).toLocaleDateString('es-AR'),
    Descripcion: m.descripcion,
    'Credito / Debito': m.credito_debito,
    Saldo: m.saldo,
    Clasificacion: m.clasificacion ?? '',
  })), [filtered])

  return (
    <div className="p-6 w-full">
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-gray-900">{editingId ? 'Editar movimiento' : 'Agregar movimiento'}</p>
              <button onClick={() => { setShowForm(false); setEditingId(null) }} className="text-gray-400 hover:text-gray-600">
                <X size={16}/>
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Fecha</label>
                <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} required
                  className={filterInputClass}/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Descripción</label>
                <select value={form.clasificacion_id} onChange={e => setForm(f => ({ ...f, clasificacion_id: e.target.value }))} required
                  className={filterInputClass + ' bg-white'}>
                  <option value="">Seleccionar...</option>
                  {clasificaciones.map(c => <option key={c.id} value={c.id}>{c.descripcion}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Clasificación</label>
                <input type="text" value={selected?.clasificacion ?? ''} disabled placeholder="—"
                  className="w-full px-3 py-2 border border-gray-100 bg-gray-50 rounded-xl text-sm text-gray-400"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Crédito / Débito</label>
                  <input type="number" step="0.01" value={form.credito_debito} onChange={e => setForm(f => ({ ...f, credito_debito: e.target.value }))} required
                    placeholder="-1000.00" className={filterInputClass}/>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Saldo</label>
                  <input type="number" step="0.01" value={form.saldo} onChange={e => setForm(f => ({ ...f, saldo: e.target.value }))} required
                    className={filterInputClass}/>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
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

      <Link href="/contabilidad" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Contabilidad
      </Link>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Landmark size={18} className="text-[#1B9BF0]"/> Conciliación bancaria
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Saldo actual: <span className="font-semibold text-gray-700">{fmt(ultimoSaldo)}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <ExportExcelButton data={exportData} filename="conciliacion_bancaria"/>
          <button onClick={openNew}
            className="flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
            <Plus size={15}/> Agregar movimiento
          </button>
        </div>
      </div>

      {clasificaciones.length === 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-4 py-2.5 mb-4">
          Todavía no hay clasificaciones cargadas. Creá al menos una en <Link href="/contabilidad/extractos-bancarios" className="underline font-medium">Extractos bancarios</Link> antes de cargar movimientos.
        </p>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Fecha desde</label>
            <input type="date" value={fFechaDesde} onChange={e => setFFechaDesde(e.target.value)} className={filterInputClass}/>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Fecha hasta</label>
            <input type="date" value={fFechaHasta} onChange={e => setFFechaHasta(e.target.value)} className={filterInputClass}/>
          </div>
          <MultiSelectFilter label="Descripción" options={descripcionOptions} selected={fDescripciones} onChange={setFDescripciones}/>
          <MultiSelectFilter label="Clasificación" options={clasificacionOptions} selected={fClasificaciones} onChange={setFClasificaciones}/>
          <MultiSelectFilter label="Crédito / Débito" options={[{ value: 'credito', label: 'Crédito' }, { value: 'debito', label: 'Débito' }]} selected={fTipo} onChange={setFTipo}/>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1.5">Saldo mín.</label>
              <input type="number" step="0.01" value={fSaldoMin} onChange={e => setFSaldoMin(e.target.value)} className={filterInputClass}/>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1.5">Saldo máx.</label>
              <input type="number" step="0.01" value={fSaldoMax} onChange={e => setFSaldoMax(e.target.value)} className={filterInputClass}/>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          {hasFilters ? (
            <button onClick={clearFilters} className="text-xs text-[#1B9BF0] hover:underline">Deseleccionar todos</button>
          ) : <span/>}
          <span className="text-xs text-gray-400">{filtered.length} movimiento{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {!filtered.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          <Landmark size={32} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">{movimientos.length ? 'Ningún movimiento coincide con los filtros' : 'Sin movimientos cargados'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Descripción</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Crédito / Débito</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Saldo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Clasificación</th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(m.fecha).toLocaleDateString('es-AR')}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{m.descripcion}</td>
                  <td className={'px-4 py-3 text-sm font-medium whitespace-nowrap ' + (m.credito_debito < 0 ? 'text-red-500' : 'text-green-600')}>
                    {fmt(m.credito_debito)}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">{fmt(m.saldo)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{m.clasificacion ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button onClick={() => openEdit(m)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
                      <Pencil size={13}/>
                    </button>
                    <button onClick={() => handleDelete(m.id)} disabled={deletingId === m.id}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40">
                      <Trash2 size={13}/>
                    </button>
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
