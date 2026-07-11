'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, Check, User, KeyRound, Eye, EyeOff, MessageCircle } from 'lucide-react'
import Image from 'next/image'

interface WhatsappPrefs { phone: string; countryCode: string; enabled: boolean; consent: boolean; types: string[] }

const WHATSAPP_EVENT_LABELS: { value: string; label: string }[] = [
  { value: 'revision_disponible', label: 'Nuevas tareas disponibles para revisión' },
  { value: 'correcciones_internas', label: 'Correcciones internas solicitadas' },
  { value: 'correcciones_cliente', label: 'Modificaciones solicitadas por el cliente' },
  { value: 'vencimiento_proximo', label: 'Vencimientos próximos' },
  { value: 'incorporacion_tarea', label: 'Incorporación a una tarea' },
]

export default function MiPerfilClient({
  userId, initialName, initialNickname, initialAvatarUrl, email, initialWhatsapp
}: {
  userId: string
  initialName: string
  initialNickname: string
  initialAvatarUrl: string | null
  email: string
  initialWhatsapp: WhatsappPrefs
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(initialName)
  const [nickname, setNickname] = useState(initialNickname)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [savingPass, setSavingPass] = useState(false)
  const [savedPass, setSavedPass] = useState(false)
  const [errorPass, setErrorPass] = useState<string | null>(null)

  const [whatsapp, setWhatsapp] = useState<WhatsappPrefs>(initialWhatsapp)
  const [savingWa, setSavingWa] = useState(false)
  const [savedWa, setSavedWa] = useState(false)
  const [errorWa, setErrorWa] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setError('La imagen debe pesar menos de 2MB'); return }
    setPreview(URL.createObjectURL(file))
    setUploading(true); setError(null)
    const sb = createClient()
    const ext = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`
    const { error: upErr } = await sb.storage.from('avatars').upload(path, file, { upsert: true })
    if (upErr) { setError('Error al subir imagen: ' + upErr.message); setUploading(false); return }
    const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(path)
    setAvatarUrl(publicUrl + '?t=' + Date.now())
    setPreview(null); setUploading(false)
  }

  async function handleSave() {
    if (!name.trim()) { setError('El nombre no puede estar vacío'); return }
    setSaving(true); setError(null)
    const { error: saveErr } = await createClient().from('users').update({
      full_name: name.trim(), nickname: nickname.trim() || null, avatar_url: avatarUrl,
    }).eq('id', userId)
    if (saveErr) { setError('Error al guardar: ' + saveErr.message); setSaving(false); return }
    setSaved(true); setTimeout(() => setSaved(false), 2500); setSaving(false); router.refresh()
  }

  async function handleChangePass() {
    if (newPass.length < 6) { setErrorPass('Mínimo 6 caracteres'); return }
    if (newPass !== confirmPass) { setErrorPass('Las contraseñas no coinciden'); return }
    setSavingPass(true); setErrorPass(null)
    const { error } = await createClient().auth.updateUser({ password: newPass })
    if (error) { setErrorPass('Error: ' + error.message); setSavingPass(false); return }
    setSavedPass(true); setNewPass(''); setConfirmPass('')
    setTimeout(() => setSavedPass(false), 3000); setSavingPass(false)
  }

  function toggleWhatsappType(type: string) {
    setWhatsapp(w => ({
      ...w,
      types: w.types.includes(type) ? w.types.filter(t => t !== type) : [...w.types, type],
    }))
  }

  async function handleSaveWhatsapp() {
    if (whatsapp.enabled && (!whatsapp.consent || !whatsapp.phone.trim())) {
      setErrorWa('Para activar WhatsApp necesitás cargar tu número y dar tu consentimiento.')
      return
    }
    setSavingWa(true); setErrorWa(null)
    const wasConsentGiven = initialWhatsapp.consent
    const { error: saveErr } = await createClient().from('users').update({
      whatsapp_phone: whatsapp.phone.trim() || null,
      whatsapp_country_code: whatsapp.countryCode.trim() || null,
      whatsapp_enabled: whatsapp.enabled,
      whatsapp_consent: whatsapp.consent,
      whatsapp_consent_at: whatsapp.consent && !wasConsentGiven ? new Date().toISOString() : undefined,
      whatsapp_notification_types: whatsapp.types,
    }).eq('id', userId)
    if (saveErr) { setErrorWa('Error al guardar: ' + saveErr.message); setSavingWa(false); return }
    setSavedWa(true); setTimeout(() => setSavedWa(false), 2500); setSavingWa(false); router.refresh()
  }

  const displayAvatar = preview || avatarUrl

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-0.5">Mi perfil</h1>
        <p className="text-sm text-gray-400">{email}</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center">
        <div className="relative group mb-4">
          <div className="w-24 h-24 rounded-2xl overflow-hidden bg-[#E8F4FE] flex items-center justify-center border-2 border-gray-100 relative">
            {displayAvatar
              ? <Image src={displayAvatar} alt="Avatar" fill className="object-cover" unoptimized/>
              : <User size={36} className="text-[#1B9BF0]"/>
            }
            {uploading && <div className="absolute inset-0 bg-white/70 flex items-center justify-center"><Loader2 size={20} className="animate-spin text-[#1B9BF0]"/></div>}
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#1B9BF0] text-white rounded-xl flex items-center justify-center shadow-md hover:bg-[#0F7ACC] transition-all disabled:opacity-50">
            <Camera size={14}/>
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange}/>
        <p className="text-xs text-gray-400">JPG, PNG o WEBP · máx. 2MB</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <p className="text-sm font-semibold text-gray-800">Datos personales</p>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Nombre completo *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Nickname <span className="text-gray-300 font-normal">(opcional — aparece en el sidebar)</span>
          </label>
          <input type="text" value={nickname} onChange={e => setNickname(e.target.value)}
            placeholder="ej: Caro, Nacho, ElProfe..."
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
        <button onClick={handleSave} disabled={saving || uploading}
          className="w-full py-2.5 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          {saving ? <><Loader2 size={15} className="animate-spin"/> Guardando...</>
            : saved ? <><Check size={15}/> Guardado</>
            : 'Guardar cambios'}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound size={15} className="text-gray-400"/>
          <p className="text-sm font-semibold text-gray-800">Cambiar contraseña</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Nueva contraseña</label>
          <div className="relative">
            <input type={showPass ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] pr-10"/>
            <button onClick={() => setShowPass(v => !v)} className="absolute right-3 top-2.5 text-gray-400">
              {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Confirmar contraseña</label>
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

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <MessageCircle size={15} className="text-gray-400"/>
          <p className="text-sm font-semibold text-gray-800">Notificaciones por WhatsApp</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Código de país</label>
            <input type="text" value={whatsapp.countryCode} onChange={e => setWhatsapp(w => ({ ...w, countryCode: e.target.value }))}
              placeholder="+54"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Número de WhatsApp</label>
            <input type="text" value={whatsapp.phone} onChange={e => setWhatsapp(w => ({ ...w, phone: e.target.value }))}
              placeholder="9 11 1234 5678"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={whatsapp.enabled}
            onChange={e => setWhatsapp(w => ({ ...w, enabled: e.target.checked }))}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#1B9BF0] focus:ring-[#1B9BF0]"/>
          <span className="text-sm text-gray-700">Recibir avisos de DDS por WhatsApp</span>
        </label>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={whatsapp.consent}
            onChange={e => setWhatsapp(w => ({ ...w, consent: e.target.checked }))}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#1B9BF0] focus:ring-[#1B9BF0]"/>
          <span className="text-sm text-gray-700">
            Doy mi consentimiento para recibir mensajes de WhatsApp de Deployday con avisos sobre mis tareas.
          </span>
        </label>

        <div className="border-t border-gray-50 pt-3">
          <p className="text-xs font-medium text-gray-500 mb-2">¿Qué avisos querés recibir?</p>
          <div className="space-y-2">
            {WHATSAPP_EVENT_LABELS.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={whatsapp.types.includes(value)}
                  onChange={() => toggleWhatsappType(value)}
                  className="w-4 h-4 rounded border-gray-300 text-[#1B9BF0] focus:ring-[#1B9BF0]"/>
                <span className="text-xs text-gray-600">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {errorWa && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{errorWa}</p>}
        <button onClick={handleSaveWhatsapp} disabled={savingWa}
          className="w-full py-2.5 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          {savingWa ? <><Loader2 size={15} className="animate-spin"/> Guardando...</>
            : savedWa ? <><Check size={15}/> Guardado</>
            : 'Guardar preferencias de WhatsApp'}
        </button>
      </div>
    </div>
  )
}
