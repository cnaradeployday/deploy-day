'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Trash2, CreditCard } from 'lucide-react'
import ExportExcelButton from '@/components/shared/ExportExcelButton'

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

const SOLAPAS = ['Ctas de gastos', 'Proveedores', 'Proveedores - Cuotas', 'IVA', 'IIGG']
const COMPROBANTES = ['Ticket no fiscal', 'Factura A', 'Ticket B', 'Propina']

const fmt = (n: number | null) => n == null ? '' : n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function TarjetaCreditoClient({ movimientos, tipos }: { movimientos: Movimiento[]; tipos: Tipo[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0], proveedor: '', cuota: '',
    tipo_gasto_id: '', pesos: '', dolares: '', comprobante: '', solapa: 'Ctas de gastos',
  })

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

  const totalPesos = movimientos.reduce((s, m) => s + (Number(m.pesos) || 0), 0)
  const totalDolares = movimientos.reduce((s, m) => s + (Number(m.dolares) || 0), 0)

  const exportData = useMemo(() => movimientos.map(m => ({
    FECHA: new Date(m.fecha).toLocaleDateString('es-AR'),
    PROVEEDOR: m.proveedor,
    CUOTA: m.cuota ?? '',
    Clasificacion: m.clasificacion ?? '',
    PESOS: m.pesos ?? '',
    DÓLARES: m.dolares ?? '',
    Comprobante: m.comprobante ?? '',
    Solapa: m.solapa ?? '',
  })), [movimientos])

  return (
    <div className="p-6 w-full">
      <Link href="/contabilidad" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Contabilidad
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <CreditCard size={18} className="text-[#1B9BF0]"/> Tarjeta de crédito
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Consumos del resumen de tarjeta</p>
        </div>
        <ExportExcelButton data={exportData} filename="tarjeta_credito"/>
      </div>

      <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Fecha</label>
          <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} required
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-400 mb-1.5">Proveedor</label>
          <input type="text" value={form.proveedor} onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))} required
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Cuota</label>
          <input type="text" value={form.cuota} onChange={e => setForm(f => ({ ...f, cuota: e.target.value }))} placeholder="1/6"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-400 mb-1.5">Clasificación</label>
          <select value={form.tipo_gasto_id} onChange={e => setForm(f => ({ ...f, tipo_gasto_id: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
            <option value="">Sin especificar</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.numero} - {t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Pesos</label>
          <input type="number" step="0.01" value={form.pesos} onChange={e => setForm(f => ({ ...f, pesos: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Dólares</label>
          <input type="number" step="0.01" value={form.dolares} onChange={e => setForm(f => ({ ...f, dolares: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-400 mb-1.5">Comprobante</label>
          <input type="text" list="comprobantes" value={form.comprobante} onChange={e => setForm(f => ({ ...f, comprobante: e.target.value }))}
            placeholder="Ticket no fiscal"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          <datalist id="comprobantes">
            {COMPROBANTES.map(c => <option key={c} value={c}/>)}
          </datalist>
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-400 mb-1.5">Solapa</label>
          <select value={form.solapa} onChange={e => setForm(f => ({ ...f, solapa: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
            {SOLAPAS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button type="submit" disabled={loading}
          className="flex items-center justify-center gap-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
          <Plus size={15}/> Agregar
        </button>
      </form>

      {!movimientos.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          <CreditCard size={32} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">Sin movimientos cargados</p>
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
              {movimientos.map(m => (
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
