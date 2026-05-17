'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Loader2, X, ImageIcon, Send, LayoutGrid } from 'lucide-react'
import Image from 'next/image'

const COLORS: Record<string, { bg: string; border: string; label: string }> = {
  yellow: { bg: '#FEF9C3', border: '#FDE68A', label: 'Amarillo' },
  blue:   { bg: '#DBEAFE', border: '#BFDBFE', label: 'Azul' },
  pink:   { bg: '#FCE7F3', border: '#FBCFE8', label: 'Rosa' },
  green:  { bg: '#D1FAE5', border: '#A7F3D0', label: 'Verde' },
  purple: { bg: '#EDE9FE', border: '#DDD6FE', label: 'Violeta' },
}

function getRotation(id: string): number {
  const hash = id.split('').reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 0)
  const steps = ['-5', '-3.5', '-2', '-0.8', '0.5', '1.5', '2.8', '4', '5.2', '-4']
  return parseFloat(steps[Math.abs(hash) % steps.length])
}

function getAuthorColor(authorId: string): string {
  const keys = Object.keys(COLORS)
  const hash = authorId.split('').reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 0)
  return keys[Math.abs(hash) % keys.length]
}

function renderMentions(text: string): React.ReactNode {
  const parts = text.split(/(@\S+)/g)
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <span key={i} className="text-[#1B9BF0] font-semibold">{part}</span>
      : part
  )
}

interface Post {
  id: string
  content: string | null
  image_url: string | null
  created_at: string
  author_id: string
  author: { id: string; full_name: string; avatar_url: string | null } | null
}

interface Teammate {
  id: string
  full_name: string
  avatar_url: string | null
}

function UserAvatar({ url, name, size }: { url: string | null; name: string; size: number }) {
  const px = size * 4
  if (url) {
    return (
      <div style={{ width: px, height: px }} className="rounded-full overflow-hidden shrink-0 border border-gray-100">
        <Image src={url} alt={name} width={px} height={px} className="object-cover w-full h-full" unoptimized />
      </div>
    )
  }
  return (
    <div style={{ width: px, height: px }}
      className="rounded-full bg-[#E8F4FE] flex items-center justify-center text-xs font-semibold text-[#1B9BF0] shrink-0">
      {name?.[0]?.toUpperCase()}
    </div>
  )
}

function MentionTextarea({ value, onChange, teammates, placeholder, rows = 4, style, className, autoFocus }: {
  value: string
  onChange: (v: string) => void
  teammates: Teammate[]
  placeholder?: string
  rows?: number
  style?: React.CSSProperties
  className?: string
  autoFocus?: boolean
}) {
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionStart, setMentionStart] = useState(0)
  const taRef = useRef<HTMLTextAreaElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    const pos = e.target.selectionStart ?? val.length
    onChange(val)
    const before = val.slice(0, pos)
    const m = before.match(/@(\w*)$/)
    if (m) { setMentionQuery(m[1]); setMentionStart(pos - m[0].length) }
    else setMentionQuery(null)
  }

  function selectMention(t: Teammate) {
    const firstName = t.full_name.split(' ')[0]
    const curPos = taRef.current?.selectionStart ?? value.length
    const newVal = value.slice(0, mentionStart) + '@' + firstName + ' ' + value.slice(curPos)
    onChange(newVal)
    setMentionQuery(null)
    setTimeout(() => {
      if (!taRef.current) return
      const pos = mentionStart + firstName.length + 2
      taRef.current.focus()
      taRef.current.setSelectionRange(pos, pos)
    }, 0)
  }

  const filtered = mentionQuery !== null
    ? teammates.filter(t => t.full_name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5)
    : []

  return (
    <div className="relative">
      <textarea ref={taRef} value={value} onChange={handleChange}
        placeholder={placeholder} rows={rows} style={style} className={className} autoFocus={autoFocus} />
      {filtered.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden">
          {filtered.map(t => (
            <button key={t.id} onMouseDown={e => { e.preventDefault(); selectMention(t) }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#E8F4FE] text-left transition-colors">
              <UserAvatar url={t.avatar_url} name={t.full_name} size={6} />
              <span className="text-sm text-gray-700">{t.full_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PostCard({ post, userId, isAdmin, onDelete }: {
  post: Post
  userId: string
  isAdmin: boolean
  onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [imgError, setImgError] = useState(false)
  const canDelete = post.author_id === userId || isAdmin
  const rotation = getRotation(post.id)
  const colorKey = getAuthorColor(post.author_id)
  const color = COLORS[colorKey]
  const authorName = post.author?.full_name ?? 'Usuario'

  async function handleDelete() {
    if (!confirm('¿Eliminar esta publicación?')) return
    setDeleting(true)
    const sb = createClient()
    if (post.image_url) {
      const path = post.image_url.split('/tablero-general/').pop()
      if (path) await sb.storage.from('tablero-general').remove([path])
    }
    await sb.from('tablero_posts').delete().eq('id', post.id)
    onDelete(post.id)
  }

  return (
    <div className="transition-all duration-200 hover:z-10 relative"
      style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'center top' }}>
      <div className="rounded-lg shadow-md hover:shadow-xl transition-shadow"
        style={{ backgroundColor: color.bg, borderTop: `4px solid ${color.border}` }}>

        {/* Pin */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full shadow-md z-10 flex items-center justify-center"
          style={{ background: 'radial-gradient(circle at 35% 35%, #f87171, #b91c1c)' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-red-900/30" />
        </div>

        <div className="p-4 pt-5">
          {/* Author */}
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-black/10">
            <UserAvatar url={post.author?.avatar_url ?? null} name={authorName} size={5} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700 truncate">{authorName}</p>
              <p className="text-[10px] text-gray-500">{formatTimeAgo(post.created_at)}</p>
            </div>
            {canDelete && (
              <button onClick={handleDelete} disabled={deleting}
                className="p-1 rounded-lg hover:bg-red-100 transition-all opacity-0 group-hover:opacity-100" title="Eliminar">
                {deleting ? <Loader2 size={11} className="animate-spin text-red-400" /> : <Trash2 size={11} className="text-red-400" />}
              </button>
            )}
          </div>

          {/* Image */}
          {post.image_url && !imgError && (
            <div className="relative w-full rounded-md overflow-hidden mb-2.5" style={{ aspectRatio: '4/3' }}>
              <Image src={post.image_url} alt="imagen" fill className="object-cover"
                unoptimized onError={() => setImgError(true)} />
            </div>
          )}

          {/* Content */}
          {post.content && (
            <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
              {renderMentions(post.content)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `Hace ${days}d`
  return new Date(dateStr).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function NewPostModal({ userId, userName, avatarUrl, teammates, selectedColor, onAdd, onClose }: {
  userId: string
  userName: string
  avatarUrl: string | null
  teammates: Teammate[]
  selectedColor: string
  onAdd: (post: Post) => void
  onClose: () => void
}) {
  const [content, setContent] = useState('')
  const [color, setColor] = useState(selectedColor)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 10 * 1024 * 1024) { setError('La imagen no puede superar 10 MB'); return }
    setImageFile(f); setImagePreview(URL.createObjectURL(f)); setError(null)
  }

  async function handleSubmit() {
    if (!content.trim() && !imageFile) return
    setSaving(true); setError(null)
    const sb = createClient()

    let imageUrl: string | null = null
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `${userId}/${Date.now()}.${ext}`
      const { error: upErr } = await sb.storage.from('tablero-general').upload(path, imageFile)
      if (upErr) { setError('Error subiendo imagen: ' + upErr.message); setSaving(false); return }
      imageUrl = sb.storage.from('tablero-general').getPublicUrl(path).data.publicUrl
    }

    const { data, error: dbErr } = await sb.from('tablero_posts').insert({
      author_id: userId, content: content.trim() || null, image_url: imageUrl,
    }).select('id, content, image_url, created_at, author_id, author:users!tablero_posts_author_id_fkey(id, full_name, avatar_url)').single()

    if (dbErr) { setError(dbErr.message); setSaving(false); return }
    if (data) { onAdd(data as any); onClose() }
    setSaving(false)
  }

  const postItBg = COLORS[color]?.bg ?? '#FEF9C3'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="rounded-2xl p-5 w-full max-w-sm mx-4 shadow-2xl relative" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: postItBg, borderTop: `5px solid ${COLORS[color]?.border ?? '#FDE68A'}` }}>

        {/* Pin decoration */}
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full shadow-lg flex items-center justify-center"
          style={{ background: 'radial-gradient(circle at 35% 35%, #f87171, #b91c1c)' }}>
          <div className="w-2 h-2 rounded-full bg-red-900/30" />
        </div>

        <div className="flex items-center justify-between mb-4 mt-1">
          <p className="text-sm font-semibold text-gray-800">Nueva publicación</p>
          <button onClick={onClose}><X size={16} className="text-gray-500" /></button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          {Object.entries(COLORS).map(([key, val]) => (
            <button key={key} onClick={() => setColor(key)}
              className="w-7 h-7 rounded-full transition-all"
              style={{
                backgroundColor: val.bg,
                border: `3px solid ${color === key ? '#374151' : val.border}`,
                transform: color === key ? 'scale(1.2)' : 'scale(1)',
              }} title={val.label} />
          ))}
        </div>

        {imagePreview && (
          <div className="relative w-full rounded-xl overflow-hidden border border-black/10 mb-3" style={{ aspectRatio: '4/3' }}>
            <Image src={imagePreview} alt="preview" fill className="object-cover" unoptimized />
            <button onClick={() => { setImageFile(null); setImagePreview(null); if (fileRef.current) fileRef.current.value = '' }}
              className="absolute top-2 right-2 p-1 bg-black/50 rounded-lg">
              <X size={12} className="text-white" />
            </button>
          </div>
        )}

        <MentionTextarea
          value={content} onChange={setContent} teammates={teammates}
          placeholder="¿Qué querés compartir? (@nombre para mencionar)"
          rows={4} autoFocus
          style={{ backgroundColor: 'transparent' }}
          className="w-full px-0 py-1 text-sm text-gray-800 placeholder-gray-500 focus:outline-none resize-none mb-3 bg-transparent border-b border-black/10 focus:border-black/20"
        />

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="flex items-center gap-2">
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-black/15 text-sm text-gray-600 hover:bg-black/5 transition-all">
            <ImageIcon size={14} /> Imagen
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <button onClick={handleSubmit} disabled={saving || (!content.trim() && !imageFile)}
            className="flex-1 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-all flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Publicando...</> : <><Send size={14} /> Publicar</>}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PizarronClient({ userId, userName, userAvatarUrl, isAdmin, initialPosts, teammates }: {
  userId: string
  userName: string
  userAvatarUrl: string | null
  isAdmin: boolean
  initialPosts: Post[]
  teammates: Teammate[]
}) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [showForm, setShowForm] = useState(false)
  const myColorKey = getAuthorColor(userId)

  function handleAdd(post: Post) { setPosts(prev => [post, ...prev]) }
  function handleDelete(id: string) { setPosts(prev => prev.filter(p => p.id !== id)) }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Pizarrón</h1>
          <p className="text-sm text-gray-400 mt-0.5">Compartí novedades e imágenes con el equipo</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
          <Plus size={15} /> Publicar
        </button>
      </div>

      <div className="rounded-2xl p-8 min-h-80"
        style={{
          background: 'linear-gradient(145deg, #c8935a 0%, #b5803f 40%, #a06e30 100%)',
          boxShadow: 'inset 0 2px 16px rgba(0,0,0,0.25), inset 0 0 60px rgba(0,0,0,0.08)',
        }}>
        {posts.length === 0 ? (
          <div className="text-center py-24">
            <LayoutGrid size={48} className="mx-auto mb-4" style={{ color: 'rgba(254,243,199,0.4)' }} />
            <p className="text-sm font-medium" style={{ color: 'rgba(254,243,199,0.85)' }}>El pizarrón está vacío</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(254,243,199,0.45)' }}>Sé el primero en publicar algo</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-8">
            {posts.map(post => (
              <div key={post.id} className="break-inside-avoid mb-8 group">
                <PostCard post={post} userId={userId} isAdmin={isAdmin} onDelete={handleDelete} />
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <NewPostModal
          userId={userId} userName={userName} avatarUrl={userAvatarUrl}
          teammates={teammates} selectedColor={myColorKey}
          onAdd={handleAdd} onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
