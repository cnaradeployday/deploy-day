'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, X } from 'lucide-react'

export default function HourRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  async function resolve(approved: boolean) {
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()

    if (approved) {
      const { data: req } = await sb.from('hour_requests').select('task_id, extra_hours').eq('id', requestId).single()
      if (req) {
        const { data: task } = await sb.from('tasks').select('estimated_hours').eq('id', req.task_id).single()
        if (task) {
          await sb.from('tasks').update({ estimated_hours: (task.estimated_hours ?? 0) + req.extra_hours }).eq('id', req.task_id)
        }
      }
    }

    await sb.from('hour_requests').update({
      status: approved ? 'aprobado' : 'rechazado',
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
      review_notes: notes || null,
    }).eq('id', requestId)

    router.refresh()
    setLoading(false)
  }

  return (
    <div className="space-y-2">
      <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="Notas de revisión (opcional)"
        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-black" />
      <div className="flex gap-2">
        <button onClick={() => resolve(false)} disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-50 disabled:opacity-50">
          <X size={13}/> Rechazar
        </button>
        <button onClick={() => resolve(true)} disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 disabled:opacity-50">
          <Check size={13}/> Aprobar
        </button>
      </div>
    </div>
  )
}
