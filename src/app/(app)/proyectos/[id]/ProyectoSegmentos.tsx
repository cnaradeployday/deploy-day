'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Calendar } from 'lucide-react'

export default function ProyectoSegmentos({ projectId, segmentos, soldHours, totalSegmentos }: {
  projectId: string
  segmentos: any[]
  soldHours: number
  totalSegmentos: number
}) {
  const router = useRouter()
  const [form, setForm] = useState({ desde: '', hasta: '', horas: '', notas: '' })
  const [loading, setLoading] = useState(false)
  const disponible = soldHours - totalSegmentos

  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    const horas = parseFloat(form.horas)
    if (horas > disponible) { alert('Las horas superan el disponible del proyecto'); return }
    setLoading(true)
    await createClient().from('project_hour_segments').insert({
      project_id: projectId, desde: form.desde, hasta: form.hasta,
      horas, notas: form.notas || null,
    })
    setForm({ desde: '', hasta: '', horas: '', notas: '' })
    router.refresh()
    setLoading(false)
  }

  async function eliminar(id: string) {
    await createClient().from('project_hour_segments').delete().eq('id', id)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
      <p className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
        <Calendar size={14} className="text-[#1B9BF0]"/> Segmentos de horas
      </p>
      <p className="text-xs text-gray-400 mb-4">
        Total asignado: <strong>{totalSegmentos}h</strong> · Disponible: <strong className={disponible < 0 ? 'text-red-500' : 'text-green-600'}>{disponible}h</strong>
      </p>

      <form onSubmit={agregar} className="space-y-2 mb-4">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Desde</label>
            <input type="date" value={form.desde} onChange={e => setForm(f => ({ ...f, desde: e.target.value }))} required
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Hasta</label>
            <input type="date" value={form.hasta} onChange={e => setForm(f => ({ ...f, hasta: e.target.value }))} required
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Horas (máx {disponible})</label>
            <input type="number" min="0" step="0.5" max={disponible} value={form.horas}
              onChange={e => setForm(f => ({ ...f, horas: e.target.value }))} placeholder="100" required
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
        </div>
        <input type="text" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
          placeholder="Notas del segmento"
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        <button type="submit" disabled={loading || disponible <= 0}
          className="w-full py-2 bg-gray-900 hover:bg-gray-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
          <Plus size={13}/> Agregar segmento
        </button>
      </form>

      {segmentos.length > 0 && (
        <div className="space-y-2 border-t border-gray-50 pt-3">
          {segmentos.map(s => (
            <div key={s.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-xs font-medium text-gray-700">{s.horas}h</p>
                <p className="text-xs text-gray-400">
                  {new Date(s.desde).toLocaleDateString('es-AR')} → {new Date(s.hasta).toLocaleDateString('es-AR')}
                  {s.notas && ' · ' + s.notas}
                </p>
              </div>
              <button onClick={() => eliminar(s.id)}
                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all">
                <Trash2 size={13}/>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
