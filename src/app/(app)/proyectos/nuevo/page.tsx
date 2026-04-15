'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Currency, CURRENCIES } from '@/lib/utils/currency'

export default function NuevoProyectoPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [clientes, setClientes] = useState<any[]>([])
  const [form, setForm] = useState({
    client_id: params.get('cliente') ?? '',
    name: '', description: '',
    service_type: 'desarrollo_software',
    sold_hours: '', price_per_hour: '',
    currency: 'ARS' as Currency,
    sold_at: '', start_date: '', end_date: '',
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
    const { error } = await supabase.from('projects').insert({
      client_id: form.client_id,
      name: form.name,
      description: form.description || null,
      service_type: form.service_type,
      sold_hours: parseFloat(form.sold_hours),
      price_per_hour: form.price_per_hour ? parseFloat(form.price_per_hour) : null,
      currency: form.currency,
      sold_at: form.sold_at || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      created_by: user?.id,
    })
    if (!error) router.push('/proyectos')
    else { alert('Error: ' + error.message); setLoading(false) }
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Link href="/proyectos" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Volver
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Nuevo proyecto</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Cliente *</label>
          <select value={form.client_id} onChange={e => set('client_id', e.target.value)} required
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
            <option value="">Seleccionar cliente</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre del proyecto *</label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required
            placeholder="Ej: Sitio web corporativo"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Horas vendidas *</label>
          <input type="number" min="0" step="0.5" value={form.sold_hours} onChange={e => set('sold_hours', e.target.value)} required
            placeholder="80"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Precio por hora</label>
          <div className="flex gap-2">
            <select value={form.currency} onChange={e => set('currency', e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <input type="number" min="0" step="0.01" value={form.price_per_hour} onChange={e => set('price_per_hour', e.target.value)}
              placeholder="0.00"
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha inicio</label>
            <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha fin</label>
            <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Link href="/proyectos" className="flex-1 text-center py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</Link>
          <button type="submit" disabled={loading}
            className="flex-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
            {loading ? 'Guardando...' : 'Guardar proyecto'}
          </button>
        </div>
      </form>
    </div>
  )
}
