'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, Megaphone, Users, Globe, ToggleLeft, ToggleRight, X } from 'lucide-react'

interface NewsItem {
  id: string
  content: string
  visible_to: string[]
  is_active: boolean
  created_at: string
}

interface UserOption {
  id: string
  full_name: string
}

export default function NewsClient({
  newsList, allUsers, currentUserId
}: {
  newsList: NewsItem[]
  allUsers: UserOption[]
  currentUserId: string
}) {
  const router = useRouter()
  const [items, setItems] = useState<NewsItem[]>(newsList)
  const [showForm, setShowForm] = useState(false)
  const [content, setContent] = useState('')
  const [visibleTo, setVisibleTo] = useState<string[]>(['all'])
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [userSearch, setUserSearch] = useState('')

  const isAll = visibleTo.includes('all')

  function toggleUser(uid: string) {
    if (uid === 'all') { setVisibleTo(['all']); return }
    setVisibleTo(prev => {
      const without = prev.filter(x => x !== 'all')
      return without.includes(uid) ? without.filter(x => x !== uid) : [...without, uid]
    })
  }

  async function handleCreate() {
    if (!content.trim()) return
    setSaving(true)
    const sb = createClient()
    const { data, error } = await sb.from('news').insert({
      content: content.trim(),
      visible_to: visibleTo,
      is_active: false,
      created_by: currentUserId,
    }).select().single()
    if (!error && data) {
      setItems(prev => [data, ...prev])
      setContent('')
      setVisibleTo(['all'])
      setShowForm(false)
    }
    setSaving(false)
  }

  async function handleToggle(item: NewsItem) {
    setTogglingId(item.id)
    const sb = createClient()
    const newActive = !item.is_active

    if (newActive) {
      // Desactivar todos los demás primero
      await sb.from('news').update({ is_active: false }).neq('id', item.id)
      setItems(prev => prev.map(n => ({ ...n, is_active: n.id === item.id })))
    } else {
      await sb.from('news').update({ is_active: false }).eq('id', item.id)
      setItems(prev => prev.map(n => n.id === item.id ? { ...n, is_active: false } : n))
    }

    await sb.from('news').update({ is_active: newActive }).eq('id', item.id)
    setTogglingId(null)
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este anuncio?')) return
    setDeletingId(id)
    await createClient().from('news').delete().eq('id', id)
    setItems(prev => prev.filter(n => n.id !== id))
    setDeletingId(null)
  }

  const filteredUsers = allUsers.filter(u =>
    u.full_name.toLowerCase().includes(userSearch.toLowerCase())
  )

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Anuncios</h1>
          <p className="text-sm text-gray-400 mt-0.5">Solo un anuncio puede estar activo a la vez</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all"
        >
          <Plus size={15}/> Nuevo anuncio
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-800">Nuevo anuncio</p>
            <button onClick={() => setShowForm(false)}><X size={16} className="text-gray-400"/></button>
          </div>

          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Texto del anuncio..."
            rows={3}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] resize-none mb-4"
          />

          <p className="text-xs font-medium text-gray-500 mb-2">Visible para</p>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setVisibleTo(['all'])}
              className={'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ' + (isAll ? 'bg-[#1B9BF0] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
            >
              <Globe size={12}/> Todos
            </button>
            <button
              onClick={() => setVisibleTo([])}
              className={'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ' + (!isAll ? 'bg-[#1B9BF0] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
            >
              <Users size={12}/> Seleccionar usuarios
            </button>
          </div>

          {!isAll && (
            <div className="border border-gray-100 rounded-xl p-3 mb-4">
              <input
                type="text"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Buscar usuario..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] mb-2"
              />
              <div className="max-h-40 overflow-y-auto space-y-1">
                {filteredUsers.map(u => {
                  const selected = visibleTo.includes(u.id)
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleUser(u.id)}
                      className={'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all ' + (selected ? 'bg-[#E8F4FE] text-[#1B9BF0]' : 'hover:bg-gray-50 text-gray-700')}
                    >
                      <div className={'w-4 h-4 rounded border flex items-center justify-center shrink-0 ' + (selected ? 'bg-[#1B9BF0] border-[#1B9BF0]' : 'border-gray-300')}>
                        {selected && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
                      </div>
                      {u.full_name}
                    </button>
                  )
                })}
              </div>
              {visibleTo.filter(x => x !== 'all').length > 0 && (
                <p className="text-xs text-gray-400 mt-2">{visibleTo.filter(x => x !== 'all').length} usuario(s) seleccionado(s)</p>
              )}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={saving || !content.trim() || (!isAll && visibleTo.length === 0)}
            className="w-full py-2.5 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 size={14} className="animate-spin"/> Guardando...</> : 'Crear anuncio'}
          </button>
        </div>
      )}

      {/* Lista */}
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Megaphone size={32} className="text-gray-200 mx-auto mb-3"/>
          <p className="text-sm text-gray-400">No hay anuncios aún</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className={'bg-white rounded-2xl border p-4 transition-all ' + (item.is_active ? 'border-[#1B9BF0] shadow-sm' : 'border-gray-100')}>
              <div className="flex items-start gap-3">
                <div className={'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ' + (item.is_active ? 'bg-[#E8F4FE]' : 'bg-gray-50')}>
                  <Megaphone size={14} className={item.is_active ? 'text-[#1B9BF0]' : 'text-gray-400'}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 leading-relaxed">{item.content}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {item.is_active && (
                      <span className="text-xs bg-[#E8F4FE] text-[#1B9BF0] px-2 py-0.5 rounded-full font-medium">Activo</span>
                    )}
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      {item.visible_to.includes('all')
                        ? <><Globe size={10}/> Todos</>
                        : <><Users size={10}/> {item.visible_to.length} usuario(s)</>
                      }
                    </span>
                    <span className="text-xs text-gray-300">
                      {new Date(item.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggle(item)}
                    disabled={togglingId === item.id}
                    className="text-gray-400 hover:text-[#1B9BF0] transition-all disabled:opacity-50"
                    title={item.is_active ? 'Desactivar' : 'Activar'}
                  >
                    {togglingId === item.id
                      ? <Loader2 size={20} className="animate-spin"/>
                      : item.is_active
                        ? <ToggleRight size={22} className="text-[#1B9BF0]"/>
                        : <ToggleLeft size={22}/>
                    }
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="text-gray-300 hover:text-red-400 transition-all disabled:opacity-50"
                  >
                    {deletingId === item.id ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
