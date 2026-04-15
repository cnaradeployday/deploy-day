'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Currency, CURRENCIES } from '@/lib/utils/currency'

export default function NuevaFacturaClientePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [clientes, setClientes] = useState<any[]>([])
  const [proyectos, setProyectos] = useState<any[]>([])
  const [form, setForm] = useState({
    client_id: '', project_id: '', numero: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '', importe: '',
    currency: 'ARS' as Currency, notas: ''
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    createClient().from('clients').select('id, name').order('name').then(({ data }) => setClientes(data ?? []))
  }, [])

  useEffect(() => {
    if (!form.client_id) return
    createClient().from('projects').select('id, name').eq('client_id', form.client_id).order('name')
      .then(({ data }) => setProyectos(data ?? []))
  }, [form.client_id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    const { error } = await sb.from('facturas_clientes').insert({
      client_id: form.client_id,
      project_id: form.project_id || null,
      numero: form.numero,
      fecha_emision: form.fecha_emision,
      fecha_vencimiento: form.fecha_vencimiento,
      importe: parseFloat(form.importe),
      currency: form.currency,
      notas: form.notas || null,
      created_by: user?.id,
    })
    if (!error) router.push('/facturas-clientes')
    else { alert('Error: ' + error.message); setLoading(false) }
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Link href="/facturas-clientes" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Volver
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Nueva factura</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Cliente *</label>
          <select value={form.client_id} onChange={e => set('client_id', e.target.value)} required
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
            <option value="">Seleccionar cliente</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {proyectos.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Proyecto</label>
            <select value={form.project_id} onChange={e => set('project_id', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Sin proyecto</option>
              {proyectos.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Número *</label>
          <input type="text" value={form.numero} onChange={e => set('numero', e.target.value)} required
            placeholder="001-00001"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Emisión *</label>
            <input type="date" value={form.fecha_emision} onChange={e => set('fecha_emision', e.target.value)} required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Vencimiento *</label>
            <input type="date" value={form.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)} required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Importe *</label>
          <div className="flex gap-2">
            <select value={form.currency} onChange={e => set('currency', e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <input type="number" min="0" step="0.01" value={form.importe} onChange={e => set('importe', e.target.value)} required
              placeholder="0.00"
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas</label>
          <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] resize-none"/>
        </div>
        <div className="flex gap-3 pt-2">
          <Link href="/facturas-clientes" className="flex-1 text-center py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</Link>
          <button type="submit" disabled={loading}
            className="flex-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
            {loading ? 'Guardando...' : 'Guardar factura'}
          </button>
        </div>
      </form>
    </div>
  )
}
