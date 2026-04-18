'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { Download, Pencil, CheckCircle, X, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const statusColors: Record<string, string> = {
  creado: 'bg-gray-100 text-gray-500', estimado: 'bg-blue-50 text-blue-600',
  en_proceso: 'bg-amber-50 text-amber-600', terminado: 'bg-green-50 text-green-600',
  presentado: 'bg-purple-50 text-purple-600',
}
const statusLabels: Record<string, string> = {
  creado: 'Creado', estimado: 'Iniciado', en_proceso: 'En proceso',
  terminado: 'Terminado', presentado: 'Presentado'
}
const priorityColors: Record<string, string> = {
  baja: 'bg-gray-100 text-gray-400', media: 'bg-blue-50 text-blue-500',
  alta: 'bg-amber-50 text-amber-600', critica: 'bg-red-50 text-red-600'
}
const nextStatus: Record<string, string> = {
  creado: 'estimado', estimado: 'en_proceso', en_proceso: 'terminado', terminado: 'presentado'
}
const nextLabel: Record<string, string> = {
  creado: 'Iniciar', estimado: 'En proceso', en_proceso: 'Terminar', terminado: 'Presentar'
}

interface Props {
  tareas: any[]
  proyectos: { value: string; label: string }[]
  clientes: { value: string; label: string }[]
  filters: Record<string, string | undefined>
  mesActual: string
}

export default function MisTareasClient({ tareas, proyectos, clientes, filters, mesActual }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const update = useCallback((key: string, value: string) => {
    const p = new URLSearchParams(params.toString())
    if (value) p.set(key, value); else p.delete(key)
    router.push(pathname + '?' + p.toString())
  }, [params, pathname, router])

  const clear = () => router.push(pathname)
  const hasFilters = Object.values(filters).some(v => v && v !== filters.mes)

  const meses: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    meses.push(d.toISOString().slice(0, 7))
  }
  function nombreMes(m: string) {
    return new Date(m + '-15').toLocaleString('es-AR', { month: 'long', year: 'numeric' })
  }

  const mes = filters.mes ?? mesActual

  // KPIs usando MIS horas (my_assigned_hours), no el total de la tarea
  const totalEstimadas = tareas.reduce((s, t) => s + (t.my_assigned_hours ?? t.estimated_hours ?? 0), 0)
  const totalUsadas = tareas.reduce((s, t) => s + (t.hours_logged ?? 0), 0)
  const totalRestantes = totalEstimadas - totalUsadas

  async function advanceStatus(taskId: string, status: string) {
    if (!nextStatus[status]) return
    await createClient().from('tasks').update({ status: nextStatus[status] }).eq('id', taskId)
    router.refresh()
  }

  function exportar() {
    const data = tareas.map(t => ({
      Tarea: t.title,
      Rol: t.es_colaborador ? 'Colaborador' : 'Responsable',
      Cliente: t.project?.client?.name ?? '—',
      Proyecto: t.project?.name ?? '—',
      Estado: statusLabels[t.status] ?? t.status,
      Prioridad: t.priority,
      'Mis horas est.': t.my_assigned_hours ?? t.estimated_hours ?? '—',
      'Horas usadas': t.hours_logged ?? 0,
      Vence: t.due_date ? new Date(t.due_date).toLocaleDateString('es-AR') : '—',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Mis tareas')
    XLSX.writeFile(wb, 'mis-tareas-' + mes + '.xlsx')
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Mis tareas</h1>
          <p className="text-sm text-gray-400 mt-0.5 capitalize">{nombreMes(mes)} · {tareas.length} tarea{tareas.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mes} onChange={e => update('mes', e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white capitalize">
            {meses.map(m => <option key={m} value={m}>{nombreMes(m)}</option>)}
          </select>
          <button onClick={exportar}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            <Download size={14}/> Excel
          </button>
          <Link href="/tareas/nueva"
            className="flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
            <Plus size={15}/> Nueva tarea
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Horas estimadas', value: Math.round(totalEstimadas * 10) / 10, color: 'text-gray-900' },
          { label: 'Horas usadas', value: Math.round(totalUsadas * 10) / 10, color: 'text-[#1B9BF0]' },
          { label: 'Restantes', value: Math.round(totalRestantes * 10) / 10, color: totalRestantes < 0 ? 'text-red-500' : 'text-green-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400">{label}</p>
            <p className={'text-xl font-bold mt-0.5 ' + color}>{value}h</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Estado</label>
            <select value={filters.status ?? ''} onChange={e => update('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Todos</option>
              {Object.entries(statusLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Prioridad</label>
            <select value={filters.priority ?? ''} onChange={e => update('priority', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Todas</option>
              {['baja','media','alta','critica'].map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Cliente</label>
            <select value={filters.cliente ?? ''} onChange={e => update('cliente', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Todos</option>
              {clientes.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Proyecto</label>
            <select value={filters.proyecto ?? ''} onChange={e => update('proyecto', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Todos</option>
              {proyectos.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>
        {hasFilters && (
          <div className="flex justify-end mt-3 pt-3 border-t border-gray-50">
            <button onClick={clear} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
              <X size={12}/> Limpiar
            </button>
          </div>
        )}
      </div>

      {/* Tabla desktop */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-50">
              {['Tarea','Rol','Cliente','Proyecto','Responsable','Est.','Usado','Vence','Prioridad','Estado',''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!tareas.length ? (
              <tr><td colSpan={11} className="text-center py-12 text-sm text-gray-400">Sin tareas asignadas en {nombreMes(mes)}</td></tr>
            ) : tareas.map(t => {
              const isOverdue = t.due_date && new Date(t.due_date) < new Date() && !['terminado','presentado'].includes(t.status)
              const myHours = t.my_assigned_hours ?? t.estimated_hours
              const pct = myHours ? Math.min(100, Math.round(((t.hours_logged ?? 0) / myHours) * 100)) : null
              return (
                <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[160px] truncate">{t.title}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${t.es_colaborador ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                      {t.es_colaborador ? 'Colaborador' : 'Responsable'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{t.project?.client?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{t.project?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{t.direct_responsible?.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{myHours ? myHours+'h' : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={'text-xs font-medium ' + (pct && pct > 90 ? 'text-red-500' : 'text-gray-500')}>{t.hours_logged ?? 0}h</span>
                      {pct !== null && (
                        <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={'h-full rounded-full ' + (pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-amber-400' : 'bg-[#1B9BF0]')}
                            style={{ width: Math.min(100, pct) + '%' }}/>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className={'px-4 py-3 text-xs whitespace-nowrap ' + (isOverdue ? 'text-red-500 font-medium' : 'text-gray-500')}>
                    {t.due_date ? new Date(t.due_date).toLocaleDateString('es-AR', { day:'numeric', month:'short' }) : '—'}
                  </td>
                  <td className="px-4 py-3"><span className={'text-xs px-2 py-0.5 rounded-full ' + priorityColors[t.priority]}>{t.priority}</span></td>
                  <td className="px-4 py-3"><span className={'text-xs px-2 py-0.5 rounded-full ' + statusColors[t.status]}>{statusLabels[t.status]}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link href={'/tareas/' + t.id + '/editar'}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
                        <Pencil size={13}/>
                      </Link>
                      {nextStatus[t.status] && (
                        <button onClick={() => advanceStatus(t.id, t.status)} title={nextLabel[t.status]}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-all">
                          <CheckCircle size={13}/>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-2">
        {tareas.map(t => {
          const isOverdue = t.due_date && new Date(t.due_date) < new Date() && !['terminado','presentado'].includes(t.status)
          return (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-medium text-gray-900 flex-1 pr-2">{t.title}</p>
                <span className={'text-xs px-2 py-0.5 rounded-full shrink-0 ' + statusColors[t.status]}>{statusLabels[t.status]}</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${t.es_colaborador ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                  {t.es_colaborador ? 'Colaborador' : 'Responsable'}
                </span>
                <span className="text-xs text-gray-400">{t.project?.client?.name} · {t.project?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {t.due_date && <span className={isOverdue ? 'text-red-500' : ''}>{new Date(t.due_date).toLocaleDateString('es-AR', { day:'numeric', month:'short' })}</span>}
                  <span>{t.hours_logged ?? 0}h{(t.my_assigned_hours ?? t.estimated_hours) ? '/'+(t.my_assigned_hours ?? t.estimated_hours)+'h' : ''}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Link href={'/tareas/' + t.id + '/editar'} className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B9BF0] hover:bg-blue-50">
                    <Pencil size={14}/>
                  </Link>
                  {nextStatus[t.status] && (
                    <button onClick={() => advanceStatus(t.id, t.status)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50">
                      <CheckCircle size={14}/>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
