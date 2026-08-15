'use client'
import { useState } from 'react'
import { X, PartyPopper, Frown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Prospect } from './constants'

const inputClass = 'w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]'

export default function StageChangeModal({ prospect, newStage, clientes, currentUserId, onClose, onDone }: {
  prospect: Prospect
  newStage: 'ganado' | 'perdido'
  clientes: { id: string; name: string }[]
  currentUserId: string
  onClose: () => void
  onDone: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lostReason, setLostReason] = useState('')
  const [clientChoice, setClientChoice] = useState<'create' | 'link' | 'later'>('create')
  const [linkClientId, setLinkClientId] = useState('')

  async function confirmLost() {
    setLoading(true)
    setError(null)
    const sb = createClient()
    const { error } = await sb.from('prospects').update({
      stage: 'perdido', probability: 0, lost_reason: lostReason || null, lost_at: new Date().toISOString(),
    }).eq('id', prospect.id)
    setLoading(false)
    if (error) { setError(error.message); return }
    onDone()
  }

  async function confirmWon() {
    setLoading(true)
    setError(null)
    const sb = createClient()
    let clientId = prospect.client_id

    if (!clientId) {
      if (clientChoice === 'link') {
        if (!linkClientId) { setError('Seleccioná un cliente'); setLoading(false); return }
        clientId = linkClientId
      } else if (clientChoice === 'create') {
        const { data: newClient, error: clientError } = await sb.from('clients').insert({
          name: prospect.prospect_name,
          email: prospect.contact_email,
          phone: prospect.contact_phone,
          created_by: currentUserId,
        }).select('id').single()
        if (clientError) { setError(clientError.message); setLoading(false); return }
        clientId = newClient.id
      }
    }

    const { error } = await sb.from('prospects').update({
      stage: 'ganado', probability: 100, won_at: new Date().toISOString(),
      client_id: clientId,
    }).eq('id', prospect.id)
    setLoading(false)
    if (error) { setError(error.message); return }
    onDone()
  }

  if (newStage === 'perdido') {
    return (
      <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 max-w-sm w-full">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-gray-900 flex items-center gap-2"><Frown size={16} className="text-gray-400"/> Marcar como perdido</p>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
          </div>
          <p className="text-sm text-gray-500 mb-3">{prospect.project_name} — {prospect.prospect_name}</p>
          <label className="block text-xs text-gray-400 mb-1.5">Motivo (opcional)</label>
          <input type="text" value={lostReason} onChange={e => setLostReason(e.target.value)}
            placeholder="Precio, timing, eligió otro proveedor..." className={inputClass}/>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          <div className="flex gap-3 mt-5">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button onClick={confirmLost} disabled={loading}
              className="flex-1 bg-gray-800 hover:bg-gray-900 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
              {loading ? 'Guardando...' : 'Marcar perdido'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-gray-900 flex items-center gap-2"><PartyPopper size={16} className="text-[#1B9BF0]"/> ¡Prospecto ganado!</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
        </div>
        <p className="text-sm text-gray-500 mb-3">{prospect.project_name} — {prospect.prospect_name}</p>

        {prospect.client_id ? (
          <p className="text-sm text-gray-600">Ya está vinculado a <span className="font-medium text-gray-900">{prospect.client?.name}</span>. Confirmá para marcarlo ganado.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-400">Todavía no tiene un cliente vinculado. ¿Qué querés hacer?</p>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="radio" checked={clientChoice === 'create'} onChange={() => setClientChoice('create')} className="text-[#1B9BF0] focus:ring-[#1B9BF0]"/>
              Crear cliente ahora ({prospect.prospect_name})
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="radio" checked={clientChoice === 'link'} onChange={() => setClientChoice('link')} className="text-[#1B9BF0] focus:ring-[#1B9BF0]"/>
              Vincular a un cliente existente
            </label>
            {clientChoice === 'link' && (
              <select value={linkClientId} onChange={e => setLinkClientId(e.target.value)} className={inputClass + ' bg-white ml-6 w-[calc(100%-1.5rem)]'}>
                <option value="">Seleccionar cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="radio" checked={clientChoice === 'later'} onChange={() => setClientChoice('later')} className="text-[#1B9BF0] focus:ring-[#1B9BF0]"/>
              Por ahora no, resuelvo después
            </label>
          </div>
        )}

        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button onClick={confirmWon} disabled={loading}
            className="flex-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
            {loading ? 'Guardando...' : 'Marcar ganado'}
          </button>
        </div>
      </div>
    </div>
  )
}
