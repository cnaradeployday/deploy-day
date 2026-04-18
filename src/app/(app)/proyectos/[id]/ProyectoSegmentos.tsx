'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Check, Trash2, Plus } from 'lucide-react'

function primerDia(anio: number, mes: number) {
  return `${anio}-${String(mes).padStart(2, '0')}-01`
}
function ultimoDia(anio: number, mes: number) {
  return new Date(anio, mes, 0).toISOString().split('T')[0]
}
function labelMes(yyyy_mm: string) {
  return new Date(yyyy_mm + '-15').toLocaleString('es-AR', { month: 'long', year: 'numeric' })
}

// Generar lista de meses: 3 antes hasta 12 adelante desde hoy
function generarMeses() {
  const meses: string[] = []
  const now = new Date()
  for (let i = -3; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return meses
}

export default function ProyectoSegmentos({ projectId, segmentos, soldHours, totalSegmentos, timeEntries }: {
  projectId: string
  segmentos: any[]
  soldHours: number
  totalSegmentos: number
  timeEntries?: any[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Estado de edición: mes → horas (string para el input)
  const [editando, setEditando] = useState<Record<string, string>>({})
  const [mesAbierto, setMesAbierto] = useState<string | null>(null)

  const meses = generarMeses()

  // Mapa de segmentos existentes por mes (YYYY-MM)
  const segmentosPorMes = useMemo(() => {
    const map: Record<string, any> = {}
    segmentos.forEach(s => {
      const mes = s.desde?.slice(0, 7)
      if (mes) map[mes] = s
    })
    return map
  }, [segmentos])

  // Horas consumidas por mes
  function horasConsumidasMes(mes: string) {
    if (!timeEntries?.length) return 0
    const desde = primerDia(parseInt(mes.split('-')[0]), parseInt(mes.split('-')[1]))
    const hasta = ultimoDia(parseInt(mes.split('-')[0]), parseInt(mes.split('-')[1]))
    return Math.round(
      timeEntries.filter(e => e.entry_date >= desde && e.entry_date <= hasta)
        .reduce((s, e) => s + e.hours_logged, 0) * 10
    ) / 10
  }

  const disponible = soldHours - totalSegmentos

  async function guardarMes(mes: string) {
    const horas = parseFloat(editando[mes] ?? '0')
    if (!horas || isNaN(horas)) return

    const [anio, mesNum] = mes.split('-').map(Number)
    setSaving(true)

    const existente = segmentosPorMes[mes]
    if (existente) {
      // Actualizar
      await createClient().from('project_hour_segments').update({
        horas,
        desde: primerDia(anio, mesNum),
        hasta: ultimoDia(anio, mesNum),
      }).eq('id', existente.id)
    } else {
      // Insertar
      const totalConNuevo = totalSegmentos + horas
      if (totalConNuevo > soldHours) {
        alert(`Superás las horas vendidas. Disponible: ${disponible}h`)
        setSaving(false)
        return
      }
      await createClient().from('project_hour_segments').insert({
        project_id: projectId,
        desde: primerDia(anio, mesNum),
        hasta: ultimoDia(anio, mesNum),
        horas,
        notas: null,
      })
    }

    setEditando(e => { const n = { ...e }; delete n[mes]; return n })
    setMesAbierto(null)
    router.refresh()
    setSaving(false)
  }

  async function eliminarMes(mes: string) {
    const seg = segmentosPorMes[mes]
    if (!seg) return
    setDeletingId(seg.id)
    await createClient().from('project_hour_segments').delete().eq('id', seg.id)
    router.refresh()
    setDeletingId(null)
  }

  // Meses que ya tienen segmento
  const mesesConSegmento = Object.keys(segmentosPorMes).sort()
  // Meses disponibles para agregar (que no tienen segmento aún)
  const mesesDisponibles = meses.filter(m => !segmentosPorMes[m])

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Calendar size={14} className="text-[#1B9BF0]"/> Distribución de horas por mes
        </p>
        <button type="button" onClick={() => setMesAbierto(mesAbierto ? null : (mesesDisponibles[0] ?? null))}
          className="flex items-center gap-1 text-xs text-[#1B9BF0] hover:underline">
          <Plus size={12}/> Agregar mes
        </button>
      </div>

      <p className="text-xs text-gray-400 mb-4">
        Asignado: <strong>{totalSegmentos}h</strong>
        {' · '}Disponible: <strong className={disponible < 0 ? 'text-red-500' : 'text-green-600'}>{disponible}h</strong>
        {' de '}<strong>{soldHours}h</strong> vendidas
      </p>

      {/* Formulario para agregar mes nuevo */}
      {mesAbierto !== null && (
        <div className="border border-[#1B9BF0]/20 bg-blue-50/30 rounded-xl p-3 mb-4 space-y-2">
          <p className="text-xs font-medium text-gray-600">Nuevo mes</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Mes</label>
              <select value={mesAbierto} onChange={e => setMesAbierto(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] capitalize">
                {mesesDisponibles.map(m => (
                  <option key={m} value={m}>{labelMes(m)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Horas (máx {disponible}h)</label>
              <input type="number" min="0" step="0.5" max={disponible}
                value={editando[mesAbierto] ?? ''}
                onChange={e => setEditando(ed => ({ ...ed, [mesAbierto!]: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setMesAbierto(null); setEditando({}) }}
              className="flex-1 py-1.5 border border-gray-200 rounded-xl text-xs text-gray-500 hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={() => mesAbierto && guardarMes(mesAbierto)} disabled={saving || !editando[mesAbierto]}
              className="flex-1 py-1.5 bg-[#1B9BF0] text-white rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1">
              <Check size={12}/> {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de meses con segmento */}
      {mesesConSegmento.length === 0 && mesAbierto === null ? (
        <p className="text-xs text-gray-300 text-center py-4">Sin distribución cargada</p>
      ) : (
        <div className="space-y-1">
          {/* Header */}
          {mesesConSegmento.length > 0 && (
            <div className="grid grid-cols-12 px-2 py-1 text-xs text-gray-400 font-medium border-b border-gray-50">
              <span className="col-span-4">Mes</span>
              <span className="col-span-2 text-right">Asignadas</span>
              <span className="col-span-2 text-right">Consumidas</span>
              <span className="col-span-2 text-right">%</span>
              <span className="col-span-2"/>
            </div>
          )}
          {mesesConSegmento.map(mes => {
            const seg = segmentosPorMes[mes]
            const consumidas = horasConsumidasMes(mes)
            const pct = seg.horas > 0 ? Math.round((consumidas / seg.horas) * 100) : 0
            const isEditing = editando[mes] !== undefined
            return (
              <div key={mes} className="grid grid-cols-12 px-2 py-2 items-center hover:bg-gray-50 rounded-lg">
                <div className="col-span-4">
                  <p className="text-xs font-medium text-gray-700 capitalize">{labelMes(mes)}</p>
                </div>
                <div className="col-span-2 text-right">
                  {isEditing ? (
                    <input type="number" min="0" step="0.5" autoFocus
                      value={editando[mes]}
                      onChange={e => setEditando(ed => ({ ...ed, [mes]: e.target.value }))}
                      onBlur={() => guardarMes(mes)}
                      onKeyDown={e => { if (e.key === 'Enter') guardarMes(mes); if (e.key === 'Escape') setEditando(ed => { const n={...ed}; delete n[mes]; return n }) }}
                      className="w-16 px-2 py-1 border border-[#1B9BF0] rounded-lg text-xs text-right focus:outline-none"/>
                  ) : (
                    <button onClick={() => setEditando(ed => ({ ...ed, [mes]: String(seg.horas) }))}
                      className="text-xs font-semibold text-gray-900 hover:text-[#1B9BF0] transition-colors">
                      {seg.horas}h
                    </button>
                  )}
                </div>
                <div className="col-span-2 text-right">
                  <span className={`text-xs font-medium ${consumidas > seg.horas ? 'text-red-500' : 'text-green-600'}`}>
                    {consumidas}h
                  </span>
                </div>
                <div className="col-span-2 text-right">
                  <span className={`text-xs ${pct >= 100 ? 'text-red-500 font-bold' : pct >= 80 ? 'text-amber-500' : 'text-gray-400'}`}>
                    {pct}%
                  </span>
                </div>
                <div className="col-span-2 flex justify-end">
                  <button onClick={() => eliminarMes(mes)} disabled={deletingId === seg.id}
                    className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50">
                    <Trash2 size={12}/>
                  </button>
                </div>
              </div>
            )
          })}

          {/* Total */}
          {mesesConSegmento.length > 0 && (
            <div className="grid grid-cols-12 px-2 py-2 border-t border-gray-100 mt-1">
              <span className="col-span-4 text-xs font-semibold text-gray-600">Total</span>
              <span className="col-span-2 text-right text-xs font-bold text-gray-900">{totalSegmentos}h</span>
              <span className="col-span-2 text-right text-xs font-bold text-green-600">
                {mesesConSegmento.reduce((s, m) => s + horasConsumidasMes(m), 0)}h
              </span>
              <span className="col-span-4"/>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
