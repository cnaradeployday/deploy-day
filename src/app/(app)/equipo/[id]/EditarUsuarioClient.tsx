'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Clock, DollarSign, History } from 'lucide-react'
import { CURRENCIES, Currency } from '@/lib/utils/currency'

export default function EditarUsuarioClient({ miembro, historial, adminId }: {
  miembro: any
  historial: any[]
  adminId: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    full_name: miembro.full_name ?? '',
    email: miembro.email ?? '',
    role: miembro.role ?? 'colaborador',
    is_active: miembro.is_active ?? true,
  })
  const [rateForm, setRateForm] = useState({
    hourly_cost: '',
    currency: (miembro.currency ?? 'ARS') as Currency,
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function guardarInfo(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await createClient().from('users').update(form).eq('id', miembro.id)
    if (error) alert('Error: ' + error.message)
    else router.refresh()
    setLoading(false)
  }

  async function actualizarTarifa(e: React.FormEvent) {
    e.preventDefault()
    if (!rateForm.hourly_cost) return
    setLoading(true)
    const sb = createClient()
    const hoy = new Date().toISOString().split('T')[0]
    const mes = hoy.slice(0, 7)

    await sb.from('users').update({
      hourly_cost: parseFloat(rateForm.hourly_cost),
      currency: rateForm.currency,
    }).eq('id', miembro.id)

    await sb.from('user_rate_history').insert({
      user_id: miembro.id,
      hourly_cost: parseFloat(rateForm.hourly_cost),
      currency: rateForm.currency,
      valid_from: hoy,
      mes,
      created_by: adminId,
    })

    setRateForm(f => ({ ...f, hourly_cost: '' }))
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link href="/equipo" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Equipo
      </Link>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-[#E8F4FE] flex items-center justify-center text-lg font-semibold text-[#1B9BF0]">
          {miembro.full_name?.[0]?.toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{miembro.full_name}</h1>
          <p className="text-sm text-gray-400">{miembro.email}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Info personal */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Información personal</p>
          <form onSubmit={guardarInfo} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Nombre completo</label>
              <input type="text" value={form.full_name} onChange={e => set('full_name', e.target.value)} required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Rol</label>
                <select value={form.role} onChange={e => set('role', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
                  <option value="colaborador">Colaborador</option>
                  <option value="gerente_operaciones">Gerente de operaciones</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Estado</label>
                <select value={form.is_active ? 'true' : 'false'} onChange={e => set('is_active', e.target.value === 'true')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </div>

        {/* Tarifa */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <DollarSign size={14} className="text-[#1B9BF0]"/> Valor hora actual
            </p>
            <span className="text-sm font-bold text-gray-900">
              {miembro.currency === 'USD' ? 'USD ' : '$'}{miembro.hourly_cost ?? 0}
            </span>
          </div>
          <form onSubmit={actualizarTarifa} className="space-y-3">
            <p className="text-xs text-gray-400">Actualizar para el mes en curso ({new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' })})</p>
            <div className="flex gap-2">
              <select value={rateForm.currency} onChange={e => setRateForm(f => ({ ...f, currency: e.target.value as Currency }))}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
                {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <input type="number" min="0" step="0.01" value={rateForm.hourly_cost}
                onChange={e => setRateForm(f => ({ ...f, hourly_cost: e.target.value }))}
                placeholder="Nuevo valor/hora" required
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
            </div>
            <button type="submit" disabled={loading || !rateForm.hourly_cost}
              className="w-full py-2.5 bg-black hover:bg-gray-800 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
              Actualizar tarifa
            </button>
          </form>
        </div>

        {/* Historial de tarifas */}
        {historial.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <History size={14} className="text-gray-400"/> Historial de tarifas
            </p>
            <div className="space-y-2">
              {historial.map(h => (
                <div key={h.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {h.currency === 'USD' ? 'USD ' : '$'}{h.hourly_cost}/h
                    </span>
                    <span className="text-xs text-gray-400 ml-2">desde {new Date(h.valid_from).toLocaleDateString('es-AR')}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{h.mes}</p>
                    <p className="text-xs text-gray-300">{h.created_by_user?.full_name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
