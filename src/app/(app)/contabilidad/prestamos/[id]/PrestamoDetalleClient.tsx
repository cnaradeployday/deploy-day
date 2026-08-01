'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Trash2, Banknote } from 'lucide-react'

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

export default function PrestamoDetalleClient({ prestamo, devengamientos }: { prestamo: Prestamo; devengamientos: Devengamiento[] }) {
  const router = useRouter()
  const interesAnual = prestamo.monto * prestamo.tasa_interes_anual / 100
  const mensual = interesAnual / 12

  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [mesForm, setMesForm] = useState('')
  const [montoForm, setMontoForm] = useState(mensual ? mensual.toFixed(2) : '')

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Banknote size={18} className="text-[#1B9BF0]"/> {prestamo.acreedor || 'Préstamo'}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Vigencia, tasa y devengamiento mensual de intereses</p>
        </div>
        <button onClick={handleDeletePrestamo}
          className="flex items-center gap-1.5 text-sm text-red-500 hover:bg-red-50 px-3 py-2 rounded-xl transition-all">
          <Trash2 size={14}/> Eliminar préstamo
        </button>
      </div>

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
                  <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">{fmt(Number(d.monto))}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDeleteDevengamiento(d.id)} disabled={deletingId === d.id}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40">
                      <Trash2 size={13}/>
                    </button>
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
