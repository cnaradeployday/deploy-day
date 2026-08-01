'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Trash2, LineChart, X } from 'lucide-react'
import ExportExcelButton from '@/components/shared/ExportExcelButton'
import MultiSelectFilter from '@/components/shared/MultiSelectFilter'

type Movimiento = {
  id: string
  fecha: string
  operacion: 'SUSCRIPCION' | 'RESCATE'
  cantidad_cuotas: number
  tc_fondo: number
  monto: number
}
type Cierre = { id: string; mes: string; tc_fondo: number }

const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtMoney = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
const fmtNum = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fechaAr = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-AR')
const mesCorto = (s: string) => {
  const d = new Date(s + 'T00:00:00')
  return `${MESES_ES[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`
}
const filterInputClass = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]'

const OPERACION_OPTIONS = [
  { value: 'SUSCRIPCION', label: 'Suscripción' },
  { value: 'RESCATE', label: 'Rescate' },
]

export default function FondoComunClient({ movimientos, cierres }: { movimientos: Movimiento[]; cierres: Cierre[] }) {
  const router = useRouter()

  // Alta de movimiento
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [montoTouched, setMontoTouched] = useState(false)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0], operacion: 'SUSCRIPCION' as 'SUSCRIPCION' | 'RESCATE',
    cantidad_cuotas: '', tc_fondo: '', monto: '',
  })

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
    const { data: { user } } = await sb.auth.getUser()
    const { error } = await sb.from('inversiones_fci_movimientos').insert({
      fecha: form.fecha,
      operacion: form.operacion,
      cantidad_cuotas: parseFloat(form.cantidad_cuotas) || 0,
      tc_fondo: parseFloat(form.tc_fondo) || 0,
      monto: parseFloat(form.monto) || 0,
      created_by: user?.id,
    })
    setLoading(false)
    if (error) { alert('Error: ' + error.message); return }
    setForm({ fecha: new Date().toISOString().split('T')[0], operacion: 'SUSCRIPCION', cantidad_cuotas: '', tc_fondo: '', monto: '' })
    setMontoTouched(false)
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

  // Cierres mensuales
  const [cierreForm, setCierreForm] = useState({ mes: '', tc_fondo: '' })
  const [cierreLoading, setCierreLoading] = useState(false)
  const [deletingCierreId, setDeletingCierreId] = useState<string | null>(null)

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

  // Filtros
  const [fFechaDesde, setFFechaDesde] = useState('')
  const [fFechaHasta, setFFechaHasta] = useState('')
  const [fOperacion, setFOperacion] = useState<string[]>([])
  const [fCuotasMin, setFCuotasMin] = useState('')
  const [fCuotasMax, setFCuotasMax] = useState('')
  const [fTcMin, setFTcMin] = useState('')
  const [fTcMax, setFTcMax] = useState('')
  const [fMontoMin, setFMontoMin] = useState('')
  const [fMontoMax, setFMontoMax] = useState('')

  function clearFilters() {
    setFFechaDesde(''); setFFechaHasta(''); setFOperacion([])
    setFCuotasMin(''); setFCuotasMax(''); setFTcMin(''); setFTcMax(''); setFMontoMin(''); setFMontoMax('')
  }
  const hasFilters = !!(fFechaDesde || fFechaHasta || fOperacion.length || fCuotasMin || fCuotasMax || fTcMin || fTcMax || fMontoMin || fMontoMax)

  const filtered = useMemo(() => {
    return movimientos.filter(m => {
      if (fFechaDesde && m.fecha < fFechaDesde) return false
      if (fFechaHasta && m.fecha > fFechaHasta) return false
      if (fOperacion.length && !fOperacion.includes(m.operacion)) return false
      if (fCuotasMin && Number(m.cantidad_cuotas) < parseFloat(fCuotasMin)) return false
      if (fCuotasMax && Number(m.cantidad_cuotas) > parseFloat(fCuotasMax)) return false
      if (fTcMin && Number(m.tc_fondo) < parseFloat(fTcMin)) return false
      if (fTcMax && Number(m.tc_fondo) > parseFloat(fTcMax)) return false
      if (fMontoMin && Number(m.monto) < parseFloat(fMontoMin)) return false
      if (fMontoMax && Number(m.monto) > parseFloat(fMontoMax)) return false
      return true
    })
  }, [movimientos, fFechaDesde, fFechaHasta, fOperacion, fCuotasMin, fCuotasMax, fTcMin, fTcMax, fMontoMin, fMontoMax])

  // Posicion actual (siempre sobre el total, no sobre el filtrado)
  const cuotasSuscriptas = movimientos.filter(m => m.operacion === 'SUSCRIPCION').reduce((s, m) => s + Number(m.cantidad_cuotas), 0)
  const cuotasRescatadas = movimientos.filter(m => m.operacion === 'RESCATE').reduce((s, m) => s + Number(m.cantidad_cuotas), 0)
  const cuotasEnCartera = cuotasSuscriptas - cuotasRescatadas
  const ultimoTc = movimientos.length ? Number(movimientos[movimientos.length - 1].tc_fondo) : 0
  const valorEstimado = cuotasEnCartera * ultimoTc

  const totalMontoFiltrado = filtered.reduce((s, m) => s + Number(m.monto), 0)

  const exportData = useMemo(() => filtered.map(m => ({
    Fecha: fechaAr(m.fecha),
    Operacion: m.operacion,
    'Cantidad de cuotas': Number(m.cantidad_cuotas),
    'TC FONDO': Number(m.tc_fondo),
    Monto: Number(m.monto),
  })), [filtered])

  return (
    <div className="p-6 w-full">
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-gray-900">Agregar movimiento</p>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
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
          <button onClick={() => setShowForm(true)}
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
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Fecha desde</label>
                <input type="date" value={fFechaDesde} onChange={e => setFFechaDesde(e.target.value)} className={filterInputClass}/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Fecha hasta</label>
                <input type="date" value={fFechaHasta} onChange={e => setFFechaHasta(e.target.value)} className={filterInputClass}/>
              </div>
              <MultiSelectFilter label="Operación" options={OPERACION_OPTIONS} selected={fOperacion} onChange={setFOperacion}/>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1.5">Cuotas mín.</label>
                  <input type="number" step="0.01" value={fCuotasMin} onChange={e => setFCuotasMin(e.target.value)} className={filterInputClass}/>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1.5">Cuotas máx.</label>
                  <input type="number" step="0.01" value={fCuotasMax} onChange={e => setFCuotasMax(e.target.value)} className={filterInputClass}/>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1.5">TC mín.</label>
                  <input type="number" step="0.01" value={fTcMin} onChange={e => setFTcMin(e.target.value)} className={filterInputClass}/>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1.5">TC máx.</label>
                  <input type="number" step="0.01" value={fTcMax} onChange={e => setFTcMax(e.target.value)} className={filterInputClass}/>
                </div>
              </div>
              <div className="flex gap-2 col-span-2">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1.5">Monto mín.</label>
                  <input type="number" step="0.01" value={fMontoMin} onChange={e => setFMontoMin(e.target.value)} className={filterInputClass}/>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1.5">Monto máx.</label>
                  <input type="number" step="0.01" value={fMontoMax} onChange={e => setFMontoMax(e.target.value)} className={filterInputClass}/>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              {hasFilters ? (
                <button onClick={clearFilters} className="text-xs text-[#1B9BF0] hover:underline">Deseleccionar todos</button>
              ) : <span/>}
              <span className="text-xs text-gray-400">{filtered.length} movimiento{filtered.length !== 1 ? 's' : ''} · Total {fmtMoney(totalMontoFiltrado)}</span>
            </div>
          </div>

          {!filtered.length ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
              <LineChart size={32} className="mx-auto mb-3 opacity-20"/>
              <p className="text-sm">{movimientos.length ? 'Ningún movimiento coincide con los filtros' : 'Sin movimientos cargados'}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Operación</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 whitespace-nowrap">Cantidad de cuotas</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 whitespace-nowrap">TC FONDO</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 whitespace-nowrap">Monto</th>
                    <th className="px-4 py-3"/>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => (
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
                      <td className="px-4 py-3">
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
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{fmtMoney(Number(c.tc_fondo))}</span>
                      <button onClick={() => handleDeleteCierre(c.id)} disabled={deletingCierreId === c.id}
                        className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40">
                        <Trash2 size={12}/>
                      </button>
                    </div>
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
