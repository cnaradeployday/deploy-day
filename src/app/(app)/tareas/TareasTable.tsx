'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { X, ChevronUp, ChevronDown, CheckCircle, Trash2, Pencil } from 'lucide-react'

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
const nextStatusLabel: Record<string, string> = {
  creado: 'Estimar', estimado: 'Iniciar', en_proceso: 'Terminar', terminado: 'Presentar'
}

function mesDeDate(d: string | null) {
  if (!d) return ''
  return d.slice(0, 7)
}
function nombreMes(m: string) {
  if (!m) return '—'
  return new Date(m + '-15').toLocaleString('es-AR', { month: 'long', year: 'numeric' })
}

function MultiSelect({ label, options, selected, onChange }: {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (vals: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const toggle = (val: string) => {
    if (selected.includes(val)) onChange(selected.filter(v => v !== val))
    else onChange([...selected, val])
  }
  return (
    <div className="relative">
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <button type="button" onClick={() => setOpen(!open)}
        className={"w-full px-3 py-2 border rounded-xl text-xs text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white " + (selected.length > 0 ? 'border-[#1B9BF0] text-[#1B9BF0]' : 'border-gray-200 text-gray-500')}>
        <span className="truncate">{selected.length === 0 ? 'Todos' : selected.length === 1 ? (options.find(o => o.value === selected[0])?.label ?? selected[0]) : selected.length + ' seleccionados'}</span>
        <ChevronDown size={11} className="shrink-0 ml-1"/>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)}/>
          <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-52 overflow-y-auto">
            {options.map(o => (
              <label key={o.value} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer text-xs text-gray-700">
                <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)}
                  className="rounded border-gray-300"/>
                <span className="truncate">{o.label}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

interface Tarea {
  id: string; title: string; status: string; priority: string
  due_date: string; estimated_hours: number | null; hours_logged: number
  project: any; direct_responsible: any
}

export default function TareasTable({ tareas, clientes, proyectos, usuarios, filters, hideColumns = [] }: {
  tareas: Tarea[]
  clientes: { value: string; label: string }[]
  proyectos: { value: string; label: string }[]
  usuarios: { value: string; label: string }[]
  filters: Record<string, string | undefined>
  hideColumns?: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [sortKey, setSortKey] = useState('due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [loading, setLoading] = useState<string | null>(null)

  const [selStatus, setSelStatus] = useState<string[]>([])
  const [selPriority, setSelPriority] = useState<string[]>([])
  const [selCliente, setSelCliente] = useState<string[]>([])
  const [selProyecto, setSelProyecto] = useState<string[]>([])
  const [selResponsable, setSelResponsable] = useState<string[]>([])
  const [selMes, setSelMes] = useState<string[]>([])

  const clear = () => {
    setSelStatus([]); setSelPriority([]); setSelCliente([])
    setSelProyecto([]); setSelResponsable([]); setSelMes([])
    router.push(pathname)
  }

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const mesesUnicos = useMemo(() =>
    [...new Set(tareas.map(t => mesDeDate(t.due_date)).filter(Boolean))].sort(),
    [tareas]
  )

  const filtered = useMemo(() => {
    return tareas.filter(t => {
      if (selStatus.length && !selStatus.includes(t.status)) return false
      if (selPriority.length && !selPriority.includes(t.priority)) return false
      if (selCliente.length && !selCliente.includes(t.project?.client?.id ?? '')) return false
      if (selProyecto.length && !selProyecto.includes(t.project?.id ?? '')) return false
      if (selResponsable.length && !selResponsable.includes(t.direct_responsible?.id ?? '')) return false
      if (selMes.length && !selMes.includes(mesDeDate(t.due_date))) return false
      return true
    })
  }, [tareas, selStatus, selPriority, selCliente, selProyecto, selResponsable, selMes])

  const sorted = [...filtered].sort((a, b) => {
    let va: string, vb: string
    if (sortKey === 'client') { va = a.project?.client?.name ?? ''; vb = b.project?.client?.name ?? '' }
    else if (sortKey === 'project') { va = a.project?.name ?? ''; vb = b.project?.name ?? '' }
    else if (sortKey === 'responsible') { va = a.direct_responsible?.full_name ?? ''; vb = b.direct_responsible?.full_name ?? '' }
    else if (sortKey === 'mes') { va = mesDeDate(a.due_date); vb = mesDeDate(b.due_date) }
    else { va = String((a as any)[sortKey] ?? ''); vb = String((b as any)[sortKey] ?? '') }
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
  })

  const totalEstimadas = filtered.reduce((s, t) => s + (t.estimated_hours ?? 0), 0)
  const totalUsadas = filtered.reduce((s, t) => s + (t.hours_logged ?? 0), 0)
  const totalRestantes = totalEstimadas - totalUsadas

  async function advanceStatus(taskId: string, currentStatus: string) {
    if (!nextStatus[currentStatus]) return
    setLoading(taskId)
    await createClient().from('tasks').update({ status: nextStatus[currentStatus] }).eq('id', taskId)
    router.refresh()
    setLoading(null)
  }

  async function deleteTask(taskId: string) {
    if (!confirm('Eliminar esta tarea?')) return
    setLoading(taskId)
    const sb = createClient()
    await sb.from('time_entries').delete().eq('task_id', taskId)
    await sb.from('task_collaborators').delete().eq('task_id', taskId)
    await sb.from('task_comments').delete().eq('task_id', taskId)
    await sb.from('tasks').delete().eq('id', taskId)
    router.refresh()
    setLoading(null)
  }

  const show = (col: string) => !hideColumns.includes(col)
  const SortIcon = ({ k }: { k: string }) => {
    if (sortKey !== k) return <ChevronUp size={12} className="opacity-20"/>
    return sortDir === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>
  }

  const hasFilters = selStatus.length || selPriority.length || selCliente.length ||
    selProyecto.length || selResponsable.length || selMes.length

  return (
    <div>
      {/* Contadores */}
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

      {/* Filtros multi-select */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MultiSelect label="Mes" options={mesesUnicos.map(m => ({ value: m, label: nombreMes(m) }))} selected={selMes} onChange={setSelMes}/>
          <MultiSelect label="Estado" options={Object.entries(statusLabels).map(([v, l]) => ({ value: v, label: l }))} selected={selStatus} onChange={setSelStatus}/>
          <MultiSelect label="Prioridad" options={['baja','media','alta','critica'].map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))} selected={selPriority} onChange={setSelPriority}/>
          {show('client') && <MultiSelect label="Cliente" options={clientes} selected={selCliente} onChange={setSelCliente}/>}
          <MultiSelect label="Proyecto" options={proyectos} selected={selProyecto} onChange={setSelProyecto}/>
          {show('responsible') && <MultiSelect label="Responsable" options={usuarios} selected={selResponsable} onChange={setSelResponsable}/>}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
          <span className="text-xs text-gray-400">{sorted.length} de {tareas.length} tareas</span>
          {hasFilters && (
            <button onClick={clear} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
              <X size={12}/> Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabla desktop */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50">
              {[
                { key: 'mes', label: 'Mes', show: true },
                { key: 'title', label: 'Tarea', show: true },
                { key: 'client', label: 'Cliente', show: show('client') },
                { key: 'project', label: 'Proyecto', show: show('project') },
                { key: 'responsible', label: 'Responsable', show: show('responsible') },
                { key: 'estimated_hours', label: 'Est.', show: true },
                { key: 'hours_logged', label: 'Usado', show: true },
                { key: 'due_date', label: 'Vence', show: true },
                { key: 'priority', label: 'Prioridad', show: true },
                { key: 'status', label: 'Estado', show: true },
                { key: 'actions', label: '', show: true },
              ].filter(c => c.show).map(({ key, label }) => (
                <th key={key} onClick={() => key !== 'actions' && toggleSort(key)}
                  className={'px-3 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap ' + (key !== 'actions' ? 'cursor-pointer hover:text-gray-600 select-none' : '')}>
                  <div className="flex items-center gap-1">{label}{key !== 'actions' && <SortIcon k={key}/>}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!sorted.length ? (
              <tr><td colSpan={11} className="text-center py-12 text-sm text-gray-400">Sin tareas</td></tr>
            ) : sorted.map(t => {
              const isOverdue = t.due_date && new Date(t.due_date) < new Date() && !['terminado','presentado'].includes(t.status)
              const pct = t.estimated_hours ? Math.round((t.hours_logged / t.estimated_hours) * 100) : null
              const mes = mesDeDate(t.due_date)
              return (
                <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap capitalize">
                    {mes ? new Date(mes + '-15').toLocaleString('es-AR', { month: 'short', year: '2-digit' }) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-sm font-medium text-gray-900 max-w-[180px] truncate">{t.title}</td>
                  {show('client') && <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{t.project?.client?.name ?? '—'}</td>}
                  {show('project') && <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{t.project?.name ?? '—'}</td>}
                  {show('responsible') && <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{t.direct_responsible?.full_name ?? '—'}</td>}
                  <td className="px-3 py-2.5 text-xs text-gray-500">{t.estimated_hours ? t.estimated_hours + 'h' : '—'}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className={'text-xs font-medium ' + (pct && pct > 90 ? 'text-red-500' : 'text-gray-500')}>{t.hours_logged}h</span>
                      {pct !== null && (
                        <div className="w-10 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={'h-full rounded-full ' + (pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-amber-400' : 'bg-[#1B9BF0]')}
                            style={{ width: Math.min(100, pct) + '%' }}/>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className={'px-3 py-2.5 text-xs whitespace-nowrap ' + (isOverdue ? 'text-red-500 font-medium' : 'text-gray-500')}>
                    {t.due_date ? new Date(t.due_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '—'}
                  </td>
                  <td className="px-3 py-2.5"><span className={'text-xs px-2 py-0.5 rounded-full ' + priorityColors[t.priority]}>{t.priority}</span></td>
                  <td className="px-3 py-2.5"><span className={'text-xs px-2 py-0.5 rounded-full ' + statusColors[t.status]}>{statusLabels[t.status]}</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-0.5">
                      <Link href={'/tareas/' + t.id} title="Ver"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
                        <Pencil size={12}/>
                      </Link>
                      {nextStatus[t.status] && (
                        <button onClick={() => advanceStatus(t.id, t.status)} disabled={loading === t.id}
                          title={nextStatusLabel[t.status]}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-all">
                          <CheckCircle size={12}/>
                        </button>
                      )}
                      <button onClick={() => deleteTask(t.id)} disabled={loading === t.id}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
                        <Trash2 size={12}/>
                      </button>
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
        {sorted.map(t => {
          const isOverdue = t.due_date && new Date(t.due_date) < new Date() && !['terminado','presentado'].includes(t.status)
          return (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-medium text-gray-900 flex-1 pr-2">{t.title}</p>
                <span className={'text-xs px-2 py-0.5 rounded-full shrink-0 ' + statusColors[t.status]}>{statusLabels[t.status]}</span>
              </div>
              <p className="text-xs text-gray-400 mb-3">{t.project?.client?.name} · {t.project?.name}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {t.due_date && <span className={isOverdue ? 'text-red-500' : ''}>{new Date(t.due_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>}
                  <span>{t.hours_logged}h{t.estimated_hours ? '/' + t.estimated_hours + 'h' : ''}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Link href={'/tareas/' + t.id} className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B9BF0] hover:bg-blue-50"><Pencil size={14}/></Link>
                  {nextStatus[t.status] && (
                    <button onClick={() => advanceStatus(t.id, t.status)} disabled={loading === t.id}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50"><CheckCircle size={14}/></button>
                  )}
                  <button onClick={() => deleteTask(t.id)} disabled={loading === t.id}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={14}/></button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
