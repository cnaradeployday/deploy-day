'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function EditarProyectoPage() {
  const router = useRouter()
  const { id } = useParams()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', service_type: 'otro',
    sold_hours: '', price_per_hour: '', start_date: '', end_date: '', is_active: true
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    createClient().from('projects').select('*').eq('id', id).single()
      .then(({ data }) => {
        if (data) setForm({
          name: data.name, description: data.description ?? '',
          service_type: data.service_type, sold_hours: String(data.sold_hours ?? ''),
          price_per_hour: String(data.price_per_hour ?? ''),
          start_date: data.start_date ?? '', end_date: data.end_date ?? '',
          is_active: data.is_active
        })
      })
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await createClient().from('projects').update({
      ...form,
      sold_hours: parseFloat(form.sold_hours),
      price_per_hour: form.price_per_hour ? parseFloat(form.price_per_hour) : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    }).eq('id', id)
    if (!error) router.push(`/proyectos/${id}`)
    else { alert('Error al guardar'); setLoading(false) }
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Link href={`/proyectos/${id}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Volver
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Editar proyecto</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre *</label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de servicio</label>
          <select value={form.service_type} onChange={e => set('service_type', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
            <option value="marketing_digital">Marketing digital</option>
            <option value="desarrollo_producto">Desarrollo de producto</option>
            <option value="desarrollo_software">Desarrollo de software</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Horas vendidas *</label>
            <input type="number" min="0" step="0.5" value={form.sold_hours} onChange={e => set('sold_hours', e.target.value)} required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Precio/hora ($)</label>
            <input type="number" min="0" step="0.01" value={form.price_per_hour} onChange={e => set('price_per_hour', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha inicio</label>
            <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha fin</label>
            <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" />
          <label htmlFor="active" className="text-sm text-gray-700">Proyecto activo</label>
        </div>
        <div className="flex gap-3 pt-2">
          <Link href={`/proyectos/${id}`} className="flex-1 text-center py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</Link>
          <button type="submit" disabled={loading}
            className="flex-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
