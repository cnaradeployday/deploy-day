'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Currency, CURRENCIES } from '@/lib/utils/currency'

export default function NuevoMiembroPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    email: '', full_name: '', role: 'colaborador',
    hourly_cost: '', currency: 'ARS' as Currency, password: ''
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/team/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    const data = await res.json()
    if (data.error) { alert(data.error); setLoading(false); return }
    router.push('/equipo')
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Link href="/equipo" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Volver
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Agregar miembro</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo *</label>
          <input type="text" value={form.full_name} onChange={e => set('full_name', e.target.value)} required
            placeholder="Juan Pérez"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required
            placeholder="juan@deployday.com"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña inicial *</label>
          <input type="password" value={form.password} onChange={e => set('password', e.target.value)} required
            placeholder="Mínimo 8 caracteres"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Rol *</label>
          <select value={form.role} onChange={e => set('role', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
            <option value="colaborador">Colaborador</option>
            <option value="gerente_operaciones">Gerente de operaciones</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Costo por hora</label>
          <div className="flex gap-2">
            <select value={form.currency} onChange={e => set('currency', e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <input type="number" min="0" step="0.01" value={form.hourly_cost} onChange={e => set('hourly_cost', e.target.value)}
              placeholder="0.00"
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Link href="/equipo" className="flex-1 text-center py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</Link>
          <button type="submit" disabled={loading}
            className="flex-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
            {loading ? 'Creando...' : 'Crear miembro'}
          </button>
        </div>
      </form>
    </div>
  )
}
