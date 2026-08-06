'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, DollarSign, History, Calendar, Plus, Trash2, KeyRound, Loader2, Check, Eye, EyeOff, MessageCircle } from 'lucide-react'
import { CURRENCIES, Currency } from '@/lib/utils/currency'
import { formatDateAR, todayISO } from '@/lib/utils/date'

const WHATSAPP_EVENT_LABELS: { value: string; label: string }[] = [
  { value: 'revision_disponible', label: 'Nuevas tareas disponibles para revisión' },
  { value: 'correcciones_internas', label: 'Correcciones internas solicitadas' },
  { value: 'correcciones_cliente', label: 'Modificaciones solicitadas por el cliente' },
  { value: 'vencimiento_proximo', label: 'Vencimientos próximos' },
  { value: 'incorporacion_tarea', label: 'Incorporación a una tarea' },
]

export default function EditarUsuarioClient({ miembro, historial, adminId, availability, customRoles }: {
  miembro: any; historial: any[]; adminId: string; availability: any[]; customRoles: any[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const initialRole = miembro.custom_role_id ? 'custom:' + miembro.custom_role_id : miembro.role ?? 'colaborador'
  const [form, setForm] = useState({
    full_name: miembro.full_name ?? '', email: miembro.email ?? '',
    role: initialRole, is_active: miembro.is_active ?? true,
    banco: miembro.banco ?? '', cbu: miembro.cbu ?? '',
    cuenta_nombre: miembro.cuenta_nombre ?? miembro.full_name ?? '',
  })
  const [rateForm, setRateForm] = useState({ hourly_cost: '', currency: (miembro.currency ?? 'ARS') as Currency })
  const [availForm, setAvailForm] = useState({ desde: '', hasta: '', horas: '', notas: '' })

  const [waForm, setWaForm] = useState({
    whatsapp_country_code: miembro.whatsapp_country_code ?? '',
    whatsapp_phone: miembro.whatsapp_phone ?? '',
    whatsapp_enabled: miembro.whatsapp_enabled ?? false,
    whatsapp_consent: miembro.whatsapp_consent ?? false,
    whatsapp_notification_types: (miembro.whatsapp_notification_types ?? []) as string[],
  })
  const [savingWa, setSavingWa] = useState(false)
  const [savedWa, setSavedWa] = useState(false)

  function toggleWaType(type: string) {
    setWaForm(f => ({
      ...f,
      whatsapp_notification_types: f.whatsapp_notification_types.includes(type)
        ? f.whatsapp_notification_types.filter(t => t !== type)
        : [...f.whatsapp_notification_types, type],
    }))
  }

  // Password change state
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [savingPass, setSavingPass] = useState(false)
  const [savedPass, setSavedPass] = useState(false)
  const [errorPass, setErrorPass] = useState<string | null>(null)

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function guardarInfo(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const isCustom = form.role.startsWith('custom:')
    const customRoleId = isCustom ? form.role.replace('custom:', '') : null
    const realRole = isCustom ? 'colaborador' : form.role
    const { error } = await createClient().from('users').update({
      full_name: form.full_name, email: form.email,
      role: realRole, custom_role_id: customRoleId,
      is_active: form.is_active, banco: form.banco,
      cbu: form.cbu, cuenta_nombre: form.cuenta_nombre,
    }).eq('id', miembro.id)
    if (error) alert('Error: ' + error.message)
    else router.refresh()
    setLoading(false)
  }

  async function actualizarTarifa(e: React.FormEvent) {
    e.preventDefault()
    if (!rateForm.hourly_cost) return
    setLoading(true)
    const sb = createClient()
    const hoy = todayISO()
    await sb.from('users').update({ hourly_cost: parseFloat(rateForm.hourly_cost), currency: rateForm.currency }).eq('id', miembro.id)
    await sb.from('user_rate_history').insert({
      user_id: miembro.id, hourly_cost: parseFloat(rateForm.hourly_cost),
      currency: rateForm.currency, valid_from: hoy, mes: hoy.slice(0, 7), created_by: adminId,
    })
    setRateForm(f => ({ ...f, hourly_cost: '' }))
    router.refresh(); setLoading(false)
  }

  async function agregarDisponibilidad(e: React.FormEvent) {
    e.preventDefault()
    if (!availForm.desde || !availForm.hasta || !availForm.horas) return
    setLoading(true)
    const sb = createClient()
    // Buscar si ya existe un registro para ese rango
    const { data: existing } = await sb.from('user_availability')
      .select('id').eq('user_id', miembro.id)
      .eq('desde', availForm.desde).eq('hasta', availForm.hasta).single()

    if (existing) {
      await sb.from('user_availability').update({
        horas: parseFloat(availForm.horas), notas: availForm.notas || null,
      }).eq('id', existing.id)
    } else {
      await sb.from('user_availability').insert({
        user_id: miembro.id, desde: availForm.desde, hasta: availForm.hasta,
        horas: parseFloat(availForm.horas), notas: availForm.notas || null, created_by: adminId,
      })
    }
    setAvailForm({ desde: '', hasta: '', horas: '', notas: '' })
    router.refresh(); setLoading(false)
  }

  async function eliminarDisponibilidad(id: string) {
    await createClient().from('user_availability').delete().eq('id', id)
    router.refresh()
  }

  async function guardarWhatsapp(e: React.FormEvent) {
    e.preventDefault()
    setSavingWa(true)
    const wasConsentGiven = !!miembro.whatsapp_consent
    const { error } = await createClient().from('users').update({
      whatsapp_country_code: waForm.whatsapp_country_code.trim() || null,
      whatsapp_phone: waForm.whatsapp_phone.trim() || null,
      whatsapp_enabled: waForm.whatsapp_enabled,
      whatsapp_consent: waForm.whatsapp_consent,
      whatsapp_consent_at: waForm.whatsapp_consent && !wasConsentGiven ? new Date().toISOString() : undefined,
      whatsapp_notification_types: waForm.whatsapp_notification_types,
    }).eq('id', miembro.id)
    if (error) alert('Error: ' + error.message)
    else { setSavedWa(true); setTimeout(() => setSavedWa(false), 2500); router.refresh() }
    setSavingWa(false)
  }

  async function handleChangePass() {
    if (newPass.length < 6) { setErrorPass('Mínimo 6 caracteres'); return }
    if (newPass !== confirmPass) { setErrorPass('Las contraseñas no coinciden'); return }
    setSavingPass(true); setErrorPass(null)
    // Llama al endpoint de admin para cambiar password de otro usuario
    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: miembro.id, password: newPass }),
    })
    const data = await res.json()
    if (!res.ok) { setErrorPass(data.error ?? 'Error al cambiar contraseña'); setSavingPass(false); return }
    setSavedPass(true)
    setNewPass(''); setConfirmPass('')
    setTimeout(() => setSavedPass(false), 3000)
    setSavingPass(false)
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
                  <optgroup label="Roles del sistema">
                    <option value="colaborador">Colaborador</option>
                    <option value="gerente_operaciones">Gerente de operaciones</option>
                    <option value="admin">Admin</option>
                  </optgroup>
                  {customRoles.length > 0 && (
                    <optgroup label="Roles personalizados">
                      {customRoles.map((r: any) => (
                        <option key={r.id} value={'custom:' + r.id}>{r.name}</option>
                      ))}
                    </optgroup>
                  )}
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

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle size={14} className="text-gray-400"/>
            <p className="text-sm font-semibold text-gray-700">WhatsApp</p>
          </div>
          <form onSubmit={guardarWhatsapp} className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Código de país</label>
                <input type="text" value={waForm.whatsapp_country_code}
                  onChange={e => setWaForm(f => ({ ...f, whatsapp_country_code: e.target.value }))}
                  placeholder="+54"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1.5">Número de WhatsApp</label>
                <input type="text" value={waForm.whatsapp_phone}
                  onChange={e => setWaForm(f => ({ ...f, whatsapp_phone: e.target.value }))}
                  placeholder="9 11 1234 5678"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
              </div>
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={waForm.whatsapp_enabled}
                onChange={e => setWaForm(f => ({ ...f, whatsapp_enabled: e.target.checked }))}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#1B9BF0] focus:ring-[#1B9BF0]"/>
              <span className="text-sm text-gray-700">Recibir avisos de DDS por WhatsApp</span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={waForm.whatsapp_consent}
                onChange={e => setWaForm(f => ({ ...f, whatsapp_consent: e.target.checked }))}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#1B9BF0] focus:ring-[#1B9BF0]"/>
              <span className="text-sm text-gray-700">
                Tiene consentimiento para recibir mensajes de WhatsApp de Deployday con avisos sobre sus tareas.
              </span>
            </label>

            <div className="border-t border-gray-50 pt-3">
              <p className="text-xs font-medium text-gray-500 mb-2">¿Qué avisos recibe?</p>
              <div className="space-y-2">
                {WHATSAPP_EVENT_LABELS.map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={waForm.whatsapp_notification_types.includes(value)}
                      onChange={() => toggleWaType(value)}
                      className="w-4 h-4 rounded border-gray-300 text-[#1B9BF0] focus:ring-[#1B9BF0]"/>
                    <span className="text-xs text-gray-600">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" disabled={savingWa}
              className="w-full py-2.5 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {savingWa ? <><Loader2 size={15} className="animate-spin"/> Guardando...</>
                : savedWa ? <><Check size={15}/> Guardado</>
                : 'Guardar número de WhatsApp'}
            </button>
          </form>
        </div>

        {/* Cambio de contraseña — solo admin */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound size={14} className="text-gray-400"/>
            <p className="text-sm font-semibold text-gray-700">Cambiar contraseña</p>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Nueva contraseña</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] pr-10"/>
              <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-2.5 text-gray-400">
                {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Confirmar contraseña</label>
            <input type={showPass ? 'text' : 'password'} value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
              placeholder="Repetí la nueva contraseña"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
          {errorPass && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{errorPass}</p>}
          <button onClick={handleChangePass} disabled={savingPass || !newPass || !confirmPass}
            className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-all flex items-center justify-center gap-2">
            {savingPass ? <><Loader2 size={15} className="animate-spin"/> Cambiando...</>
              : savedPass ? <><Check size={15}/> Contraseña actualizada</>
              : 'Cambiar contraseña'}
          </button>
        </div>

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
                    <span className="text-gray-400">{h.mes} · desde {formatDateAR(h.valid_from)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

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
                      {formatDateAR(a.desde)} → {formatDateAR(a.hasta)}
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
