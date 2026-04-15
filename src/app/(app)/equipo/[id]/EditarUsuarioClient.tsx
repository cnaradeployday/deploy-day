'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, DollarSign, History, Calendar, Plus, Trash2 } from 'lucide-react'
import { CURRENCIES, Currency } from '@/lib/utils/currency'

export default function EditarUsuarioClient({ miembro, historial, adminId, availability }: {
  miembro: any
  historial: any[]
  adminId: string
  availability: any[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    full_name: miembro.full_name ?? '',
    email: miembro.email ?? '',
    role: miembro.role ?? 'colaborador',
    is_active: miembro.is_active ?? true,
    banco: miembro.banco ?? '',
    cbu: miembro.cbu ?? '',
    cuenta_nombre: miembro.cuenta_nombre ?? miembro.full_name ?? '',
  })
  const [rateForm, setRateForm] = useState({ hourly_cost: '', currency: (miembro.currency ?? 'ARS') as Currency })
  const [availForm, setAvailForm] = useState({ desde: '', hasta: '', horas: '', notas: '' })
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
    await sb.from('users').update({ hourly_cost: parseFloat(rateForm.hourly_cost), currency: rateForm.currency }).eq('id', miembro.id)
    await sb.from('user_rate_history').insert({
      user_id: miembro.id, hourly_cost: parseFloat(rateForm.hourly_cost),
      currency: rateForm.currency, valid_from: hoy, mes: hoy.slice(0, 7), created_by: adminId,
    })
    setRateForm(f => ({ ...f, hourly_cost: '' }))
    router.refresh()
    setLoading(false)
  }

  async function agregarDisponibilidad(e: React.FormEvent) {
    e.preventDefault()
    if (!availForm.desde || !availForm.hasta || !availForm.horas) return
    setLoading(true)
    await createClient().from('user_availability').insert({
      user_id: miembro.id, desde: availForm.desde, hasta: availForm.hasta,
      horas: parseFloat(availForm.horas), notas: availForm.notas || null, created_by: adminId,
    })
    setAvailForm({ desde: '', hasta: '', horas: '', notas: '' })
    router.refresh()
    setLoading(false)
  }

  async function eliminarDisponibilidad(id: string) {
    await createClient().from('user_availability').delete().eq('id', id)
    router.refresh()
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
            {[
              { key: 'full_name', label: 'Nombre completo', placeholder: 'Juan Pérez' },
              { key: 'email', label: 'Email', placeholder: 'juan@deployday.com', type: 'email' },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
                <input type={type ?? 'text'} value={(form as any)[key]} onChange={e => set(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
              </div>
            ))}
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
            <div className="border-t border-gray-50 pt-3">
              <p className="text-xs font-medium text-gray-500 mb-3">Datos bancarios</p>
              <div className="space-y-2">
                {[
                  { key: 'banco', label: 'Banco', placeholder: 'Banco Galicia' },
                  { key: 'cbu', label: 'CBU', placeholder: '0000000000000000000000' },
                  { key: 'cuenta_nombre', label: 'A nombre de', placeholder: 'Juan Pérez' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-400 mb-1">{label}</label>
                    <input type="text" value={(form as any)[key]} onChange={e => set(key, e.target.value)}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
                  </div>
                ))}
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
          {historial.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-50">
              <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1"><History size={12}/> Historial</p>
              <div className="space-y-1.5">
                {historial.map(h => (
                  <div key={h.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{h.currency === 'USD' ? 'USD ' : '$'}{h.hourly_cost}/h</span>
                    <span className="text-gray-400">{h.mes} · desde {new Date(h.valid_from).toLocaleDateString('es-AR')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Disponibilidad */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Calendar size={14} className="text-[#1B9BF0]"/> Disponibilidad de horas
          </p>
          <form onSubmit={agregarDisponibilidad} className="space-y-3 mb-4">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Desde</label>
                <input type="date" value={availForm.desde} onChange={e => setAvailForm(f => ({ ...f, desde: e.target.value }))} required
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Hasta</label>
                <input type="date" value={availForm.hasta} onChange={e => setAvailForm(f => ({ ...f, hasta: e.target.value }))} required
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Horas</label>
                <input type="number" min="0" step="0.5" value={availForm.horas}
                  onChange={e => setAvailForm(f => ({ ...f, horas: e.target.value }))} placeholder="20" required
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
              </div>
            </div>
            <input type="text" value={availForm.notas} onChange={e => setAvailForm(f => ({ ...f, notas: e.target.value }))}
              placeholder="Notas (ej: vacaciones)"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
            <button type="submit" disabled={loading}
              className="w-full py-2 bg-gray-900 hover:bg-gray-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              <Plus size={13}/> Agregar período
            </button>
          </form>
          {availability.length > 0 && (
            <div className="space-y-2 border-t border-gray-50 pt-3">
              {availability.map(a => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-xs font-medium text-gray-700">{a.horas}h disponibles</p>
                    <p className="text-xs text-gray-400">
                      {new Date(a.desde).toLocaleDateString('es-AR')} → {new Date(a.hasta).toLocaleDateString('es-AR')}
                      {a.notas && ' · ' + a.notas}
                    </p>
                  </div>
                  <button onClick={() => eliminarDisponibilidad(a.id)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all">
                    <Trash2 size={13}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
