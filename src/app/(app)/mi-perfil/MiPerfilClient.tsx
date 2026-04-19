'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, Check, User } from 'lucide-react'
import Image from 'next/image'

export default function MiPerfilClient({
  userId, initialName, initialNickname, initialAvatarUrl, email
}: {
  userId: string
  initialName: string
  initialNickname: string
  initialAvatarUrl: string | null
  email: string
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(initialName)
  const [nickname, setNickname] = useState(initialNickname)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setError('La imagen debe pesar menos de 2MB'); return }

    setPreview(URL.createObjectURL(file))
    setUploading(true)
    setError(null)

    const sb = createClient()
    const ext = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`

    const { error: upErr } = await sb.storage.from('avatars').upload(path, file, { upsert: true })
    if (upErr) { setError('Error al subir imagen: ' + upErr.message); setUploading(false); return }

    const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(path)
    setAvatarUrl(publicUrl + '?t=' + Date.now())
    setPreview(null)
    setUploading(false)
  }

  async function handleSave() {
    if (!name.trim()) { setError('El nombre no puede estar vacío'); return }
    setSaving(true)
    setError(null)
    const sb = createClient()
    const { error: saveErr } = await sb.from('users').update({
      full_name: name.trim(),
      nickname: nickname.trim() || null,
      avatar_url: avatarUrl,
    }).eq('id', userId)
    if (saveErr) { setError('Error al guardar: ' + saveErr.message); setSaving(false); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    setSaving(false)
    router.refresh()
  }

  const displayAvatar = preview || avatarUrl

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Mi perfil</h1>
      <p className="text-sm text-gray-400 mb-8">{email}</p>

      {/* Avatar */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative group">
          <div className="w-24 h-24 rounded-2xl overflow-hidden bg-[#E8F4FE] flex items-center justify-center border-2 border-gray-100">
            {displayAvatar ? (
              <Image src={displayAvatar} alt="Avatar" fill className="object-cover" unoptimized/>
            ) : (
              <User size={36} className="text-[#1B9BF0]"/>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-[#1B9BF0]"/>
              </div>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#1B9BF0] text-white rounded-xl flex items-center justify-center shadow-md hover:bg-[#0F7ACC] transition-all disabled:opacity-50"
          >
            <Camera size={14}/>
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange}/>
        <p className="text-xs text-gray-400 mt-4">JPG, PNG o WEBP · máx. 2MB</p>
      </div>

      {/* Campos */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Nombre completo *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Nickname <span className="text-gray-300">(opcional — se muestra en lugar del nombre)</span></label>
          <input
            type="text"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder="ej: Caro, Nacho, ElProfe..."
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
          {error}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || uploading}
        className="w-full py-2.5 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        {saving ? <><Loader2 size={15} className="animate-spin"/> Guardando...</>
          : saved ? <><Check size={15}/> Guardado</>
          : 'Guardar cambios'}
      </button>
    </div>
  )
}
