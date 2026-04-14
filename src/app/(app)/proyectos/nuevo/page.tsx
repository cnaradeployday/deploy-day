'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NuevoProyectoPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [clientes, setClientes] = useState<any[]>([])
  const [form, setForm] = useState({
    client_id: params.get('cliente') ?? '',
    name: '',
    description: '',
    service_type: 'desarrollo_software',
    sold_hours: '',
    price_per_hour: '',
    sold_at: '',
    start_date: '',
    end_date: '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    createClient().from('clients').select('id, name').order('name').then(({ data }) => setClientes(data ?? []))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      ...form,
      sold_hours: parseFloat(form.sold_hours),
      price_per_hour: form.price_per_hour ? parseFloat(form.price_per_hour) : null,
      sold_at: form.sold_at || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      created_by: user?.id,
    }
    const { error } = await supabase.from('projects').insert(payload)
    if (!error) router.push('/proyectos')
    else { alert('Error al guardar'); setLoading(false) }
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Link href="/proyectos" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15} /> Volver
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Nuevo proyecto</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
          <select value={form.client_id} onChange={e => set('client_id', e.target.value)} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
            <option value="">Seleccionar cliente</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del proyecto *</label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Ej: Sitio web corporativo" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de servicio</label>
          <select value={form.service_type} onChange={e => set('service_type', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
            <option value="marketing_digital">Marketing digital</option>
            <option value="desarrollo_producto">Desarrollo de producto</option>
            <option value="desarrollo_software">Desarrollo de software</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Horas vendidas *</label>
            <input type="number" min="0" step="0.5" value={form.sold_hours} onChange={e => set('sold_hours', e.target.value)} required placeholder="80" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio/hora ($)</label>
            <input type="number" min="0" step="0.01" value={form.price_per_hour} onChange={e => set('price_per_hour', e.target.value)} placeholder="50" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
            <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
            <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Link href="/proyectos" className="flex-1 text-center py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</Link>
          <button type="submit" disabled={loading} className="flex-1 bg-black text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
            {loading ? 'Guardando...' : 'Guardar proyecto'}
          </button>
        </div>
      </form>
    </div>
  )
}
