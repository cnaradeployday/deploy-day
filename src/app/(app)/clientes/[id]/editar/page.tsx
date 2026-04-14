'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function EditarClientePage() {
  const router = useRouter()
  const { id } = useParams()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', notes: '', is_active: true })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    createClient().from('clients').select('*').eq('id', id).single()
      .then(({ data }) => { if (data) setForm({ name: data.name, company: data.company ?? '', email: data.email ?? '', phone: data.phone ?? '', notes: data.notes ?? '', is_active: data.is_active }) })
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await createClient().from('clients').update(form).eq('id', id)
    if (!error) router.push(`/clientes/${id}`)
    else { alert('Error al guardar'); setLoading(false) }
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Link href={`/clientes/${id}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Volver
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Editar cliente</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        {[
          { key: 'name', label: 'Nombre *', placeholder: 'Nombre del cliente', required: true },
          { key: 'company', label: 'Empresa', placeholder: 'Nombre de la empresa' },
          { key: 'email', label: 'Email', placeholder: 'email@empresa.com', type: 'email' },
          { key: 'phone', label: 'Teléfono', placeholder: '+54 11 1234-5678' },
        ].map(({ key, label, placeholder, required, type }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
            <input type={type ?? 'text'} value={(form as any)[key]} onChange={e => set(key, e.target.value)} required={required} placeholder={placeholder}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] focus:border-transparent" />
          </div>
        ))}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] resize-none" />
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" />
          <label htmlFor="active" className="text-sm text-gray-700">Cliente activo</label>
        </div>
        <div className="flex gap-3 pt-2">
          <Link href={`/clientes/${id}`} className="flex-1 text-center py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</Link>
          <button type="submit" disabled={loading}
            className="flex-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
