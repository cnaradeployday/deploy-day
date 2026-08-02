'use client'
import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Pencil, Trash2, LineChart, X, Check, Sparkles, Paperclip, ChevronUp, ChevronDown } from 'lucide-react'
import ExportExcelButton from '@/components/shared/ExportExcelButton'
import { registrarDocumentoIA } from '@/lib/supabase/registrarDocumentoIA'

type Movimiento = {
  id: string
  fecha: string
  operacion: 'SUSCRIPCION' | 'RESCATE'
  cantidad_cuotas: number
  tc_fondo: number
  monto: number
}
type Cierre = { id: string; mes: string; tc_fondo: number }
type ImportRow = {
  fecha: string; operacion: 'SUSCRIPCION' | 'RESCATE'; cantidad_cuotas: number; tc_fondo: number; monto: number; selected: boolean
}
type SortKey = 'fecha' | 'operacion' | 'cantidad_cuotas' | 'tc_fondo' | 'monto'

const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtMoney = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
const fmtNum = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fechaAr = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-AR')
const mesCorto = (s: string) => {
  const d = new Date(s + 'T00:00:00')
  return `${MESES_ES[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`
}
const filterInputClass = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]'
const cellInputClass = 'w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]'

export default function FondoComunClient({ movimientos, cierres }: { movimientos: Movimiento[]; cierres: Cierre[] }) {
  const router = useRouter()

  // Alta de movimiento
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [montoTouched, setMontoTouched] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0], operacion: 'SUSCRIPCION' as 'SUSCRIPCION' | 'RESCATE',
    cantidad_cuotas: '', tc_fondo: '', monto: '',
  })

  function openNew() {
    setEditingId(null)
    setMontoTouched(false)
    setForm({ fecha: new Date().toISOString().split('T')[0], operacion: 'SUSCRIPCION', cantidad_cuotas: '', tc_fondo: '', monto: '' })
    setShowForm(true)
  }

  function openEdit(m: Movimiento) {
    setEditingId(m.id)
    setMontoTouched(true)
    setForm({
      fecha: m.fecha, operacion: m.operacion,
      cantidad_cuotas: String(m.cantidad_cuotas), tc_fondo: String(m.tc_fondo), monto: String(m.monto),
    })
    setShowForm(true)
  }

  function updateCuotasOTc(k: 'cantidad_cuotas' | 'tc_fondo', v: string) {
    setForm(f => {
      const next = { ...f, [k]: v }
      if (!montoTouched) {
        const cuotas = parseFloat(next.cantidad_cuotas)
        const tc = parseFloat(next.tc_fondo)
        if (!isNaN(cuotas) && !isNaN(tc)) next.monto = (cuotas * tc).toFixed(2)
      }
      return next
    })
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const sb = createClient()
    const payload = {
      fecha: form.fecha,
      operacion: form.operacion,
      cantidad_cuotas: parseFloat(form.cantidad_cuotas) || 0,
      tc_fondo: parseFloat(form.tc_fondo) || 0,
      monto: parseFloat(form.monto) || 0,
    }
    const { error } = editingId
      ? await sb.from('inversiones_fci_movimientos').update(payload).eq('id', editingId)
      : await sb.from('inversiones_fci_movimientos').insert({ ...payload, created_by: (await sb.auth.getUser()).data.user?.id })
    setLoading(false)
    if (error) { alert('Error: ' + error.message); return }
    setForm({ fecha: new Date().toISOString().split('T')[0], operacion: 'SUSCRIPCION', cantidad_cuotas: '', tc_fondo: '', monto: '' })
    setMontoTouched(false)
    setEditingId(null)
    setShowForm(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este movimiento?')) return
    setDeletingId(id)
    const { error } = await createClient().from('inversiones_fci_movimientos').delete().eq('id', id)
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
      const res = await fetch('/api/ai/extraer-movimientos-fci', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al procesar el documento')
      const rows: ImportRow[] = (data.movimientos ?? []).map((m: any) => ({
        fecha: m.fecha || new Date().toISOString().split('T')[0],
        operacion: m.operacion === 'RESCATE' ? 'RESCATE' : 'SUSCRIPCION',
        cantidad_cuotas: m.cantidad_cuotas || 0,
        tc_fondo: m.tc_fondo || 0,
        monto: m.monto || 0,
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
    const { error } = await sb.from('inversiones_fci_movimientos').insert(rows.map(r => ({
      fecha: r.fecha,
      operacion: r.operacion,
      cantidad_cuotas: r.cantidad_cuotas,
      tc_fondo: r.tc_fondo,
      monto: r.monto,
      created_by: user?.id,
    })))
    if (error) { setSavingImport(false); alert('Error: ' + error.message); return }
    if (importFile) await registrarDocumentoIA(sb, { seccion: 'fondo_comun_inversion', file: importFile, cantidadRegistros: rows.length, userId: user?.id })
    setSavingImport(false)
    closeImport()
    router.refresh()
  }

  // Cierres mensuales
  const [cierreForm, setCierreForm] = useState({ mes: '', tc_fondo: '' })
  const [cierreLoading, setCierreLoading] = useState(false)
  const [deletingCierreId, setDeletingCierreId] = useState<string | null>(null)
  const [editingCierreId, setEditingCierreId] = useState<string | null>(null)
  const [editingCierreValue, setEditingCierreValue] = useState('')

  function openEditCierre(c: Cierre) {
    setEditingCierreId(c.id)
    setEditingCierreValue(String(c.tc_fondo))
  }

  async function handleSaveCierre(id: string) {
    const tc = parseFloat(editingCierreValue)
    if (isNaN(tc)) { setEditingCierreId(null); return }
    const { error } = await createClient().from('inversiones_fci_cierres_mensuales').update({ tc_fondo: tc }).eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    setEditingCierreId(null)
    router.refresh()
  }

  async function handleAddCierre(e: React.FormEvent) {
    e.preventDefault()
    if (!cierreForm.mes) return
    setCierreLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    const { error } = await sb.from('inversiones_fci_cierres_mensuales').insert({
      mes: `${cierreForm.mes}-01`,
      tc_fondo: parseFloat(cierreForm.tc_fondo) || 0,
      created_by: user?.id,
    })
    setCierreLoading(false)
    if (error) { alert(error.message.includes('duplicate') ? 'Ese mes ya tiene una TC de cierre cargada' : 'Error: ' + error.message); return }
    setCierreForm({ mes: '', tc_fondo: '' })
    router.refresh()
  }

  async function handleDeleteCierre(id: string) {
    if (!confirm('¿Eliminar esta TC de cierre?')) return
    setDeletingCierreId(id)
    const { error } = await createClient().from('inversiones_fci_cierres_mensuales').delete().eq('id', id)
    setDeletingCierreId(null)
    if (error) { alert('Error: ' + error.message); return }
    router.refresh()
  }

  const cuotasSuscriptas = movimientos.filter(m => m.operacion === 'SUSCRIPCION').reduce((s, m) => s + Number(m.cantidad_cuotas), 0)
  const cuotasRescatadas = movimientos.filter(m => m.operacion === 'RESCATE').reduce((s, m) => s + Number(m.cantidad_cuotas), 0)
  const cuotasEnCartera = cuotasSuscriptas - cuotasRescatadas
  const ultimoTc = movimientos.length ? Number(movimientos[movimientos.length - 1].tc_fondo) : 0
  const valorEstimado = cuotasEnCartera * ultimoTc

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
  const sortedMovimientos = useMemo(() => [...movimientos].sort((a, b) => {
    const va = a[sortKey], vb = b[sortKey]
    const cmp = typeof va === 'number' ? va - (vb as number) : String(va).localeCompare(String(vb))
    return sortDir === 'asc' ? cmp : -cmp
  }), [movimientos, sortKey, sortDir])

  const exportData = useMemo(() => movimientos.map(m => ({
    Fecha: fechaAr(m.fecha),
    Operacion: m.operacion,
    'Cantidad de cuotas': Number(m.cantidad_cuotas),
    'TC FONDO': Number(m.tc_fondo),
    Monto: Number(m.monto),
  })), [movimientos])

  return (
    <div className="p-6 w-full">
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-gray-900">{editingId ? 'Editar movimiento' : 'Agregar movimiento'}</p>
              <button onClick={() => { setShowForm(false); setEditingId(null) }} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Fecha</label>
                <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} required
                  className={filterInputClass}/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Operación</label>
                <select value={form.operacion} onChange={e => setForm(f => ({ ...f, operacion: e.target.value as 'SUSCRIPCION' | 'RESCATE' }))}
                  className={filterInputClass + ' bg-white'}>
                  <option value="SUSCRIPCION">Suscripción</option>
                  <option value="RESCATE">Rescate</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Cantidad de cuotas</label>
                  <input type="number" step="0.01" value={form.cantidad_cuotas} onChange={e => updateCuotasOTc('cantidad_cuotas', e.target.value)} required
                    className={filterInputClass}/>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">TC Fondo</label>
                  <input type="number" step="0.01" value={form.tc_fondo} onChange={e => updateCuotasOTc('tc_fondo', e.target.value)} required
                    className={filterInputClass}/>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Monto</label>
                <input type="number" step="0.01" value={form.monto}
                  onChange={e => { setMontoTouched(true); setForm(f => ({ ...f, monto: e.target.value })) }} required
                  className={filterInputClass}/>
                <p className="text-[11px] text-gray-400 mt-1">Se calcula automáticamente como cuotas × TC, pero podés ajustarlo.</p>
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
              <p className="font-semibold text-gray-900 flex items-center gap-1.5"><Sparkles size={15} className="text-[#1B9BF0]"/> Importar movimientos con IA</p>
              <button onClick={closeImport} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>

            {!importRows ? (
              <>
                <p className="text-sm text-gray-500 mb-3">Subí el PDF con los movimientos del fondo y extraemos las suscripciones y rescates automáticamente.</p>
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
                  Encontramos {importRows.length} movimiento{importRows.length !== 1 ? 's' : ''}. Revisá y desmarcá lo que no quieras cargar.
                </p>
                <div className="border border-gray-100 rounded-xl overflow-x-auto mb-4">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-50 bg-gray-50">
                        <th className="px-2 py-2"/>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-400">Fecha</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-400">Operación</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-400">Cantidad de cuotas</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-400">TC FONDO</th>
                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-400">Monto</th>
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
                          <td className="px-2 py-1.5 min-w-[130px]">
                            <select value={r.operacion} onChange={e => updateImportRow(i, { operacion: e.target.value as 'SUSCRIPCION' | 'RESCATE' })} className={cellInputClass + ' bg-white'}>
                              <option value="SUSCRIPCION">Suscripción</option>
                              <option value="RESCATE">Rescate</option>
                            </select>
                          </td>
                          <td className="px-2 py-1.5 w-28"><input type="number" step="0.01" value={r.cantidad_cuotas} onChange={e => updateImportRow(i, { cantidad_cuotas: parseFloat(e.target.value) || 0 })} className={cellInputClass + ' text-right'}/></td>
                          <td className="px-2 py-1.5 w-24"><input type="number" step="0.01" value={r.tc_fondo} onChange={e => updateImportRow(i, { tc_fondo: parseFloat(e.target.value) || 0 })} className={cellInputClass + ' text-right'}/></td>
                          <td className="px-2 py-1.5 w-24"><input type="number" step="0.01" value={r.monto} onChange={e => updateImportRow(i, { monto: parseFloat(e.target.value) || 0 })} className={cellInputClass + ' text-right'}/></td>
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

      <Link href="/contabilidad/inversiones" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Inversiones
      </Link>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <LineChart size={18} className="text-[#1B9BF0]"/> Fondo Común de Inversión
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Suscripciones, rescates y TC de cierre mensual</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportExcelButton data={exportData} filename="fondo_comun_inversion"/>
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">Cuotas en cartera</p>
          <p className="text-sm font-semibold text-gray-900">{fmtNum(cuotasEnCartera)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">Último TC cargado</p>
          <p className="text-sm font-semibold text-gray-900">{ultimoTc ? fmtMoney(ultimoTc) : '—'}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">Valor estimado cartera</p>
          <p className="text-sm font-semibold text-gray-900">{fmtMoney(valorEstimado)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">Neto invertido histórico</p>
          <p className="text-sm font-semibold text-gray-900">
            {fmtMoney(movimientos.reduce((s, m) => s + (m.operacion === 'SUSCRIPCION' ? Number(m.monto) : -Number(m.monto)), 0))}
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900">Movimientos</p>
            <span className="text-xs text-gray-400">{movimientos.length} movimiento{movimientos.length !== 1 ? 's' : ''}</span>
          </div>

          {!movimientos.length ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
              <LineChart size={32} className="mx-auto mb-3 opacity-20"/>
              <p className="text-sm">Sin movimientos cargados</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50">
                    {([
                      ['fecha', 'Fecha', 'left'], ['operacion', 'Operación', 'left'], ['cantidad_cuotas', 'Cantidad de cuotas', 'right'],
                      ['tc_fondo', 'TC FONDO', 'right'], ['monto', 'Monto', 'right'],
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
                  {sortedMovimientos.map(m => (
                    <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fechaAr(m.fecha)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={'text-xs px-2 py-0.5 rounded-full ' + (m.operacion === 'SUSCRIPCION' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500')}>
                          {m.operacion === 'SUSCRIPCION' ? 'Suscripción' : 'Rescate'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">{fmtNum(Number(m.cantidad_cuotas))}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">{fmtMoney(Number(m.tc_fondo))}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right whitespace-nowrap">{fmtMoney(Number(m.monto))}</td>
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

        <aside className="w-full lg:w-80 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-sm font-semibold text-gray-900 mb-1">TC de cierre de mes</p>
            <p className="text-xs text-gray-400 mb-3">Sirve para calcular la rentabilidad mensual del fondo.</p>
            <form onSubmit={handleAddCierre} className="flex gap-2 mb-4">
              <input type="month" value={cierreForm.mes} onChange={e => setCierreForm(f => ({ ...f, mes: e.target.value }))} required
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
              <input type="number" step="0.01" placeholder="TC" value={cierreForm.tc_fondo} onChange={e => setCierreForm(f => ({ ...f, tc_fondo: e.target.value }))} required
                className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
              <button type="submit" disabled={cierreLoading}
                className="shrink-0 flex items-center justify-center bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-3 rounded-xl disabled:opacity-50 transition-all">
                <Plus size={15}/>
              </button>
            </form>
            {!cierres.length ? (
              <p className="text-xs text-gray-400 text-center py-4">Sin TC de cierre cargadas</p>
            ) : (
              <div className="space-y-1">
                {cierres.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-50">
                    <span className="text-sm text-gray-700">{mesCorto(c.mes)}</span>
                    {editingCierreId === c.id ? (
                      <div className="flex items-center gap-1.5">
                        <input type="number" step="0.01" autoFocus value={editingCierreValue}
                          onChange={e => setEditingCierreValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveCierre(c.id); if (e.key === 'Escape') setEditingCierreId(null) }}
                          className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
                        <button onClick={() => handleSaveCierre(c.id)}
                          className="p-1 rounded-lg text-gray-300 hover:text-green-600 hover:bg-green-50 transition-all">
                          <Check size={12}/>
                        </button>
                        <button onClick={() => setEditingCierreId(null)}
                          className="p-1 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-all">
                          <X size={12}/>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{fmtMoney(Number(c.tc_fondo))}</span>
                        <button onClick={() => openEditCierre(c)}
                          className="p-1 rounded-lg text-gray-300 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
                          <Pencil size={12}/>
                        </button>
                        <button onClick={() => handleDeleteCierre(c.id)} disabled={deletingCierreId === c.id}
                          className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40">
                          <Trash2 size={12}/>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
