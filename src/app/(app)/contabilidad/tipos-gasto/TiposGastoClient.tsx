'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Pencil, Trash2, ListTree } from 'lucide-react'

type TipoGasto = { id: string; numero: string; nombre: string; descripcion: string | null }

export default function TiposGastoClient({ tipos }: { tipos: TipoGasto[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<TipoGasto | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ numero: '', nombre: '', descripcion: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function openNew() {
    setEditing(null)
    setForm({ numero: '', nombre: '', descripcion: '' })
    setError(null)
    setShowModal(true)
  }

  function openEdit(t: TipoGasto) {
    setEditing(t)
    setForm({ numero: t.numero, nombre: t.nombre, descripcion: t.descripcion ?? '' })
    setError(null)
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const sb = createClient()
    const payload = { numero: form.numero.trim(), nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null }
    const { error } = editing
      ? await sb.from('tipos_gasto').update(payload).eq('id', editing.id)
      : await sb.from('tipos_gasto').insert(payload)
    setLoading(false)
    if (error) { setError(error.message.includes('duplicate') ? 'Ese número ya existe' : error.message); return }
    setShowModal(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este tipo de gasto?')) return
    setDeletingId(id)
    const { error } = await createClient().from('tipos_gasto').delete().eq('id', id)
    setDeletingId(null)
    if (error) { alert('Error: ' + error.message); return }
    router.refresh()
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/contabilidad" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Contabilidad
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <ListTree size={18} className="text-[#1B9BF0]"/> Tipos de gasto
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Plan de cuentas para clasificar Facturas de compra y Tarjeta de crédito</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
          <Plus size={15}/> Nuevo tipo de gasto
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-[80px_1fr_1fr_auto] px-5 py-2.5 text-xs font-medium text-gray-400 border-b border-gray-50 bg-gray-50">
          <span>N°</span><span>Nombre</span><span>Descripción</span><span/>
        </div>
        {!tipos.length ? (
          <p className="text-sm text-gray-400 text-center py-8">Sin tipos de gasto cargados</p>
        ) : tipos.map(t => (
          <div key={t.id} className="grid grid-cols-[80px_1fr_1fr_auto] px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 items-center">
            <span className="text-sm text-gray-500">{t.numero}</span>
            <span className="text-sm text-gray-900">{t.nombre}</span>
            <span className="text-xs text-gray-400">{t.descripcion ?? '—'}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg text-gray-300 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
                <Pencil size={13}/>
              </button>
              <button onClick={() => handleDelete(t.id)} disabled={deletingId === t.id}
                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40">
                <Trash2 size={13}/>
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <p className="font-semibold text-gray-900 mb-4">{editing ? 'Editar tipo de gasto' : 'Nuevo tipo de gasto'}</p>
            <form onSubmit={handleSubmit} className="space-y-3 mb-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Número *</label>
                <input type="text" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                  required placeholder="Ej: 23" autoFocus
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Nombre *</label>
                <input type="text" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  required placeholder="Ej: Viáticos"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Descripción</label>
                <input type="text" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Descripción opcional"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 bg-[#1B9BF0] text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-[#0F7ACC]">
                  {loading ? 'Guardando...' : editing ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
