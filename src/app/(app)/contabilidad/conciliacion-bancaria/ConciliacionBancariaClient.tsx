'use client'
import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Pencil, Trash2, Landmark, X, ChevronUp, ChevronDown, Sparkles, Paperclip } from 'lucide-react'
import ExportExcelButton from '@/components/shared/ExportExcelButton'
import MultiSelectFilter from '@/components/shared/MultiSelectFilter'
import DocumentosImportadosButton, { DocumentoImportado } from '@/components/contabilidad/DocumentosImportadosButton'
import { registrarDocumentoIA } from '@/lib/supabase/registrarDocumentoIA'
import { formatDateAR, todayISO } from '@/lib/utils/date'

type Clasificacion = { id: string; descripcion: string; clasificacion: string }
type Movimiento = {
  id: string
  fecha: string
  descripcion: string
  credito_debito: number
  saldo: number
  clasificacion: string | null
}
type SortKey = 'fecha' | 'descripcion' | 'credito_debito' | 'saldo' | 'clasificacion'
type ImportRow = {
  fecha: string; descripcion: string; credito_debito: number; saldo: number; clasificacion_id: string; selected: boolean
}

const fmt = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
const filterInputClass = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]'
const cellInputClass = 'w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]'

function normalizar(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export default function ConciliacionBancariaClient({ movimientos, clasificaciones, documentos }: {
  movimientos: Movimiento[]
  clasificaciones: Clasificacion[]
  documentos: DocumentoImportado[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ fecha: todayISO(), clasificacion_id: '', credito_debito: '', saldo: '' })
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function openNew() {
    setEditingId(null)
    setForm({ fecha: todayISO(), clasificacion_id: '', credito_debito: '', saldo: '' })
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

  const [sortKey, setSortKey] = useState<SortKey>('fecha')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }
  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronUp size={11} className="opacity-20"/>
    return sortDir === 'asc' ? <ChevronUp size={11}/> : <ChevronDown size={11}/>
  }
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const va = a[sortKey] ?? ''
    const vb = b[sortKey] ?? ''
    const cmp = typeof va === 'number' ? va - (vb as number) : String(va).localeCompare(String(vb))
    return sortDir === 'asc' ? cmp : -cmp
  }), [filtered, sortKey, sortDir])

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

  // Importación masiva con IA
  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null)
  const [savingImport, setSavingImport] = useState(false)

  function closeImport() {
    setShowImport(false); setImportFile(null); setImportRows(null); setImportError(null)
  }

  async function handleAnalyzeImport() {
    if (!importFile) return
    setImporting(true)
    setImportError(null)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      const res = await fetch('/api/ai/extraer-extracto-bancario', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al procesar el documento')
      const rows: ImportRow[] = (data.movimientos ?? []).map((m: any) => {
        const descNorm = normalizar(m.descripcion || '')
        const match = clasificaciones.find(c => normalizar(c.descripcion) === descNorm)
          ?? clasificaciones.find(c => normalizar(c.descripcion).includes(descNorm) || descNorm.includes(normalizar(c.descripcion)))
        return {
          fecha: m.fecha || todayISO(),
          descripcion: m.descripcion || '',
          credito_debito: m.credito_debito || 0,
          saldo: m.saldo || 0,
          clasificacion_id: match?.id ?? '',
          selected: true,
        }
      })
      setImportRows(rows)
    } catch (e: any) {
      setImportError(e.message ?? 'Error al procesar el documento')
    } finally {
      setImporting(false)
    }
  }

  function updateImportRow(idx: number, patch: Partial<ImportRow>) {
    setImportRows(rows => rows ? rows.map((r, i) => i === idx ? { ...r, ...patch } : r) : rows)
  }

  async function handleConfirmImport() {
    if (!importRows) return
    const rows = importRows.filter(r => r.selected)
    if (!rows.length) return
    setSavingImport(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    const { error } = await sb.from('conciliacion_bancaria').insert(rows.map(r => {
      const clas = clasificaciones.find(c => c.id === r.clasificacion_id)
      return {
        fecha: r.fecha,
        descripcion: r.descripcion,
        clasificacion_id: r.clasificacion_id || null,
        clasificacion: clas?.clasificacion ?? null,
        credito_debito: r.credito_debito,
        saldo: r.saldo,
        created_by: user?.id,
      }
    }))
    if (error) { setSavingImport(false); alert('Error: ' + error.message); return }
    if (importFile) await registrarDocumentoIA(sb, { seccion: 'conciliacion_bancaria', file: importFile, cantidadRegistros: rows.length, userId: user?.id })
    setSavingImport(false)
    closeImport()
    router.refresh()
  }

  const ultimoSaldo = movimientos.length ? movimientos[movimientos.length - 1].saldo : 0

  const exportData = useMemo(() => filtered.map(m => ({
    Fecha: formatDateAR(m.fecha),
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

      {showImport && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-gray-900 flex items-center gap-1.5"><Sparkles size={15} className="text-[#1B9BF0]"/> Importar extracto con IA</p>
              <button onClick={closeImport} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>

            {!importRows ? (
              <>
                <p className="text-sm text-gray-500 mb-3">Subí el PDF del extracto bancario y extraemos todos los movimientos automáticamente.</p>
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={() => importFileRef.current?.click()}
                    className="flex-1 min-w-0 flex items-center gap-2 px-4 py-2.5 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:bg-gray-50">
                    <Paperclip size={14} className="shrink-0"/> <span className="truncate">{importFile ? importFile.name : 'Seleccionar PDF...'}</span>
                  </button>
                  <input ref={importFileRef} type="file" accept="application/pdf" className="hidden"
                    onChange={e => { setImportFile(e.target.files?.[0] ?? null); setImportError(null) }}/>
                  <button type="button" onClick={handleAnalyzeImport} disabled={!importFile || importing}
                    className="shrink-0 flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
                    <Sparkles size={14}/> {importing ? 'Analizando...' : 'Analizar'}
                  </button>
                </div>
                {importError && <p className="text-xs text-red-500 mt-2">{importError}</p>}
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-3">
                  Encontramos {importRows.length} movimiento{importRows.length !== 1 ? 's' : ''}. Revisá, ajustá la clasificación y desmarcá lo que no quieras cargar.
                </p>
                <div className="border border-gray-100 rounded-xl overflow-x-auto mb-4">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-50 bg-gray-50">
                        <th className="px-2 py-2"/>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-400">Fecha</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-400">Descripción</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-400">Crédito / Débito</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-400">Saldo</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-400">Clasificación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.map((r, i) => (
                        <tr key={i} className={'border-b border-gray-50 last:border-0 ' + (r.selected ? '' : 'opacity-40')}>
                          <td className="px-2 py-1.5">
                            <input type="checkbox" checked={r.selected} onChange={e => updateImportRow(i, { selected: e.target.checked })}
                              className="rounded border-gray-300 text-[#1B9BF0] focus:ring-[#1B9BF0]"/>
                          </td>
                          <td className="px-2 py-1.5"><input type="date" value={r.fecha} onChange={e => updateImportRow(i, { fecha: e.target.value })} className={cellInputClass}/></td>
                          <td className="px-2 py-1.5 min-w-[180px]"><input type="text" value={r.descripcion} onChange={e => updateImportRow(i, { descripcion: e.target.value })} className={cellInputClass}/></td>
                          <td className="px-2 py-1.5 w-28"><input type="number" step="0.01" value={r.credito_debito} onChange={e => updateImportRow(i, { credito_debito: parseFloat(e.target.value) || 0 })} className={cellInputClass + ' text-right'}/></td>
                          <td className="px-2 py-1.5 w-28"><input type="number" step="0.01" value={r.saldo} onChange={e => updateImportRow(i, { saldo: parseFloat(e.target.value) || 0 })} className={cellInputClass + ' text-right'}/></td>
                          <td className="px-2 py-1.5 min-w-[160px]">
                            <select value={r.clasificacion_id} onChange={e => updateImportRow(i, { clasificacion_id: e.target.value })} className={cellInputClass + ' bg-white'}>
                              <option value="">Sin clasificar</option>
                              {clasificaciones.map(c => <option key={c.id} value={c.id}>{c.descripcion}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={closeImport} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                  <button type="button" onClick={handleConfirmImport} disabled={savingImport || !importRows.some(r => r.selected)}
                    className="flex-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
                    {savingImport ? 'Importando...' : `Importar ${importRows.filter(r => r.selected).length} movimiento${importRows.filter(r => r.selected).length !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </>
            )}
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
          <DocumentosImportadosButton documentos={documentos}/>
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-2 border border-[#1B9BF0] text-[#1B9BF0] hover:bg-[#E8F4FE] px-4 py-2 rounded-xl text-sm font-semibold transition-all">
            <Sparkles size={15}/> Importar con IA
          </button>
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
                {([
                  ['fecha', 'Fecha'], ['descripcion', 'Descripción'], ['credito_debito', 'Crédito / Débito'],
                  ['saldo', 'Saldo'], ['clasificacion', 'Clasificación'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th key={key} onClick={() => toggleSort(key)}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap cursor-pointer hover:text-gray-600 select-none">
                    <div className="flex items-center gap-1">{label}<SortIcon k={key}/></div>
                  </th>
                ))}
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody>
              {sorted.map(m => (
                <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDateAR(m.fecha)}</td>
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
