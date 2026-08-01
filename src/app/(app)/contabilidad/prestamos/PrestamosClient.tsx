'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Pencil, Trash2, Banknote, X } from 'lucide-react'

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

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fechaAr = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-AR')

function mesesEntre(inicio: string, fin: string) {
  const a = new Date(inicio + 'T00:00:00')
  const b = new Date(fin + 'T00:00:00')
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

export default function PrestamosClient({ prestamos, mesesDevengados }: { prestamos: Prestamo[]; mesesDevengados: Record<string, number> }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const emptyForm = { acreedor: '', fecha_inicio: '', fecha_fin: '', moneda: 'ARS', monto: '', tasa_interes_anual: '', notas: '' }
  const [form, setForm] = useState(emptyForm)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  function openEdit(p: Prestamo) {
    setEditingId(p.id)
    setForm({
      acreedor: p.acreedor ?? '', fecha_inicio: p.fecha_inicio, fecha_fin: p.fecha_fin,
      moneda: p.moneda, monto: String(p.monto), tasa_interes_anual: String(p.tasa_interes_anual),
      notas: p.notas ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const sb = createClient()
    const plazo_meses = mesesEntre(form.fecha_inicio, form.fecha_fin)
    const payload = {
      acreedor: form.acreedor || null,
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin,
      plazo_meses,
      moneda: form.moneda,
      monto: parseFloat(form.monto) || 0,
      tasa_interes_anual: parseFloat(form.tasa_interes_anual) || 0,
      notas: form.notas || null,
    }
    const { error } = editingId
      ? await sb.from('prestamos').update(payload).eq('id', editingId)
      : await sb.from('prestamos').insert({ ...payload, created_by: (await sb.auth.getUser()).data.user?.id })
    setLoading(false)
    if (error) { alert('Error: ' + error.message); return }
    setForm(emptyForm)
    setEditingId(null)
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este préstamo y todos sus devengamientos?')) return
    setDeletingId(id)
    const { error } = await createClient().from('prestamos').delete().eq('id', id)
    setDeletingId(null)
    if (error) { alert('Error: ' + error.message); return }
    router.refresh()
  }

  return (
    <div className="p-6 w-full">
      <Link href="/contabilidad" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Contabilidad
      </Link>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Banknote size={18} className="text-[#1B9BF0]"/> Préstamos
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Vigencia, tasa y devengamiento mensual de intereses</p>
      </div>

      <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
        <div className="col-span-2">
          <label className="block text-xs text-gray-400 mb-1.5">Acreedor</label>
          <input type="text" value={form.acreedor} onChange={e => set('acreedor', e.target.value)} placeholder="Opcional"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Vigencia desde</label>
          <input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} required
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Vigencia hasta</label>
          <input type="date" value={form.fecha_fin} onChange={e => set('fecha_fin', e.target.value)} required
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Moneda</label>
          <select value={form.moneda} onChange={e => set('moneda', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Monto</label>
          <input type="number" min="0" step="0.01" value={form.monto} onChange={e => set('monto', e.target.value)} required
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Tasa anual %</label>
          <input type="number" min="0" step="0.01" value={form.tasa_interes_anual} onChange={e => set('tasa_interes_anual', e.target.value)} required
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div className="col-span-2 sm:col-span-4 lg:col-span-6">
          <label className="block text-xs text-gray-400 mb-1.5">Notas</label>
          <input type="text" value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Opcional"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div className="col-span-2 sm:col-span-4 lg:col-span-1 flex gap-2">
          {editingId && (
            <button type="button" onClick={cancelEdit}
              className="flex items-center justify-center gap-1 border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-xl text-sm font-semibold transition-all">
              <X size={15}/> Cancelar
            </button>
          )}
          <button type="submit" disabled={loading}
            className="flex-1 flex items-center justify-center gap-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
            {editingId ? <><Pencil size={15}/> Guardar cambios</> : <><Plus size={15}/> Agregar</>}
          </button>
        </div>
      </form>

      {!prestamos.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          <Banknote size={32} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">Sin préstamos cargados</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Acreedor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Vigencia</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 whitespace-nowrap">Plazo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 whitespace-nowrap">Monto</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 whitespace-nowrap">Tasa anual</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 whitespace-nowrap">Interés anual</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 whitespace-nowrap">Mensual</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 whitespace-nowrap">Meses devengados</th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody>
              {prestamos.map(p => {
                const interesAnual = p.monto * p.tasa_interes_anual / 100
                const mensual = interesAnual / 12
                return (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm">
                      <Link href={`/contabilidad/prestamos/${p.id}`} className="text-gray-900 font-medium hover:text-[#1B9BF0]">
                        {p.acreedor || 'Sin nombre'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fechaAr(p.fecha_inicio)} – {fechaAr(p.fecha_fin)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 text-right whitespace-nowrap">{p.plazo_meses} meses</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">{p.moneda} {fmt(p.monto)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">{p.tasa_interes_anual}%</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">{fmt(interesAnual)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">{fmt(mensual)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right whitespace-nowrap">{mesesDevengados[p.id] ?? 0}</td>
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
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
