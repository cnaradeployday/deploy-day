'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Calendar, Check } from 'lucide-react'

interface Segmento { desde: string; hasta: string; horas: string; notas: string }

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

const now = new Date()
const DEFAULT_DESDE = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
const DEFAULT_HASTA = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`

export default function ProyectoSegmentos({ projectId, segmentos, soldHours, totalSegmentos, timeEntries, taskIds }: {
  projectId: string
  segmentos: any[]
  soldHours: number
  totalSegmentos: number
  timeEntries?: any[]
  taskIds?: string[]
}) {
  const router = useRouter()
  const [pendientes, setPendientes] = useState<Segmento[]>([{ desde: DEFAULT_DESDE, hasta: DEFAULT_HASTA, horas: '', notas: '' }])
  const [saving, setSaving] = useState(false)

  const horasPendientes = pendientes.reduce((acc, s) => acc + (parseFloat(s.horas) || 0), 0)
  const disponible = soldHours - totalSegmentos
  const disponibleReal = disponible - horasPendientes

  function updatePendiente(i: number, k: keyof Segmento, v: string) {
    setPendientes(prev => prev.map((s, idx) => idx === i ? { ...s, [k]: v } : s))
  }

  function agregarFila() {
    setPendientes(prev => [...prev, { desde: DEFAULT_DESDE, hasta: DEFAULT_HASTA, horas: '', notas: '' }])
  }

  function quitarFila(i: number) {
    if (pendientes.length === 1) {
      setPendientes([{ desde: DEFAULT_DESDE, hasta: DEFAULT_HASTA, horas: '', notas: '' }])
      return
    }
    setPendientes(prev => prev.filter((_, idx) => idx !== i))
  }

  async function guardarTodos(e: React.FormEvent) {
    e.preventDefault()
    const validos = pendientes.filter(s => s.horas && s.desde && s.hasta)
    if (!validos.length) return
    const totalNuevo = validos.reduce((acc, s) => acc + parseFloat(s.horas), 0)
    if (totalNuevo > disponible) {
      alert(`Las horas ingresadas (${totalNuevo}h) superan el disponible (${disponible}h)`)
      return
    }
    setSaving(true)
    await createClient().from('project_hour_segments').insert(
      validos.map(s => ({
        project_id: projectId,
        desde: s.desde,
        hasta: s.hasta,
        horas: parseFloat(s.horas),
        notas: s.notas || null,
      }))
    )
    setPendientes([{ desde: DEFAULT_DESDE, hasta: DEFAULT_HASTA, horas: '', notas: '' }])
    router.refresh()
    setSaving(false)
  }

  async function eliminar(id: string) {
    await createClient().from('project_hour_segments').delete().eq('id', id)
    router.refresh()
  }

  function horasConsumidasEnSegmento(desde: string, hasta: string) {
    if (!timeEntries?.length) return 0
    return Math.round(
      timeEntries
        .filter(e => e.entry_date >= desde && e.entry_date <= hasta)
        .reduce((s, e) => s + e.hours_logged, 0) * 10
    ) / 10
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Calendar size={14} className="text-[#1B9BF0]"/> Segmentos de horas
        </p>
        <button type="button" onClick={agregarFila}
          className="flex items-center gap-1 text-xs text-[#1B9BF0] hover:underline">
          <Plus size={12}/> Agregar segmento
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        Asignado: <strong>{totalSegmentos}h</strong>
        {horasPendientes > 0 && <span className="text-amber-500"> + {horasPendientes}h pendiente de guardar</span>}
        {' · '}Disponible: <strong className={disponibleReal < 0 ? 'text-red-500' : 'text-green-600'}>{disponibleReal}h</strong>
        {' de '}{soldHours}h totales
      </p>

      <form onSubmit={guardarTodos} className="space-y-3 mb-4">
        {pendientes.map((seg, i) => (
          <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500">Segmento {totalSegmentos > 0 ? totalSegmentos + i + 1 : i + 1}</span>
              <button type="button" onClick={() => quitarFila(i)} className="text-gray-300 hover:text-red-400 transition-all">
                <Trash2 size={13}/>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Desde</label>
                <input type="date" value={seg.desde}
                  onChange={e => updatePendiente(i, 'desde', e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white"/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Hasta</label>
                <input type="date" value={seg.hasta}
                  onChange={e => updatePendiente(i, 'hasta', e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white"/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Horas</label>
                <input type="number" min="0" step="0.5" value={seg.horas}
                  onChange={e => updatePendiente(i, 'horas', e.target.value)}
                  placeholder="50" required
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white"/>
              </div>
            </div>
            <input type="text" value={seg.notas}
              onChange={e => updatePendiente(i, 'notas', e.target.value)}
              placeholder="Notas del segmento (opcional)"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white"/>
          </div>
        ))}

        {disponible > 0 && (
          <button type="submit" disabled={saving || disponibleReal < 0}
            className="w-full py-2 bg-gray-900 hover:bg-gray-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            <Check size={13}/>
            {saving ? 'Guardando...' : `Guardar ${pendientes.length > 1 ? pendientes.length + ' segmentos' : 'segmento'}`}
          </button>
        )}
        {disponible <= 0 && (
          <p className="text-xs text-center text-red-400">Todas las horas del proyecto ya están asignadas</p>
        )}
      </form>

      {segmentos.length > 0 && (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-400 mb-2">Segmentos guardados</p>
          {segmentos.map(s => (
            <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <p className="text-xs font-semibold text-gray-700">{s.horas}h est.</p>
                  <p className="text-xs text-green-600 font-medium">{horasConsumidasEnSegmento(s.desde, s.hasta)}h cons.</p>
                </div>
                <p className="text-xs text-gray-400">
                  {formatDate(s.desde)} → {formatDate(s.hasta)}
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
