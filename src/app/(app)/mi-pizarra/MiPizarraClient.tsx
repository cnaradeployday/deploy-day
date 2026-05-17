'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Loader2, StickyNote, Check, X, Send, Search } from 'lucide-react'
import Image from 'next/image'

const COLORS: Record<string, { bg: string; border: string; label: string }> = {
  yellow: { bg: '#FEF9C3', border: '#FDE68A', label: 'Amarillo' },
  blue:   { bg: '#DBEAFE', border: '#BFDBFE', label: 'Azul' },
  pink:   { bg: '#FCE7F3', border: '#FBCFE8', label: 'Rosa' },
  green:  { bg: '#D1FAE5', border: '#A7F3D0', label: 'Verde' },
  purple: { bg: '#EDE9FE', border: '#DDD6FE', label: 'Violeta' },
}

interface Postit {
  id: string
  content: string
  color: string
  done: boolean
  created_at: string
  board_owner_id: string
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
    <div style={{ width: px, height: px }} className="rounded-full bg-[#E8F4FE] flex items-center justify-center text-xs font-semibold text-[#1B9BF0] shrink-0">
      {name?.[0]?.toUpperCase()}
    </div>
  )
}

function PostitCard({ postit, userId, onDelete, onToggle }: {
  postit: Postit
  userId: string
  onDelete: (id: string) => void
  onToggle: (id: string, done: boolean) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)
  const isOwn = postit.author_id === userId
  const color = COLORS[postit.color] ?? COLORS.yellow

  async function handleDelete() {
    setDeleting(true)
    await createClient().from('postits').delete().eq('id', postit.id)
    onDelete(postit.id)
  }

  async function handleToggle() {
    setToggling(true)
    await createClient().from('postits').update({ done: !postit.done }).eq('id', postit.id)
    onToggle(postit.id, !postit.done)
    setToggling(false)
  }

  return (
    <div
      className="relative p-4 rounded-lg shadow-md group transition-all hover:shadow-lg hover:-translate-y-0.5"
      style={{ backgroundColor: color.bg, borderTop: `4px solid ${color.border}` }}
    >
      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full shadow-sm"
        style={{ background: 'radial-gradient(circle at 40% 40%, #f87171, #dc2626)' }} />

      {!isOwn && postit.author && (
        <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-black/10">
          <UserAvatar url={postit.author.avatar_url} name={postit.author.full_name} size={4} />
          <span className="text-[10px] text-gray-600 font-semibold">{postit.author.full_name}</span>
        </div>
      )}

      <p className={`text-sm leading-relaxed text-gray-800 min-h-[3rem] ${postit.done ? 'line-through text-gray-400' : ''}`}>
        {postit.content}
      </p>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-black/5">
        <span className="text-[10px] text-gray-500">
          {new Date(postit.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isOwn && (
            <button onClick={handleToggle} disabled={toggling}
              className="p-1.5 rounded-lg hover:bg-black/10 transition-all"
              title={postit.done ? 'Marcar pendiente' : 'Marcar hecho'}>
              {toggling
                ? <Loader2 size={12} className="animate-spin" />
                : <Check size={12} className={postit.done ? 'text-green-600' : 'text-gray-500'} />}
            </button>
          )}
          <button onClick={handleDelete} disabled={deleting}
            className="p-1.5 rounded-lg hover:bg-red-100 transition-all" title="Eliminar">
            {deleting ? <Loader2 size={12} className="animate-spin text-red-400" /> : <Trash2 size={12} className="text-red-400" />}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddPostitModal({ userId, onAdd, onClose }: {
  userId: string
  onAdd: (postit: Postit) => void
  onClose: () => void
}) {
  const [content, setContent] = useState('')
  const [color, setColor] = useState('yellow')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!content.trim()) return
    setSaving(true)
    setError(null)
    const { data, error: err } = await createClient().from('postits').insert({
      board_owner_id: userId,
      author_id: userId,
      content: content.trim(),
      color,
      done: false,
    }).select('id, content, color, done, created_at, board_owner_id, author_id, author:users!postits_author_id_fkey(id, full_name, avatar_url)').single()
    if (err) { setError(err.message); setSaving(false); return }
    if (data) { onAdd(data as any); onClose() }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-800">Nuevo post-it</p>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          {Object.entries(COLORS).map(([key, val]) => (
            <button key={key} onClick={() => setColor(key)}
              className="w-7 h-7 rounded-full transition-all"
              style={{
                backgroundColor: val.bg,
                border: `3px solid ${color === key ? '#374151' : val.border}`,
                transform: color === key ? 'scale(1.2)' : 'scale(1)',
              }}
              title={val.label} />
          ))}
        </div>

        <textarea
          autoFocus
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSubmit() }}
          placeholder="Escribí tu nota..."
          rows={4}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] resize-none mb-4 transition-colors"
          style={{ backgroundColor: COLORS[color]?.bg ?? '#FEF9C3' }}
        />

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <button onClick={handleSubmit} disabled={saving || !content.trim()}
          className="w-full py-2.5 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : '+ Agregar post-it'}
        </button>
      </div>
    </div>
  )
}

function LeaveNoteModal({ userId, teammates, onClose }: {
  userId: string
  teammates: Teammate[]
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Teammate | null>(null)
  const [content, setContent] = useState('')
  const [color, setColor] = useState('blue')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = teammates.filter(t =>
    t.full_name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleSend() {
    if (!selected || !content.trim()) return
    setSaving(true)
    setError(null)
    const { error: err } = await createClient().from('postits').insert({
      board_owner_id: selected.id,
      author_id: userId,
      content: content.trim(),
      color,
      done: false,
    })
    if (err) { setError(err.message); setSaving(false); return }
    setSent(true)
    setTimeout(onClose, 1800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-md mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-800">Dejar nota a un compañero</p>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>

        {sent ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check size={24} className="text-green-600" />
            </div>
            <p className="text-sm font-semibold text-gray-800">¡Nota enviada!</p>
            <p className="text-xs text-gray-400 mt-1">Ya está en la pizarra de {selected?.full_name}</p>
          </div>
        ) : !selected ? (
          <>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar compañero..." autoFocus
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]" />
            </div>
            <div className="max-h-52 overflow-y-auto space-y-1">
              {filtered.map(t => (
                <button key={t.id} onClick={() => setSelected(t)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-all text-left">
                  <UserAvatar url={t.avatar_url} name={t.full_name} size={8} />
                  <span className="text-sm text-gray-700">{t.full_name}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Sin resultados</p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2.5 mb-4 p-2.5 bg-gray-50 rounded-xl">
              <UserAvatar url={selected.avatar_url} name={selected.full_name} size={8} />
              <span className="text-sm font-medium text-gray-700 flex-1">{selected.full_name}</span>
              <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-gray-200 transition-all">
                <X size={12} className="text-gray-500" />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-3">
              {Object.entries(COLORS).map(([key, val]) => (
                <button key={key} onClick={() => setColor(key)}
                  className="w-7 h-7 rounded-full transition-all"
                  style={{
                    backgroundColor: val.bg,
                    border: `3px solid ${color === key ? '#374151' : val.border}`,
                    transform: color === key ? 'scale(1.2)' : 'scale(1)',
                  }}
                  title={val.label} />
              ))}
            </div>

            <textarea
              autoFocus
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={`Escribí un mensaje para ${selected.full_name}...`}
              rows={4}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] resize-none mb-4 transition-colors"
              style={{ backgroundColor: COLORS[color]?.bg ?? '#DBEAFE' }}
            />

            {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

            <button onClick={handleSend} disabled={saving || !content.trim()}
              className="w-full py-2.5 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Enviando...</> : <><Send size={14} /> Enviar nota</>}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function MiPizarraClient({ userId, userName, initialPostits, teammates }: {
  userId: string
  userName: string
  initialPostits: Postit[]
  teammates: Teammate[]
}) {
  const [postits, setPostits] = useState<Postit[]>(initialPostits)
  const [showAdd, setShowAdd] = useState(false)
  const [showLeaveNote, setShowLeaveNote] = useState(false)

  const myPostits = postits.filter(p => p.author_id === userId)
  const received = postits.filter(p => p.author_id !== userId)

  function handleAdd(p: Postit) { setPostits(prev => [p, ...prev]) }
  function handleDelete(id: string) { setPostits(prev => prev.filter(p => p.id !== id)) }
  function handleToggle(id: string, done: boolean) { setPostits(prev => prev.map(p => p.id === id ? { ...p, done } : p)) }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Mi pizarra</h1>
          <p className="text-sm text-gray-400 mt-0.5">Tu espacio privado · solo vos podés ver esto</p>
        </div>
        <div className="flex items-center gap-2">
          {teammates.length > 0 && (
            <button onClick={() => setShowLeaveNote(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl text-sm font-medium transition-all">
              <Send size={14} /> Dejar nota
            </button>
          )}
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
            <Plus size={15} /> Nuevo post-it
          </button>
        </div>
      </div>

      <div className="rounded-2xl p-6 min-h-72"
        style={{
          background: 'linear-gradient(135deg, #c8935a 0%, #bf8a52 50%, #b07d47 100%)',
          boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.2), inset 0 0 40px rgba(0,0,0,0.05)',
        }}>

        {myPostits.length > 0 && (
          <div className="mb-8">
            <p className="text-xs font-semibold text-amber-100/80 uppercase tracking-widest mb-4 px-1">
              Mis pendientes ({myPostits.filter(p => !p.done).length} activos)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
              {myPostits.map(p => (
                <PostitCard key={p.id} postit={p} userId={userId} onDelete={handleDelete} onToggle={handleToggle} />
              ))}
            </div>
          </div>
        )}

        {received.length > 0 && (
          <div>
            {myPostits.length > 0 && (
              <div className="border-t border-amber-700/30 mb-6" />
            )}
            <p className="text-xs font-semibold text-amber-100/80 uppercase tracking-widest mb-4 px-1">
              Mensajes recibidos ({received.length})
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
              {received.map(p => (
                <PostitCard key={p.id} postit={p} userId={userId} onDelete={handleDelete} onToggle={handleToggle} />
              ))}
            </div>
          </div>
        )}

        {postits.length === 0 && (
          <div className="text-center py-20">
            <StickyNote size={44} className="mx-auto mb-3" style={{ color: 'rgba(254,243,199,0.5)' }} />
            <p className="text-sm font-medium" style={{ color: 'rgba(254,243,199,0.9)' }}>Tu pizarra está vacía</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(254,243,199,0.5)' }}>Agregá tu primer post-it con el botón de arriba</p>
          </div>
        )}
      </div>

      {showAdd && <AddPostitModal userId={userId} onAdd={handleAdd} onClose={() => setShowAdd(false)} />}
      {showLeaveNote && <LeaveNoteModal userId={userId} teammates={teammates} onClose={() => setShowLeaveNote(false)} />}
    </div>
  )
}
