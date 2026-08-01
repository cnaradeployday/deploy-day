'use client'
import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Trash2, CreditCard, X, Sparkles, Paperclip } from 'lucide-react'
import ExportExcelButton from '@/components/shared/ExportExcelButton'
import MultiSelectFilter from '@/components/shared/MultiSelectFilter'

type Tipo = { id: string; numero: string; nombre: string }
type Movimiento = {
  id: string
  fecha: string
  proveedor: string
  cuota: string | null
  clasificacion: string | null
  pesos: number | null
  dolares: number | null
  comprobante: string | null
  solapa: string | null
  tipo_gasto: { numero: string; nombre: string } | null
}
type ImportRow = {
  fecha: string; proveedor: string; cuota: string; pesos: number; dolares: number
  comprobante: string; tipo_gasto_id: string; solapa: string; selected: boolean
}

const SOLAPAS = ['Ctas de gastos', 'Proveedores', 'Proveedores - Cuotas', 'IVA', 'IIGG']
const COMPROBANTES = ['Ticket no fiscal', 'Factura A', 'Ticket B', 'Propina']

const fmt = (n: number | null) => n == null ? '' : n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const filterInputClass = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]'
const cellInputClass = 'w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]'

function normalizar(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export default function TarjetaCreditoClient({ movimientos, tipos }: { movimientos: Movimiento[]; tipos: Tipo[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0], proveedor: '', cuota: '',
    tipo_gasto_id: '', pesos: '', dolares: '', comprobante: '', solapa: 'Ctas de gastos',
  })

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
      const res = await fetch('/api/ai/extraer-resumen-tarjeta', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al procesar el documento')
      const rows: ImportRow[] = (data.movimientos ?? []).map((m: any) => ({
        fecha: m.fecha || new Date().toISOString().split('T')[0],
        proveedor: m.proveedor || '',
        cuota: m.cuota || '',
        pesos: m.pesos || 0,
        dolares: m.dolares || 0,
        comprobante: m.comprobante || '',
        tipo_gasto_id: m.clasificacion_sugerida
          ? (tipos.find(t => normalizar(t.nombre) === normalizar(m.clasificacion_sugerida))
              ?? tipos.find(t => normalizar(t.nombre).includes(normalizar(m.clasificacion_sugerida)) || normalizar(m.clasificacion_sugerida).includes(normalizar(t.nombre))))?.id ?? ''
          : '',
        solapa: 'Ctas de gastos',
        selected: true,
      }))
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
    const { error } = await sb.from('tarjeta_credito').insert(rows.map(r => ({
      fecha: r.fecha,
      proveedor: r.proveedor,
      cuota: r.cuota || null,
      tipo_gasto_id: r.tipo_gasto_id || null,
      clasificacion: tipos.find(t => t.id === r.tipo_gasto_id)?.nombre ?? null,
      pesos: r.pesos || null,
      dolares: r.dolares || null,
      comprobante: r.comprobante || null,
      solapa: r.solapa || null,
      created_by: user?.id,
    })))
    setSavingImport(false)
    if (error) { alert('Error: ' + error.message); return }
    closeImport()
    router.refresh()
  }

  const selectedTipo = tipos.find(t => t.id === form.tipo_gasto_id) ?? null

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    const { error } = await sb.from('tarjeta_credito').insert({
      fecha: form.fecha,
      proveedor: form.proveedor,
      cuota: form.cuota || null,
      tipo_gasto_id: form.tipo_gasto_id || null,
      clasificacion: selectedTipo?.nombre ?? null,
      pesos: form.pesos ? parseFloat(form.pesos) : null,
      dolares: form.dolares ? parseFloat(form.dolares) : null,
      comprobante: form.comprobante || null,
      solapa: form.solapa || null,
      created_by: user?.id,
    })
    setLoading(false)
    if (error) { alert('Error: ' + error.message); return }
    setForm(f => ({ ...f, proveedor: '', cuota: '', tipo_gasto_id: '', pesos: '', dolares: '', comprobante: '' }))
    setShowForm(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este movimiento?')) return
    setDeletingId(id)
    const { error } = await createClient().from('tarjeta_credito').delete().eq('id', id)
    setDeletingId(null)
    if (error) { alert('Error: ' + error.message); return }
    router.refresh()
  }

  // Filtros
  const [fFechaDesde, setFFechaDesde] = useState('')
  const [fFechaHasta, setFFechaHasta] = useState('')
  const [fProveedor, setFProveedor] = useState('')
  const [fCuota, setFCuota] = useState('')
  const [fClasificaciones, setFClasificaciones] = useState<string[]>([])
  const [fPesosMin, setFPesosMin] = useState('')
  const [fPesosMax, setFPesosMax] = useState('')
  const [fDolaresMin, setFDolaresMin] = useState('')
  const [fDolaresMax, setFDolaresMax] = useState('')
  const [fComprobantes, setFComprobantes] = useState<string[]>([])
  const [fSolapas, setFSolapas] = useState<string[]>([])

  function clearFilters() {
    setFFechaDesde(''); setFFechaHasta(''); setFProveedor(''); setFCuota('')
    setFClasificaciones([]); setFPesosMin(''); setFPesosMax('')
    setFDolaresMin(''); setFDolaresMax(''); setFComprobantes([]); setFSolapas([])
  }
  const hasFilters = !!(fFechaDesde || fFechaHasta || fProveedor || fCuota || fClasificaciones.length ||
    fPesosMin || fPesosMax || fDolaresMin || fDolaresMax || fComprobantes.length || fSolapas.length)

  const clasificacionOptions = useMemo(() => {
    const uniq = [...new Set(movimientos.map(m => m.clasificacion).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b))
    return uniq.map(c => ({ value: c, label: c }))
  }, [movimientos])

  const comprobanteOptions = useMemo(() => {
    const uniq = [...new Set(movimientos.map(m => m.comprobante).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b))
    return uniq.map(c => ({ value: c, label: c }))
  }, [movimientos])

  const solapaOptions = useMemo(() => {
    const uniq = [...new Set(movimientos.map(m => m.solapa).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b))
    return uniq.map(c => ({ value: c, label: c }))
  }, [movimientos])

  const filtered = useMemo(() => {
    return movimientos.filter(m => {
      if (fFechaDesde && m.fecha < fFechaDesde) return false
      if (fFechaHasta && m.fecha > fFechaHasta) return false
      if (fProveedor.trim() && !m.proveedor.toLowerCase().includes(fProveedor.trim().toLowerCase())) return false
      if (fCuota.trim() && !(m.cuota ?? '').toLowerCase().includes(fCuota.trim().toLowerCase())) return false
      if (fClasificaciones.length && !fClasificaciones.includes(m.clasificacion ?? '')) return false
      if (fPesosMin && Number(m.pesos ?? 0) < parseFloat(fPesosMin)) return false
      if (fPesosMax && Number(m.pesos ?? 0) > parseFloat(fPesosMax)) return false
      if (fDolaresMin && Number(m.dolares ?? 0) < parseFloat(fDolaresMin)) return false
      if (fDolaresMax && Number(m.dolares ?? 0) > parseFloat(fDolaresMax)) return false
      if (fComprobantes.length && !fComprobantes.includes(m.comprobante ?? '')) return false
      if (fSolapas.length && !fSolapas.includes(m.solapa ?? '')) return false
      return true
    })
  }, [movimientos, fFechaDesde, fFechaHasta, fProveedor, fCuota, fClasificaciones, fPesosMin, fPesosMax, fDolaresMin, fDolaresMax, fComprobantes, fSolapas])

  const totalPesos = filtered.reduce((s, m) => s + (Number(m.pesos) || 0), 0)
  const totalDolares = filtered.reduce((s, m) => s + (Number(m.dolares) || 0), 0)

  const exportData = useMemo(() => filtered.map(m => ({
    FECHA: new Date(m.fecha).toLocaleDateString('es-AR'),
    PROVEEDOR: m.proveedor,
    CUOTA: m.cuota ?? '',
    Clasificacion: m.clasificacion ?? '',
    PESOS: m.pesos ?? '',
    DÓLARES: m.dolares ?? '',
    Comprobante: m.comprobante ?? '',
    Solapa: m.solapa ?? '',
  })), [filtered])

  return (
    <div className="p-6 w-full">
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-gray-900">Agregar movimiento</p>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>
            <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Fecha</label>
                <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} required
                  className={filterInputClass}/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Cuota</label>
                <input type="text" value={form.cuota} onChange={e => setForm(f => ({ ...f, cuota: e.target.value }))} placeholder="1/6"
                  className={filterInputClass}/>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1.5">Proveedor</label>
                <input type="text" value={form.proveedor} onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))} required
                  className={filterInputClass}/>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1.5">Clasificación</label>
                <select value={form.tipo_gasto_id} onChange={e => setForm(f => ({ ...f, tipo_gasto_id: e.target.value }))}
                  className={filterInputClass + ' bg-white'}>
                  <option value="">Sin especificar</option>
                  {tipos.map(t => <option key={t.id} value={t.id}>{t.numero} - {t.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Pesos</label>
                <input type="number" step="0.01" value={form.pesos} onChange={e => setForm(f => ({ ...f, pesos: e.target.value }))}
                  className={filterInputClass}/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Dólares</label>
                <input type="number" step="0.01" value={form.dolares} onChange={e => setForm(f => ({ ...f, dolares: e.target.value }))}
                  className={filterInputClass}/>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1.5">Comprobante</label>
                <input type="text" list="comprobantes" value={form.comprobante} onChange={e => setForm(f => ({ ...f, comprobante: e.target.value }))}
                  placeholder="Ticket no fiscal" className={filterInputClass}/>
                <datalist id="comprobantes">
                  {COMPROBANTES.map(c => <option key={c} value={c}/>)}
                </datalist>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1.5">Solapa</label>
                <select value={form.solapa} onChange={e => setForm(f => ({ ...f, solapa: e.target.value }))}
                  className={filterInputClass + ' bg-white'}>
                  {SOLAPAS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2 flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
                  {loading ? 'Guardando...' : 'Guardar'}
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
              <p className="font-semibold text-gray-900 flex items-center gap-1.5"><Sparkles size={15} className="text-[#1B9BF0]"/> Importar resumen con IA</p>
              <button onClick={closeImport} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>

            {!importRows ? (
              <>
                <p className="text-sm text-gray-500 mb-3">Subí el PDF del resumen que te da el banco y extraemos todos los consumos automáticamente.</p>
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={() => importFileRef.current?.click()}
                    className="flex-1 flex items-center gap-2 px-4 py-2.5 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:bg-gray-50">
                    <Paperclip size={14}/> {importFile ? importFile.name : 'Seleccionar PDF...'}
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
                  Encontramos {importRows.length} movimiento{importRows.length !== 1 ? 's' : ''}. Revisá, ajustá clasificación/solapa y desmarcá lo que no quieras cargar.
                </p>
                <div className="border border-gray-100 rounded-xl overflow-x-auto mb-4">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-50 bg-gray-50">
                        <th className="px-2 py-2"/>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-400">Fecha</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-400">Proveedor</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-400">Cuota</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-400">Pesos</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-400">Dólares</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-400">Clasificación</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-400">Solapa</th>
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
                          <td className="px-2 py-1.5 min-w-[140px]"><input type="text" value={r.proveedor} onChange={e => updateImportRow(i, { proveedor: e.target.value })} className={cellInputClass}/></td>
                          <td className="px-2 py-1.5 w-16"><input type="text" value={r.cuota} onChange={e => updateImportRow(i, { cuota: e.target.value })} className={cellInputClass}/></td>
                          <td className="px-2 py-1.5 w-24"><input type="number" step="0.01" value={r.pesos} onChange={e => updateImportRow(i, { pesos: parseFloat(e.target.value) || 0 })} className={cellInputClass + ' text-right'}/></td>
                          <td className="px-2 py-1.5 w-24"><input type="number" step="0.01" value={r.dolares} onChange={e => updateImportRow(i, { dolares: parseFloat(e.target.value) || 0 })} className={cellInputClass + ' text-right'}/></td>
                          <td className="px-2 py-1.5 min-w-[160px]">
                            <select value={r.tipo_gasto_id} onChange={e => updateImportRow(i, { tipo_gasto_id: e.target.value })} className={cellInputClass + ' bg-white'}>
                              <option value="">Sin especificar</option>
                              {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5 min-w-[140px]">
                            <select value={r.solapa} onChange={e => updateImportRow(i, { solapa: e.target.value })} className={cellInputClass + ' bg-white'}>
                              {SOLAPAS.map(s => <option key={s} value={s}>{s}</option>)}
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
            <CreditCard size={18} className="text-[#1B9BF0]"/> Tarjeta de crédito
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Consumos del resumen de tarjeta</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportExcelButton data={exportData} filename="tarjeta_credito"/>
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-2 border border-[#1B9BF0] text-[#1B9BF0] hover:bg-[#E8F4FE] px-4 py-2 rounded-xl text-sm font-semibold transition-all">
            <Sparkles size={15}/> Importar con IA
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
            <Plus size={15}/> Agregar movimiento
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Fecha desde</label>
            <input type="date" value={fFechaDesde} onChange={e => setFFechaDesde(e.target.value)} className={filterInputClass}/>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Fecha hasta</label>
            <input type="date" value={fFechaHasta} onChange={e => setFFechaHasta(e.target.value)} className={filterInputClass}/>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Proveedor</label>
            <input type="text" value={fProveedor} onChange={e => setFProveedor(e.target.value)} className={filterInputClass}/>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Cuota</label>
            <input type="text" value={fCuota} onChange={e => setFCuota(e.target.value)} className={filterInputClass}/>
          </div>
          <MultiSelectFilter label="Clasificación" options={clasificacionOptions} selected={fClasificaciones} onChange={setFClasificaciones}/>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1.5">Pesos mín.</label>
              <input type="number" step="0.01" value={fPesosMin} onChange={e => setFPesosMin(e.target.value)} className={filterInputClass}/>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1.5">Pesos máx.</label>
              <input type="number" step="0.01" value={fPesosMax} onChange={e => setFPesosMax(e.target.value)} className={filterInputClass}/>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1.5">Dólares mín.</label>
              <input type="number" step="0.01" value={fDolaresMin} onChange={e => setFDolaresMin(e.target.value)} className={filterInputClass}/>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1.5">Dólares máx.</label>
              <input type="number" step="0.01" value={fDolaresMax} onChange={e => setFDolaresMax(e.target.value)} className={filterInputClass}/>
            </div>
          </div>
          <MultiSelectFilter label="Comprobante" options={comprobanteOptions} selected={fComprobantes} onChange={setFComprobantes}/>
          <MultiSelectFilter label="Solapa" options={solapaOptions} selected={fSolapas} onChange={setFSolapas}/>
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
          <CreditCard size={32} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">{movimientos.length ? 'Ningún movimiento coincide con los filtros' : 'Sin movimientos cargados'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Proveedor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Cuota</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Clasificación</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 whitespace-nowrap">Pesos</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 whitespace-nowrap">Dólares</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Comprobante</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Solapa</th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(m.fecha).toLocaleDateString('es-AR')}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{m.proveedor}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{m.cuota ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{m.clasificacion ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">{fmt(m.pesos)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">{fmt(m.dolares)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{m.comprobante ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{m.solapa ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(m.id)} disabled={deletingId === m.id}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40">
                      <Trash2 size={13}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold text-sm text-gray-900">
                <td className="px-4 py-3" colSpan={4}>Total</td>
                <td className="px-4 py-3 text-right">{fmt(totalPesos)}</td>
                <td className="px-4 py-3 text-right">{fmt(totalDolares)}</td>
                <td className="px-4 py-3" colSpan={3}/>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
