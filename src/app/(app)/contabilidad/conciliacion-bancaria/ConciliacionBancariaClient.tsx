'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Trash2, Landmark } from 'lucide-react'
import ExportExcelButton from '@/components/shared/ExportExcelButton'

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

export default function ConciliacionBancariaClient({ movimientos, clasificaciones }: {
  movimientos: Movimiento[]
  clasificaciones: Clasificacion[]
}) {
  const router = useRouter()
  const [form, setForm] = useState({ fecha: new Date().toISOString().split('T')[0], clasificacion_id: '', credito_debito: '', saldo: '' })
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const selected = clasificaciones.find(c => c.id === form.clasificacion_id) ?? null

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) { alert('Elegí una descripción'); return }
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    const { error } = await sb.from('conciliacion_bancaria').insert({
      fecha: form.fecha,
      descripcion: selected.descripcion,
      clasificacion_id: selected.id,
      clasificacion: selected.clasificacion,
      credito_debito: parseFloat(form.credito_debito) || 0,
      saldo: parseFloat(form.saldo) || 0,
      created_by: user?.id,
    })
    setLoading(false)
    if (error) { alert('Error: ' + error.message); return }
    setForm(f => ({ ...f, clasificacion_id: '', credito_debito: '', saldo: '' }))
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

  const exportData = useMemo(() => movimientos.map(m => ({
    Fecha: new Date(m.fecha).toLocaleDateString('es-AR'),
    Descripcion: m.descripcion,
    'Credito / Debito': m.credito_debito,
    Saldo: m.saldo,
    Clasificacion: m.clasificacion ?? '',
  })), [movimientos])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/contabilidad" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Contabilidad
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Landmark size={18} className="text-[#1B9BF0]"/> Conciliación bancaria
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Saldo actual: <span className="font-semibold text-gray-700">{fmt(ultimoSaldo)}</span></p>
        </div>
        <ExportExcelButton data={exportData} filename="conciliacion_bancaria"/>
      </div>

      <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Fecha</label>
          <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} required
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs text-gray-400 mb-1.5">Descripción</label>
          <select value={form.clasificacion_id} onChange={e => setForm(f => ({ ...f, clasificacion_id: e.target.value }))} required
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
            <option value="">Seleccionar...</option>
            {clasificaciones.map(c => <option key={c.id} value={c.id}>{c.descripcion}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Clasificación</label>
          <input type="text" value={selected?.clasificacion ?? ''} disabled placeholder="—"
            className="w-full px-3 py-2 border border-gray-100 bg-gray-50 rounded-xl text-sm text-gray-400"/>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Crédito / Débito</label>
          <input type="number" step="0.01" value={form.credito_debito} onChange={e => setForm(f => ({ ...f, credito_debito: e.target.value }))} required
            placeholder="-1000.00"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1.5">Saldo</label>
            <input type="number" step="0.01" value={form.saldo} onChange={e => setForm(f => ({ ...f, saldo: e.target.value }))} required
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
          <button type="submit" disabled={loading}
            className="shrink-0 flex items-center gap-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
            <Plus size={15}/>
          </button>
        </div>
      </form>

      {clasificaciones.length === 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-4 py-2.5 mb-4">
          Todavía no hay clasificaciones cargadas. Creá al menos una en <Link href="/contabilidad/extractos-bancarios" className="underline font-medium">Extractos bancarios</Link> antes de cargar movimientos.
        </p>
      )}

      {!movimientos.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          <Landmark size={32} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">Sin movimientos cargados</p>
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
              {movimientos.map(m => (
                <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(m.fecha).toLocaleDateString('es-AR')}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{m.descripcion}</td>
                  <td className={'px-4 py-3 text-sm font-medium whitespace-nowrap ' + (m.credito_debito < 0 ? 'text-red-500' : 'text-green-600')}>
                    {fmt(m.credito_debito)}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">{fmt(m.saldo)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{m.clasificacion ?? '—'}</td>
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
  )
}
