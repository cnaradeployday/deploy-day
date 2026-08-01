'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Pencil, Trash2, Banknote, X, Check } from 'lucide-react'

type Prestamo = {
  id: string
  acreedor: string | null
  fecha_inicio: string
  fecha_fin: string
  plazo_meses: number
  moneda: string
  monto: number
  tasa_interes_anual: number
  notas: string | null
}

type Devengamiento = { id: string; mes: string; monto: number }

const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fechaAr = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-AR')
const mesCorto = (s: string) => {
  const d = new Date(s + 'T00:00:00')
  return `${MESES_ES[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`
}
function mesesEntre(inicio: string, fin: string) {
  const a = new Date(inicio + 'T00:00:00')
  const b = new Date(fin + 'T00:00:00')
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

export default function PrestamoDetalleClient({ prestamo, devengamientos }: { prestamo: Prestamo; devengamientos: Devengamiento[] }) {
  const router = useRouter()
  const interesAnual = prestamo.monto * prestamo.tasa_interes_anual / 100
  const mensual = interesAnual / 12

  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [mesForm, setMesForm] = useState('')
  const [montoForm, setMontoForm] = useState(mensual ? mensual.toFixed(2) : '')

  // Edición de datos del préstamo
  const [showEditPrestamo, setShowEditPrestamo] = useState(false)
  const [editPrestamoLoading, setEditPrestamoLoading] = useState(false)
  const [editForm, setEditForm] = useState({
    acreedor: prestamo.acreedor ?? '', fecha_inicio: prestamo.fecha_inicio, fecha_fin: prestamo.fecha_fin,
    moneda: prestamo.moneda, monto: String(prestamo.monto), tasa_interes_anual: String(prestamo.tasa_interes_anual),
    notas: prestamo.notas ?? '',
  })
  const setEdit = (k: string, v: string) => setEditForm(f => ({ ...f, [k]: v }))

  function openEditPrestamo() {
    setEditForm({
      acreedor: prestamo.acreedor ?? '', fecha_inicio: prestamo.fecha_inicio, fecha_fin: prestamo.fecha_fin,
      moneda: prestamo.moneda, monto: String(prestamo.monto), tasa_interes_anual: String(prestamo.tasa_interes_anual),
      notas: prestamo.notas ?? '',
    })
    setShowEditPrestamo(true)
  }

  async function handleSavePrestamo(e: React.FormEvent) {
    e.preventDefault()
    setEditPrestamoLoading(true)
    const { error } = await createClient().from('prestamos').update({
      acreedor: editForm.acreedor || null,
      fecha_inicio: editForm.fecha_inicio,
      fecha_fin: editForm.fecha_fin,
      plazo_meses: mesesEntre(editForm.fecha_inicio, editForm.fecha_fin),
      moneda: editForm.moneda,
      monto: parseFloat(editForm.monto) || 0,
      tasa_interes_anual: parseFloat(editForm.tasa_interes_anual) || 0,
      notas: editForm.notas || null,
    }).eq('id', prestamo.id)
    setEditPrestamoLoading(false)
    if (error) { alert('Error: ' + error.message); return }
    setShowEditPrestamo(false)
    router.refresh()
  }

  // Edición inline de devengamientos
  const [editingDevId, setEditingDevId] = useState<string | null>(null)
  const [editingDevMonto, setEditingDevMonto] = useState('')

  function openEditDev(d: Devengamiento) {
    setEditingDevId(d.id)
    setEditingDevMonto(String(d.monto))
  }

  async function handleSaveDev(id: string) {
    const monto = parseFloat(editingDevMonto)
    if (isNaN(monto)) { setEditingDevId(null); return }
    const { error } = await createClient().from('prestamo_devengamientos').update({ monto }).eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    setEditingDevId(null)
    router.refresh()
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!mesForm) return
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    const { error } = await sb.from('prestamo_devengamientos').insert({
      prestamo_id: prestamo.id,
      mes: `${mesForm}-01`,
      monto: parseFloat(montoForm) || 0,
      created_by: user?.id,
    })
    setLoading(false)
    if (error) { alert('Error: ' + error.message); return }
    setMesForm('')
    router.refresh()
  }

  async function handleDeleteDevengamiento(id: string) {
    if (!confirm('¿Eliminar este mes devengado?')) return
    setDeletingId(id)
    const { error } = await createClient().from('prestamo_devengamientos').delete().eq('id', id)
    setDeletingId(null)
    if (error) { alert('Error: ' + error.message); return }
    router.refresh()
  }

  async function handleDeletePrestamo() {
    if (!confirm('¿Eliminar este préstamo y todos sus devengamientos?')) return
    const { error } = await createClient().from('prestamos').delete().eq('id', prestamo.id)
    if (error) { alert('Error: ' + error.message); return }
    router.push('/contabilidad/prestamos')
  }

  const totalDevengado = devengamientos.reduce((s, d) => s + Number(d.monto), 0)

  return (
    <div className="p-6 w-full">
      <Link href="/contabilidad/prestamos" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Préstamos
      </Link>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Banknote size={18} className="text-[#1B9BF0]"/> {prestamo.acreedor || 'Préstamo'}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Vigencia, tasa y devengamiento mensual de intereses</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openEditPrestamo}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:bg-gray-100 px-3 py-2 rounded-xl transition-all">
            <Pencil size={14}/> Editar
          </button>
          <button onClick={handleDeletePrestamo}
            className="flex items-center gap-1.5 text-sm text-red-500 hover:bg-red-50 px-3 py-2 rounded-xl transition-all">
            <Trash2 size={14}/> Eliminar préstamo
          </button>
        </div>
      </div>

      {showEditPrestamo && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-gray-900">Editar préstamo</p>
              <button onClick={() => setShowEditPrestamo(false)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>
            <form onSubmit={handleSavePrestamo} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Acreedor</label>
                <input type="text" value={editForm.acreedor} onChange={e => setEdit('acreedor', e.target.value)} placeholder="Opcional"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Vigencia desde</label>
                  <input type="date" value={editForm.fecha_inicio} onChange={e => setEdit('fecha_inicio', e.target.value)} required
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Vigencia hasta</label>
                  <input type="date" value={editForm.fecha_fin} onChange={e => setEdit('fecha_fin', e.target.value)} required
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Moneda</label>
                  <select value={editForm.moneda} onChange={e => setEdit('moneda', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Monto</label>
                  <input type="number" min="0" step="0.01" value={editForm.monto} onChange={e => setEdit('monto', e.target.value)} required
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Tasa anual %</label>
                  <input type="number" min="0" step="0.01" value={editForm.tasa_interes_anual} onChange={e => setEdit('tasa_interes_anual', e.target.value)} required
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Notas</label>
                <input type="text" value={editForm.notas} onChange={e => setEdit('notas', e.target.value)} placeholder="Opcional"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEditPrestamo(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={editPrestamoLoading}
                  className="flex-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
                  {editPrestamoLoading ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 max-w-3xl">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          <div className="flex justify-between sm:justify-start sm:gap-3">
            <dt className="text-sm text-gray-400">Vigencia 1ª</dt>
            <dd className="text-sm font-medium text-gray-900">{fechaAr(prestamo.fecha_inicio)} – {fechaAr(prestamo.fecha_fin)} · {prestamo.plazo_meses} meses</dd>
          </div>
          <div className="flex justify-between sm:justify-start sm:gap-3">
            <dt className="text-sm text-gray-400">Monto</dt>
            <dd className="text-sm font-medium text-gray-900">{prestamo.moneda} {fmt(prestamo.monto)}</dd>
          </div>
          <div className="flex justify-between sm:justify-start sm:gap-3">
            <dt className="text-sm text-gray-400">Tasa interés anual</dt>
            <dd className="text-sm font-medium text-gray-900">{prestamo.tasa_interes_anual}%</dd>
          </div>
          <div className="flex justify-between sm:justify-start sm:gap-3">
            <dt className="text-sm text-gray-400">Interés anual</dt>
            <dd className="text-sm font-medium text-gray-900">{prestamo.moneda} {fmt(interesAnual)}</dd>
          </div>
          <div className="flex justify-between sm:justify-start sm:gap-3">
            <dt className="text-sm text-gray-400">Mensual</dt>
            <dd className="text-sm font-medium text-gray-900">{fmt(mensual)}</dd>
          </div>
          <div className="flex justify-between sm:justify-start sm:gap-3">
            <dt className="text-sm text-gray-400">Meses devengados</dt>
            <dd className="text-sm font-medium text-gray-900">{devengamientos.length}</dd>
          </div>
        </dl>
        {prestamo.notas && (
          <p className="text-xs text-gray-400 mt-4 pt-4 border-t border-gray-50">{prestamo.notas}</p>
        )}
      </div>

      <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Mes</label>
          <input type="month" value={mesForm} onChange={e => setMesForm(e.target.value)} required
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Monto {prestamo.moneda}</label>
          <input type="number" step="0.01" value={montoForm} onChange={e => setMontoForm(e.target.value)} required
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <button type="submit" disabled={loading}
          className="flex items-center justify-center gap-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
          <Plus size={15}/> Agregar mes devengado
        </button>
      </form>

      {!devengamientos.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          <p className="text-sm">Sin meses devengados cargados</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Mes</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 whitespace-nowrap">Monto {prestamo.moneda}</th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody>
              {devengamientos.map(d => (
                <tr key={d.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{mesCorto(d.mes)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">
                    {editingDevId === d.id ? (
                      <input type="number" step="0.01" autoFocus value={editingDevMonto}
                        onChange={e => setEditingDevMonto(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveDev(d.id); if (e.key === 'Escape') setEditingDevId(null) }}
                        className="w-28 px-2 py-1 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
                    ) : fmt(Number(d.monto))}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {editingDevId === d.id ? (
                      <>
                        <button onClick={() => handleSaveDev(d.id)}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-green-600 hover:bg-green-50 transition-all">
                          <Check size={13}/>
                        </button>
                        <button onClick={() => setEditingDevId(null)}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-all">
                          <X size={13}/>
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => openEditDev(d)}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
                          <Pencil size={13}/>
                        </button>
                        <button onClick={() => handleDeleteDevengamiento(d.id)} disabled={deletingId === d.id}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40">
                          <Trash2 size={13}/>
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold text-sm text-gray-900">
                <td className="px-4 py-3">Total devengado</td>
                <td className="px-4 py-3 text-right">{fmt(totalDevengado)}</td>
                <td className="px-4 py-3"/>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
