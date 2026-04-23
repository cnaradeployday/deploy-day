'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Check, X } from 'lucide-react'

interface Entry {
  id: string
  hours_logged: number
  entry_date: string
  notes: string | null
  user: { full_name: string } | null
}

export default function TimeEntriesList({
  entries, canEdit, currentUserId,
}: {
  entries: Entry[]
  canEdit: boolean
  currentUserId: string
}) {
  const router = useRouter()
  const [editId, setEditId] = useState<string | null>(null)
  const [editHours, setEditHours] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editDate, setEditDate] = useState('')
  const [loading, setLoading] = useState(false)

  function startEdit(e: Entry) {
    setEditId(e.id); setEditHours(String(e.hours_logged))
    setEditNotes(e.notes ?? ''); setEditDate(e.entry_date)
  }
  function cancelEdit() { setEditId(null) }

  async function saveEdit(id: string) {
    const h = parseFloat(editHours)
    if (!h || h <= 0) return
    setLoading(true)
    const { error } = await createClient()
      .from('time_entries')
      .update({ hours_logged: h, notes: editNotes || null, entry_date: editDate })
      .eq('id', id)
    setLoading(false)
    if (error) { alert('Error: ' + error.message); return }
    setEditId(null)
    router.refresh()
  }

  async function deleteEntry(id: string) {
    if (!confirm('¿Eliminar esta entrada de horas?')) return
    setLoading(true)
    await createClient().from('time_entries').delete().eq('id', id)
    setLoading(false)
    router.refresh()
  }

  if (!entries.length) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-sm font-medium text-gray-700 mb-3">Historial de horas</p>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {entries.map(e => {
          const isEditing = editId === e.id
          return (
            <div key={e.id} className="py-2 border-b border-gray-50 last:border-0">
              {isEditing ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Horas</label>
                      <input type="number" min="0.5" step="0.5" value={editHours}
                        onChange={ev => setEditHours(ev.target.value)}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Fecha</label>
                      <input type="date" value={editDate}
                        onChange={ev => setEditDate(ev.target.value)}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
                    </div>
                  </div>
                  <input type="text" value={editNotes} placeholder="Notas (opcional)"
                    onChange={ev => setEditNotes(ev.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(e.id)} disabled={loading}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                      <Check size={11}/> Guardar
                    </button>
                    <button onClick={cancelEdit}
                      className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">
                      <X size={11}/> Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-700">{e.user?.full_name ?? '—'}</p>
                    {e.notes && <p className="text-xs text-gray-400 mt-0.5">{e.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 ml-3 shrink-0">
                    <div className="text-right mr-1">
                      <p className="text-xs font-semibold text-gray-900">{e.hours_logged}h</p>
                      <p className="text-xs text-gray-400">{new Date(e.entry_date).toLocaleDateString('es-AR')}</p>
                    </div>
                    {canEdit && (
                      <>
                        <button onClick={() => startEdit(e)} title="Editar"
                          className="p-1 rounded-lg text-gray-300 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
                          <Pencil size={11}/>
                        </button>
                        <button onClick={() => deleteEntry(e.id)} title="Eliminar" disabled={loading}
                          className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all">
                          <Trash2 size={11}/>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
