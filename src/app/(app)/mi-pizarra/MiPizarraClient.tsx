'use client'
import { useState, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Loader2, StickyNote, Check, X, Send, Search, ImageIcon, Pencil, Calendar, Building2 } from 'lucide-react'
import Image from 'next/image'
import { isPastDate, todayISO } from '@/lib/utils/date'

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

function renderMentions(text: string): React.ReactNode {
  const parts = text.split(/(@\S+)/g)
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <span key={i} className="text-[#1B9BF0] font-semibold">{part}</span>
      : part
  )
}

function isExpired(due_date: string | null | undefined): boolean {
  return isPastDate(due_date)
}

interface Client { id: string; name: string }

interface Postit {
  id: string
  content: string
  color: string
  done: boolean
  created_at: string
  board_owner_id: string
  author_id: string
  image_url: string | null
  due_date: string | null
  client_id: string | null
  author: { id: string; full_name: string; avatar_url: string | null } | null
  client: { id: string; name: string } | null
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

function ExpiredRibbon() {
  return (
    <div className="absolute top-0 right-0 overflow-hidden w-16 h-16 pointer-events-none" style={{ borderRadius: '0 8px 0 0' }}>
      <div
        className="absolute flex items-center justify-center font-bold text-white text-[11px]"
        style={{
          width: 72,
          height: 20,
          background: '#ef4444',
          top: 14,
          right: -18,
          transform: 'rotate(45deg)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      >
        E
      </div>
    </div>
  )
}

function EditPostitModal({ postit, teammates, clients, onSave, onClose }: {
  postit: Postit
  teammates: Teammate[]
  clients: Client[]
  onSave: (updated: Postit) => void
  onClose: () => void
}) {
  const [content, setContent] = useState(postit.content ?? '')
  const [color, setColor] = useState(postit.color)
  const [dueDate, setDueDate] = useState(postit.due_date ?? '')
  const [clientId, setClientId] = useState(postit.client_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true); setError(null)
    const sb = createClient()
    const { data, error: dbErr } = await sb
      .from('postits')
      .update({ content: content.trim() || null, color, due_date: dueDate || null, client_id: clientId || null })
      .eq('id', postit.id)
      .select('id, content, color, done, created_at, board_owner_id, author_id, image_url, due_date, client_id, author:users!postits_author_id_fkey(id, full_name, avatar_url), client:clients(id, name)')
      .single()
    if (dbErr) { setError(dbErr.message); setSaving(false); return }
    if (data) onSave(data as any)
    onClose()
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-800">Editar post-it</p>
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
              }} title={val.label} />
          ))}
        </div>

        <MentionTextarea
          value={content} onChange={setContent} teammates={teammates}
          placeholder="Contenido del post-it..."
          rows={4} autoFocus
          style={{ backgroundColor: COLORS[color]?.bg ?? '#FEF9C3' }}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] resize-none mb-3 transition-colors"
        />

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1"><Calendar size={11}/> Vencimiento</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1"><Building2 size={11}/> Cliente</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Sin cliente</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PostitCard({ postit, userId, teammates, clients, rotation, isDragging, isDragOver,
  onDelete, onToggle, onEdit, onDragStart, onDragOver, onDrop, onDragEnd }: {
  postit: Postit
  userId: string
  teammates: Teammate[]
  clients: Client[]
  rotation: number
  isDragging: boolean
  isDragOver: boolean
  onDelete: (id: string) => void
  onToggle: (id: string, done: boolean) => void
  onEdit: (updated: Postit) => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onDragEnd: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const isOwn = postit.author_id === userId
  const color = COLORS[postit.color] ?? COLORS.yellow
  const expired = isExpired(postit.due_date)

  async function handleDelete() {
    setDeleting(true)
    const sb = createClient()
    if (postit.image_url) {
      const path = postit.image_url.split('/tablero-general/').pop()
      if (path) await sb.storage.from('tablero-general').remove([path])
    }
    await sb.from('postits').delete().eq('id', postit.id)
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
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className="relative group cursor-grab active:cursor-grabbing transition-all duration-200"
      style={{
        transform: `rotate(${rotation}deg) scale(${isDragOver ? 1.04 : 1})`,
        opacity: isDragging ? 0.35 : 1,
        outline: isDragOver ? `3px solid #1B9BF0` : 'none',
        outlineOffset: 3,
        borderRadius: 8,
      }}
    >
      <div className="rounded-lg shadow-md group-hover:shadow-xl transition-shadow overflow-hidden"
        style={{ backgroundColor: color.bg, borderTop: `4px solid ${color.border}` }}>

        {/* Ribbon de expirado */}
        {expired && <ExpiredRibbon />}

        {/* Pin */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full shadow-md z-10 flex items-center justify-center"
          style={{ background: 'radial-gradient(circle at 35% 35%, #f87171, #b91c1c)' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-red-900/30" />
        </div>

        <div className="p-4 pt-5">
          {/* Author (messages from others) */}
          {!isOwn && postit.author && (
            <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-black/10">
              <UserAvatar url={postit.author.avatar_url} name={postit.author.full_name} size={4} />
              <span className="text-[10px] text-gray-600 font-semibold">{postit.author.full_name}</span>
            </div>
          )}

          {/* Client badge */}
          {postit.client && (
            <div className="mb-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#1B9BF0] bg-blue-50 px-1.5 py-0.5 rounded-full">
                <Building2 size={9}/> {postit.client.name}
              </span>
            </div>
          )}

          {/* Image */}
          {postit.image_url && !imgError && (
            <div className="relative w-full rounded-md overflow-hidden mb-2.5" style={{ aspectRatio: '4/3' }}>
              <Image src={postit.image_url} alt="adjunto" fill className="object-cover"
                unoptimized onError={() => setImgError(true)} />
            </div>
          )}

          {/* Content */}
          {postit.content && (
            <p className={`text-sm leading-relaxed text-gray-800 min-h-[2.5rem] whitespace-pre-wrap
              ${postit.done ? 'line-through text-gray-400' : ''}`}>
              {renderMentions(postit.content)}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-black/5">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-gray-500">
                {new Date(postit.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
              </span>
              {postit.due_date && (
                <span className={`text-[10px] font-medium flex items-center gap-0.5 ${expired ? 'text-red-500' : 'text-gray-500'}`}>
                  <Calendar size={9}/> {new Date(postit.due_date + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                  {expired && ' · vencido'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {isOwn && (
                <>
                  <button onClick={e => { e.stopPropagation(); setShowEdit(true) }}
                    className="p-1.5 rounded-lg hover:bg-black/10 transition-all" title="Editar">
                    <Pencil size={11} className="text-gray-500" />
                  </button>
                  <button onClick={handleToggle} disabled={toggling}
                    className="p-1.5 rounded-lg hover:bg-black/10 transition-all"
                    title={postit.done ? 'Marcar pendiente' : 'Marcar hecho'}>
                    {toggling
                      ? <Loader2 size={11} className="animate-spin" />
                      : <Check size={11} className={postit.done ? 'text-green-600' : 'text-gray-500'} />}
                  </button>
                </>
              )}
              <button onClick={handleDelete} disabled={deleting}
                className="p-1.5 rounded-lg hover:bg-red-100 transition-all" title="Eliminar">
                {deleting ? <Loader2 size={11} className="animate-spin text-red-400" /> : <Trash2 size={11} className="text-red-400" />}
              </button>
            </div>
          </div>
        </div>
      </div>
      {showEdit && (
        <EditPostitModal
          postit={postit} teammates={teammates} clients={clients}
          onSave={onEdit} onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  )
}

function AddPostitModal({ userId, teammates, clients, onAdd, onClose }: {
  userId: string
  teammates: Teammate[]
  clients: Client[]
  onAdd: (p: Postit) => void
  onClose: () => void
}) {
  const [content, setContent] = useState('')
  const [color, setColor] = useState('yellow')
  const [dueDate, setDueDate] = useState('')
  const [clientId, setClientId] = useState('')
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
      const path = `postits/${userId}/${Date.now()}.${ext}`
      const { error: upErr } = await sb.storage.from('tablero-general').upload(path, imageFile)
      if (upErr) { setError('Error subiendo imagen: ' + upErr.message); setSaving(false); return }
      imageUrl = sb.storage.from('tablero-general').getPublicUrl(path).data.publicUrl
    }

    const { data, error: dbErr } = await sb.from('postits').insert({
      board_owner_id: userId, author_id: userId,
      content: content.trim() || null, color, done: false, image_url: imageUrl,
      due_date: dueDate || null,
      client_id: clientId || null,
    }).select('id, content, color, done, created_at, board_owner_id, author_id, image_url, due_date, client_id, author:users!postits_author_id_fkey(id, full_name, avatar_url), client:clients(id, name)').single()

    if (dbErr) { setError(dbErr.message); setSaving(false); return }
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
              }} title={val.label} />
          ))}
        </div>

        {imagePreview && (
          <div className="relative w-full rounded-xl overflow-hidden border border-gray-100 mb-3" style={{ aspectRatio: '4/3' }}>
            <Image src={imagePreview} alt="preview" fill className="object-cover" unoptimized />
            <button onClick={() => { setImageFile(null); setImagePreview(null); if (fileRef.current) fileRef.current.value = '' }}
              className="absolute top-2 right-2 p-1 bg-black/50 rounded-lg">
              <X size={12} className="text-white" />
            </button>
          </div>
        )}

        <MentionTextarea
          value={content} onChange={setContent} teammates={teammates}
          placeholder="Escribí tu nota... (@nombre para mencionar)"
          rows={4} autoFocus
          style={{ backgroundColor: COLORS[color]?.bg ?? '#FEF9C3' }}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] resize-none mb-3 transition-colors"
        />

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1"><Calendar size={11}/> Vencimiento</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1"><Building2 size={11}/> Cliente</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Sin cliente</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <div className="flex items-center gap-2">
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-all">
            <ImageIcon size={14} /> Imagen
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <button onClick={handleSubmit} disabled={saving || (!content.trim() && !imageFile)}
            className="flex-1 py-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : '+ Agregar'}
          </button>
        </div>
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

  const filtered = teammates.filter(t => t.full_name.toLowerCase().includes(search.toLowerCase()))

  async function handleSend() {
    if (!selected || !content.trim()) return
    setSaving(true); setError(null)
    const { error: err } = await createClient().from('postits').insert({
      board_owner_id: selected.id, author_id: userId,
      content: content.trim(), color, done: false,
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
              {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sin resultados</p>}
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
                  }} title={val.label} />
              ))}
            </div>
            <MentionTextarea
              value={content} onChange={setContent} teammates={teammates}
              placeholder={`Escribí un mensaje... (@nombre para mencionar)`}
              rows={4} autoFocus
              style={{ backgroundColor: COLORS[color]?.bg ?? '#DBEAFE' }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] resize-none mb-4 transition-colors"
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

export default function MiPizarraClient({ userId, userName, initialPostits, teammates, clients }: {
  userId: string
  userName: string
  initialPostits: Postit[]
  teammates: Teammate[]
  clients: Client[]
}) {
  const [postits, setPostits] = useState<Postit[]>(initialPostits)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showLeaveNote, setShowLeaveNote] = useState(false)

  // Filtros y ordenamiento
  const [filterClient, setFilterClient] = useState('')
  const [filterExpired, setFilterExpired] = useState<'all' | 'expired' | 'active'>('all')
  const [sortBy, setSortBy] = useState<'due_date' | 'created_at' | 'client'>('due_date')

  const today = todayISO()

  const processed = useMemo(() => {
    let items = [...postits]
    if (filterClient) items = items.filter(p => p.client_id === filterClient)
    if (filterExpired === 'expired') items = items.filter(p => p.due_date && p.due_date < today)
    if (filterExpired === 'active') items = items.filter(p => !p.due_date || p.due_date >= today)
    items.sort((a, b) => {
      if (sortBy === 'due_date') {
        const da = a.due_date ?? '9999-12-31'
        const db = b.due_date ?? '9999-12-31'
        return da.localeCompare(db)
      }
      if (sortBy === 'client') {
        return (a.client?.name ?? '').localeCompare(b.client?.name ?? '')
      }
      return b.created_at.localeCompare(a.created_at)
    })
    return items
  }, [postits, filterClient, filterExpired, sortBy, today])

  const myPostits = processed.filter(p => p.author_id === userId)
  const received = processed.filter(p => p.author_id !== userId)
  const hasFilters = filterClient !== '' || filterExpired !== 'all'

  function handleAdd(p: Postit) { setPostits(prev => [p, ...prev]) }
  function handleDelete(id: string) { setPostits(prev => prev.filter(p => p.id !== id)) }
  function handleToggle(id: string, done: boolean) {
    setPostits(prev => prev.map(p => p.id === id ? { ...p, done } : p))
  }
  function handleEdit(updated: Postit) {
    setPostits(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  function handleDragStart(id: string) { setDraggingId(id) }
  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    if (id !== draggingId) setDragOverId(id)
  }
  function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) { setDraggingId(null); setDragOverId(null); return }
    setPostits(prev => {
      const arr = [...prev]
      const fromIdx = arr.findIndex(p => p.id === draggingId)
      const toIdx = arr.findIndex(p => p.id === targetId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const [item] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, item)
      return arr
    })
    setDraggingId(null); setDragOverId(null)
  }
  function handleDragEnd() { setDraggingId(null); setDragOverId(null) }

  function renderSection(items: Postit[], label: string) {
    if (items.length === 0) return null
    return (
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest mb-5 px-1"
          style={{ color: 'rgba(254,243,199,0.75)' }}>
          {label}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {items.map(p => (
            <PostitCard
              key={p.id} postit={p} userId={userId} teammates={teammates} clients={clients}
              rotation={getRotation(p.id)}
              isDragging={draggingId === p.id}
              isDragOver={dragOverId === p.id}
              onDelete={handleDelete} onToggle={handleToggle} onEdit={handleEdit}
              onDragStart={() => handleDragStart(p.id)}
              onDragOver={e => handleDragOver(e, p.id)}
              onDrop={() => handleDrop(p.id)}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
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

      {/* Filtros y ordenamiento */}
      <div className="bg-white rounded-2xl border border-gray-100 p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Building2 size={13} className="text-gray-400 shrink-0"/>
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
            className="flex-1 min-w-0 px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
            <option value="">Todos los clientes</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {([['all', 'Todos'], ['active', 'Vigentes'], ['expired', 'Vencidos']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFilterExpired(v)}
              className={'px-3 py-1 rounded-lg text-xs font-medium transition-all ' + (filterExpired === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {l}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Ordenar:</span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
            <option value="due_date">Por fecha de vencimiento</option>
            <option value="created_at">Por fecha de creación</option>
            <option value="client">Por cliente</option>
          </select>
        </div>

        {hasFilters && (
          <button onClick={() => { setFilterClient(''); setFilterExpired('all') }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 ml-auto">
            <X size={11}/> Limpiar
          </button>
        )}
      </div>

      <div className="rounded-2xl p-8 min-h-80"
        style={{
          background: 'linear-gradient(145deg, #c8935a 0%, #b5803f 40%, #a06e30 100%)',
          boxShadow: 'inset 0 2px 16px rgba(0,0,0,0.25), inset 0 0 60px rgba(0,0,0,0.08)',
        }}>

        {renderSection(myPostits, `Mis pendientes (${myPostits.filter(p => !p.done).length} activos)`)}
        {received.length > 0 && myPostits.length > 0 && (
          <div className="border-t border-amber-800/30 mb-8" />
        )}
        {renderSection(received, `Mensajes recibidos (${received.length})`)}

        {processed.length === 0 && (
          <div className="text-center py-24">
            <StickyNote size={48} className="mx-auto mb-4" style={{ color: 'rgba(254,243,199,0.4)' }} />
            <p className="text-sm font-medium" style={{ color: 'rgba(254,243,199,0.85)' }}>
              {hasFilters ? 'Sin resultados para este filtro' : 'Tu pizarra está vacía'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'rgba(254,243,199,0.45)' }}>
              {hasFilters ? 'Probá cambiando los filtros' : 'Agregá tu primer post-it arriba'}
            </p>
          </div>
        )}
      </div>

      {showAdd && <AddPostitModal userId={userId} teammates={teammates} clients={clients} onAdd={handleAdd} onClose={() => setShowAdd(false)} />}
      {showLeaveNote && <LeaveNoteModal userId={userId} teammates={teammates} onClose={() => setShowLeaveNote(false)} />}
    </div>
  )
}
