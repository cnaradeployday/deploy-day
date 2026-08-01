'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Pencil, Trash2, Link2 } from 'lucide-react'

type Clasificacion = { id: string; descripcion: string; clasificacion: string }

export default function ExtractosBancariosClient({ clasificaciones }: { clasificaciones: Clasificacion[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<Clasificacion | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ descripcion: '', clasificacion: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function openNew() {
    setEditing(null)
    setForm({ descripcion: '', clasificacion: '' })
    setError(null)
    setShowModal(true)
  }

  function openEdit(c: Clasificacion) {
    setEditing(c)
    setForm({ descripcion: c.descripcion, clasificacion: c.clasificacion })
    setError(null)
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const sb = createClient()
    const payload = { descripcion: form.descripcion.trim(), clasificacion: form.clasificacion.trim() }
    const { error } = editing
      ? await sb.from('banco_clasificaciones').update(payload).eq('id', editing.id)
      : await sb.from('banco_clasificaciones').insert(payload)
    setLoading(false)
    if (error) { setError(error.message.includes('duplicate') ? 'Esa descripción ya existe' : error.message); return }
    setShowModal(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta clasificación?')) return
    setDeletingId(id)
    const { error } = await createClient().from('banco_clasificaciones').delete().eq('id', id)
    setDeletingId(null)
    if (error) { alert('Error: ' + error.message); return }
    router.refresh()
  }

  return (
    <div className="p-6 w-full">
      <Link href="/contabilidad" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Contabilidad
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Link2 size={18} className="text-[#1B9BF0]"/> Extractos bancarios
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Descripción vinculada a una clasificación · alimenta el desplegable de Conciliación bancaria</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
          <Plus size={15}/> Nueva clasificación
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_auto] px-5 py-2.5 text-xs font-medium text-gray-400 border-b border-gray-50 bg-gray-50">
          <span>Descripción</span><span>Clasificación</span><span/>
        </div>
        {!clasificaciones.length ? (
          <p className="text-sm text-gray-400 text-center py-8">Sin clasificaciones cargadas</p>
        ) : clasificaciones.map(c => (
          <div key={c.id} className="grid grid-cols-[1fr_1fr_auto] px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 items-center">
            <span className="text-sm text-gray-900">{c.descripcion}</span>
            <span className="text-sm text-gray-600">{c.clasificacion}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-gray-300 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
                <Pencil size={13}/>
              </button>
              <button onClick={() => handleDelete(c.id)} disabled={deletingId === c.id}
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
            <p className="font-semibold text-gray-900 mb-4">{editing ? 'Editar clasificación' : 'Nueva clasificación'}</p>
            <form onSubmit={handleSubmit} className="space-y-3 mb-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Descripción *</label>
                <input type="text" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  required placeholder="Ej: TRF INMED PROVEED" autoFocus
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Clasificación *</label>
                <input type="text" value={form.clasificacion} onChange={e => setForm(f => ({ ...f, clasificacion: e.target.value }))}
                  required placeholder="Ej: Pago proveedores"
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
