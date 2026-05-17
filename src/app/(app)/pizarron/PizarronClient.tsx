'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Loader2, X, ImageIcon, Send, LayoutGrid } from 'lucide-react'
import Image from 'next/image'

interface Post {
  id: string
  content: string | null
  image_url: string | null
  created_at: string
  author_id: string
  author: { id: string; full_name: string; avatar_url: string | null } | null
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
    <div style={{ width: px, height: px }} className="rounded-full bg-[#E8F4FE] flex items-center justify-center text-xs font-semibold text-[#1B9BF0] shrink-0">
      {name?.[0]?.toUpperCase()}
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

  const authorName = post.author?.full_name ?? 'Usuario'
  const timeAgo = formatTimeAgo(post.created_at)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-50">
        <UserAvatar url={post.author?.avatar_url ?? null} name={authorName} size={8} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{authorName}</p>
          <p className="text-[10px] text-gray-400">{timeAgo}</p>
        </div>
        {canDelete && (
          <button onClick={handleDelete} disabled={deleting}
            className="p-1.5 rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all disabled:opacity-50"
            title="Eliminar">
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        )}
      </div>

      {/* Image */}
      {post.image_url && !imgError && (
        <div className="relative w-full bg-gray-50" style={{ aspectRatio: '4/3' }}>
          <Image
            src={post.image_url}
            alt="Imagen publicación"
            fill
            className="object-cover"
            unoptimized
            onError={() => setImgError(true)}
          />
        </div>
      )}

      {/* Content */}
      {post.content && (
        <div className="px-4 py-3">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{post.content}</p>
        </div>
      )}
    </div>
  )
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Hace ${hrs} h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `Hace ${days} día${days > 1 ? 's' : ''}`
  return new Date(dateStr).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function NewPostForm({ userId, userName, avatarUrl, onAdd, onClose }: {
  userId: string
  userName: string
  avatarUrl: string | null
  onAdd: (post: Post) => void
  onClose: () => void
}) {
  const [content, setContent] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('La imagen no puede superar 10 MB'); return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setError(null)
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit() {
    if (!content.trim() && !imageFile) return
    setSaving(true)
    setError(null)
    const sb = createClient()

    let imageUrl: string | null = null
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `${userId}/${Date.now()}.${ext}`
      const { error: upErr } = await sb.storage.from('tablero-general').upload(path, imageFile)
      if (upErr) {
        setError('Error subiendo imagen: ' + upErr.message)
        setSaving(false)
        return
      }
      const { data: urlData } = sb.storage.from('tablero-general').getPublicUrl(path)
      imageUrl = urlData?.publicUrl ?? null
    }

    const { data, error: dbErr } = await sb.from('tablero_posts').insert({
      author_id: userId,
      content: content.trim() || null,
      image_url: imageUrl,
    }).select('id, content, image_url, created_at, author_id, author:users!tablero_posts_author_id_fkey(id, full_name, avatar_url)').single()

    if (dbErr) { setError(dbErr.message); setSaving(false); return }
    if (data) { onAdd(data as any) }
    onClose()
  }

  const canSubmit = (content.trim().length > 0 || !!imageFile) && !saving

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">Nueva publicación</p>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>

        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <UserAvatar url={avatarUrl} name={userName} size={9} />
            <textarea
              autoFocus
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="¿Qué querés compartir?"
              rows={3}
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] resize-none"
            />
          </div>

          {imagePreview && (
            <div className="relative mb-4 rounded-xl overflow-hidden border border-gray-100">
              <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
                <Image src={imagePreview} alt="Preview" fill className="object-cover" unoptimized />
              </div>
              <button onClick={clearImage}
                className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 rounded-lg transition-all">
                <X size={14} className="text-white" />
              </button>
            </div>
          )}

          {error && <p className="text-xs text-red-500 mb-3 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

          <div className="flex items-center justify-between">
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all">
              <ImageIcon size={16} /> Agregar imagen
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

            <button onClick={handleSubmit} disabled={!canSubmit}
              className="flex items-center gap-2 px-4 py-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Publicando...</> : <><Send size={14} /> Publicar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PizarronClient({ userId, userName, userAvatarUrl, isAdmin, initialPosts }: {
  userId: string
  userName: string
  userAvatarUrl: string | null
  isAdmin: boolean
  initialPosts: Post[]
}) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [showForm, setShowForm] = useState(false)

  function handleAdd(post: Post) { setPosts(prev => [post, ...prev]) }
  function handleDelete(id: string) { setPosts(prev => prev.filter(p => p.id !== id)) }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Pizarrón</h1>
          <p className="text-sm text-gray-400 mt-0.5">Compartí novedades, imágenes y mensajes con el equipo</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
          <Plus size={15} /> Publicar
        </button>
      </div>

      {posts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <LayoutGrid size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-400">El pizarrón está vacío</p>
          <p className="text-xs text-gray-300 mt-1">Sé el primero en publicar algo</p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
          {posts.map(post => (
            <div key={post.id} className="break-inside-avoid mb-4">
              <PostCard post={post} userId={userId} isAdmin={isAdmin} onDelete={handleDelete} />
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <NewPostForm
          userId={userId}
          userName={userName}
          avatarUrl={userAvatarUrl}
          onAdd={handleAdd}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
