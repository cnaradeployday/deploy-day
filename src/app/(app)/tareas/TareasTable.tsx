'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { deleteTaskAction } from './actions'
import { X, ChevronUp, ChevronDown, RefreshCw, CheckCircle, Trash2, Pencil, Search, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

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

function mesDeDate(d: string | null) { if (!d) return ''; return d.slice(0, 7) }
function nombreMes(m: string) { if (!m) return '—'; return new Date(m + '-15').toLocaleString('es-AR', { month: 'long', year: 'numeric' }) }

interface Colaborador { id: string; assigned_hours: number | null; user: { id: string; full_name: string } | null }
interface Tarea {
  id: string; title: string; status: string; priority: string
  due_date: string; estimated_hours: number | null; hours_logged: number
  project: any; direct_responsible: any; task_collaborators?: Colaborador[]
}

function PersonChip({ name, assignedHours, usedHours }: { name: string; assignedHours: number | null; usedHours: number }) {
  const initials = name.split(' ').filter(Boolean).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="relative group inline-flex items-center gap-1">
      <span className="inline-flex items-center gap-1 cursor-default">
        <span className="w-5 h-5 rounded-full bg-[#E8F4FE] text-[#1B9BF0] text-[9px] font-bold flex items-center justify-center shrink-0">{initials}</span>
        <span className="truncate max-w-[80px] text-xs">{name.split(' ')[0]}</span>
      </span>
      <div className="absolute bottom-full left-0 mb-2 z-50 hidden group-hover:block pointer-events-none min-w-[160px]">
        <div className="bg-gray-900 text-white text-xs rounded-xl px-3 py-2 shadow-lg">
          <p className="font-semibold mb-1.5">{name}</p>
          <p className="text-gray-300">Hs. asignadas: <span className="text-white font-medium">{assignedHours != null ? assignedHours + 'h' : '—'}</span></p>
          <p className="text-gray-300">Hs. usadas: <span className="text-white font-medium">{Math.round(usedHours * 10) / 10}h</span></p>
        </div>
        <div className="w-2 h-2 bg-gray-900 rotate-45 ml-3 -mt-1"/>
      </div>
    </div>
  )
}

function MultiSelect({ label, options, selected, onChange, disabled }: { label: string; options: { value: string; label: string }[]; selected: string[]; onChange: (vals: string[]) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const toggle = (val: string) => { if (selected.includes(val)) onChange(selected.filter(v => v !== val)); else onChange([...selected, val]) }
  const filtered = search.trim() ? options.filter(o => o.label.toLowerCase().includes(search.trim().toLowerCase())) : options
  return (
    <div className="relative">
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <button type="button" disabled={disabled} onClick={() => { setOpen(!open); setSearch('') }} className={"w-full px-3 py-2 border rounded-xl text-xs text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white " + (disabled ? 'opacity-40 cursor-not-allowed ' : '') + (selected.length > 0 ? 'border-[#1B9BF0] text-[#1B9BF0]' : 'border-gray-200 text-gray-500')}>
        <span className="truncate">{selected.length === 0 ? 'Todos' : selected.length === 1 ? (options.find(o => o.value === selected[0])?.label ?? selected[0]) : selected.length + ' seleccionados'}</span>
        <ChevronDown size={11} className="shrink-0 ml-1"/>
      </button>
      {open && !disabled && (<>
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)}/>
        <div className="absolute top-full left-0 mt-1 w-60 bg-white border border-gray-200 rounded-xl shadow-lg z-20 flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? <p className="text-xs text-gray-400 px-3 py-3 text-center">Sin resultados</p>
              : filtered.map(o => (<label key={o.value} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer text-xs text-gray-700"><input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} className="rounded border-gray-300"/><span className="truncate">{o.label}</span></label>))}
          </div>
        </div>
      </>)}
    </div>
  )
}

export default function TareasTable({ tareas, clientes, proyectos, usuarios, filters, hideColumns = [], totalVendidas = 0, mesesDisponibles = [] }: { tareas: any[]; clientes: { value: string; label: string }[]; proyectos: { value: string; label: string; clientId?: string }[]; usuarios: { value: string; label: string }[]; filters: Record<string, string | undefined>; hideColumns?: string[]; totalVendidas?: number; mesesDisponibles?: string[] }) {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams()
  const [sortKey, setSortKey] = useState('due_date'); const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [loading, setLoading] = useState<string | null>(null); const [search, setSearch] = useState('')
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [selStatus, setSelStatus] = useState<string[]>([]); const [selPriority, setSelPriority] = useState<string[]>([])
  const [selCliente, setSelCliente] = useState<string[]>([]); const [selProyecto, setSelProyecto] = useState<string[]>([])
  const [selResponsable, setSelResponsable] = useState<string[]>([]); const [selMes, setSelMes] = useState<string[]>([])

  const proyectosFiltradosPorCliente = selCliente.length
    ? proyectos.filter(p => p.clientId && selCliente.includes(p.clientId))
    : proyectos

  function handleClienteChange(vals: string[]) {
    setSelCliente(vals)
    if (vals.length > 0) {
      const validIds = new Set(proyectos.filter(p => p.clientId && vals.includes(p.clientId)).map(p => p.value))
      setSelProyecto(prev => prev.filter(id => validIds.has(id)))
    }
  }

  const clear = () => { setSelStatus([]); setSelPriority([]); setSelCliente([]); setSelProyecto([]); setSelResponsable([]); setSelMes([]); setSearch(''); router.push(pathname) }
  function toggleSort(key: string) { if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir('asc') } }
  const mesesDeTareas = useMemo(() => [...new Set(tareas.map(t => mesDeDate(t.due_date)).filter(Boolean))].sort(), [tareas])
  const mesesUnicos = mesesDisponibles.length > 0 ? mesesDisponibles : mesesDeTareas

  const tareasVivas = tareas.filter(t => !deletedIds.includes(t.id))
  const filtered = useMemo(() => tareasVivas.filter(t => {
    if (selStatus.length && !selStatus.includes(t.status)) return false
    if (selPriority.length && !selPriority.includes(t.priority)) return false
    if (selCliente.length && !selCliente.includes(t.project?.client?.id ?? '')) return false
    if (selProyecto.length && !selProyecto.includes(t.project?.id ?? '')) return false
    if (selResponsable.length && !selResponsable.includes(t.direct_responsible?.id ?? '')) return false
    if (selMes.length && !selMes.includes(mesDeDate(t.due_date))) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      if (!t.title.toLowerCase().includes(q) && !(t.project?.client?.name ?? '').toLowerCase().includes(q) && !(t.project?.name ?? '').toLowerCase().includes(q) && !(t.direct_responsible?.full_name ?? '').toLowerCase().includes(q) && !(t.task_collaborators ?? []).some((c: any) => (c.user?.full_name ?? '').toLowerCase().includes(q))) return false
    }
    return true
  }), [tareasVivas, selStatus, selPriority, selCliente, selProyecto, selResponsable, selMes, search])

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'estimated_hours' || sortKey === 'hours_logged') { const na = Number((a as any)[sortKey] ?? 0); const nb = Number((b as any)[sortKey] ?? 0); return sortDir === 'asc' ? na - nb : nb - na }
    let va: string, vb: string
    if (sortKey === 'client') { va = a.project?.client?.name ?? ''; vb = b.project?.client?.name ?? '' }
    else if (sortKey === 'project') { va = a.project?.name ?? ''; vb = b.project?.name ?? '' }
    else if (sortKey === 'responsible') { va = a.direct_responsible?.full_name ?? ''; vb = b.direct_responsible?.full_name ?? '' }
    else if (sortKey === 'mes') { va = mesDeDate(a.due_date); vb = mesDeDate(b.due_date) }
    else if (sortKey === 'collaborators') { va = (a.task_collaborators ?? []).map((c: any) => c.user?.full_name ?? '').join(','); vb = (b.task_collaborators ?? []).map((c: any) => c.user?.full_name ?? '').join(',') }
    else { va = String((a as any)[sortKey] ?? ''); vb = String((b as any)[sortKey] ?? '') }
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
  })

  const totalEstimadas = filtered.reduce((s, t) => s + (t.estimated_hours ?? 0), 0)
  const totalUsadas = filtered.reduce((s, t) => s + (t.hours_logged ?? 0), 0)
  const totalRestantes = totalEstimadas - totalUsadas

  async function advanceStatus(taskId: string, currentStatus: string) { if (!nextStatus[currentStatus]) return; setLoading(taskId); await createClient().from('tasks').update({ status: nextStatus[currentStatus] }).eq('id', taskId); router.refresh(); setLoading(null) }
  async function deleteTask(taskId: string) {
    if (!confirm('Eliminar esta tarea?')) return
    setLoading(taskId)
    try {
      const result = await deleteTaskAction(taskId)
      if (result?.error) {
        alert('Error al eliminar: ' + result.error)
      } else {
        setDeletedIds(prev => [...prev, taskId])
      }
    } catch (e: any) {
      alert('Error al eliminar: ' + e.message)
    }
    setLoading(null)
  }

  function exportToExcel() {
    const rows = sorted.map(t => ({ Mes: mesDeDate(t.due_date) ? new Date(mesDeDate(t.due_date) + '-15').toLocaleString('es-AR', { month: 'long', year: 'numeric' }) : '—', Tarea: t.title, Cliente: t.project?.client?.name ?? '—', Proyecto: t.project?.name ?? '—', Responsable: t.direct_responsible?.full_name ?? '—', Colaboradores: (t.task_collaborators ?? []).map((c: any) => c.user?.full_name ?? '').filter(Boolean).join(', ') || '—', 'Horas estimadas': t.estimated_hours ?? '', 'Horas usadas': t.hours_logged, Vencimiento: t.due_date ? new Date(t.due_date).toLocaleDateString('es-AR') : '—', Prioridad: t.priority, Estado: statusLabels[t.status] ?? t.status }))
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Tareas'); XLSX.writeFile(wb, 'tareas.xlsx')
  }

  const show = (col: string) => !hideColumns.includes(col)
  const SortIcon = ({ k }: { k: string }) => { if (sortKey !== k) return <ChevronUp size={12} className="opacity-20"/>; return sortDir === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/> }
  const hasFilters = selStatus.length || selPriority.length || selCliente.length || selProyecto.length || selResponsable.length || selMes.length

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
          <input type="text" value={search} onChange={ev => setSearch(ev.target.value)} placeholder="Buscar por tarea, cliente o responsable..." className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={13}/></button>}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={exportToExcel} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 bg-white transition-all whitespace-nowrap"><Download size={14}/> Excel</button>
          <button onClick={() => router.refresh()} title="Refrescar" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 bg-white transition-all"><RefreshCw size={14}/></button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[{ label: 'Horas vendidas', value: Math.round(totalVendidas * 10) / 10, color: 'text-gray-900' }, { label: 'Horas estimadas', value: Math.round(totalEstimadas * 10) / 10, color: 'text-gray-700' }, { label: 'Horas usadas', value: Math.round(totalUsadas * 10) / 10, color: 'text-[#1B9BF0]' }, { label: 'Restantes', value: Math.round(totalRestantes * 10) / 10, color: totalRestantes < 0 ? 'text-red-500' : 'text-green-600' }].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 px-4 py-3"><p className="text-xs text-gray-400">{label}</p><p className={'text-xl font-bold mt-0.5 ' + color}>{value}h</p></div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MultiSelect label="Mes" options={mesesUnicos.map(m => ({ value: m, label: nombreMes(m) }))} selected={selMes} onChange={setSelMes}/>
          <MultiSelect label="Estado" options={Object.entries(statusLabels).map(([v, l]) => ({ value: v, label: l }))} selected={selStatus} onChange={setSelStatus}/>
          <MultiSelect label="Prioridad" options={['baja','media','alta','critica'].map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))} selected={selPriority} onChange={setSelPriority}/>
          {show('client') && <MultiSelect label="Cliente" options={clientes} selected={selCliente} onChange={handleClienteChange}/>}
          <MultiSelect label="Proyecto" options={proyectosFiltradosPorCliente} selected={selProyecto} onChange={setSelProyecto}/>
          {show('responsible') && <MultiSelect label="Responsable" options={usuarios} selected={selResponsable} onChange={setSelResponsable}/>}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
          <span className="text-xs text-gray-400">{sorted.length} de {tareas.length} tareas{search ? ' · "' + search + '"' : ''}</span>
          {(hasFilters || search) && <button onClick={clear} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"><X size={12}/> Limpiar filtros</button>}
        </div>
      </div>
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-50">
            {[{ key: 'mes', label: 'Mes', show: true }, { key: 'title', label: 'Tarea', show: true }, { key: 'client', label: 'Cliente', show: show('client') }, { key: 'project', label: 'Proyecto', show: show('project') }, { key: 'responsible', label: 'Responsable', show: show('responsible') }, { key: 'collaborators', label: 'Colaboradores', show: true }, { key: 'estimated_hours', label: 'Horas estimadas', show: true }, { key: 'hours_logged', label: 'Horas usadas', show: true }, { key: 'due_date', label: 'Vence', show: true }, { key: 'priority', label: 'Prioridad', show: true }, { key: 'status', label: 'Estado', show: true }, { key: 'actions', label: '', show: true }].filter(c => c.show).map(({ key, label }) => (
              <th key={key} onClick={() => key !== 'actions' && toggleSort(key)} className={'px-3 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap ' + (key !== 'actions' ? 'cursor-pointer hover:text-gray-600 select-none' : '')}>
                <div className="flex items-center gap-1">{label}{key !== 'actions' && <SortIcon k={key}/>}</div>
              </th>
            ))}
          </tr></thead>
          <tbody>
            {!sorted.length ? <tr><td colSpan={12} className="text-center py-12 text-sm text-gray-400">Sin tareas</td></tr>
            : sorted.map(t => {
              const isOverdue = t.due_date && new Date(t.due_date) < new Date() && !['terminado','presentado'].includes(t.status)
              const pct = t.estimated_hours ? Math.round((t.hours_logged / t.estimated_hours) * 100) : null
              const mes = mesDeDate(t.due_date); const collabs = t.task_collaborators ?? []
              return (
                <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap capitalize">{mes ? new Date(mes + '-15').toLocaleString('es-AR', { month: 'short', year: '2-digit' }) : '—'}</td>
                  <td className="px-3 py-2.5 text-sm font-medium text-gray-900 max-w-[180px] truncate">{t.title}</td>
                  {show('client') && <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{t.project?.client?.name ?? '—'}</td>}
                  {show('project') && <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{t.project?.name ?? '—'}</td>}
                  {show('responsible') && <td className="px-3 py-2.5">{t.direct_responsible ? <PersonChip name={t.direct_responsible.full_name} assignedHours={t.estimated_hours} usedHours={t.hours_logged}/> : <span className="text-gray-300 text-xs">—</span>}</td>}
                  <td className="px-3 py-2.5">{collabs.length === 0 ? <span className="text-gray-300 text-xs">—</span> : <div className="flex flex-wrap gap-1">{collabs.map((col: any) => col.user ? <PersonChip key={col.id} name={col.user.full_name} assignedHours={col.assigned_hours} usedHours={t.hours_logged}/> : null)}</div>}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{t.estimated_hours ? t.estimated_hours + 'h' : '—'}</td>
                  <td className="px-3 py-2.5"><div className="flex items-center gap-1.5"><span className={'text-xs font-medium ' + (pct && pct > 90 ? 'text-red-500' : 'text-gray-500')}>{t.hours_logged}h</span>{pct !== null && <div className="w-10 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={'h-full rounded-full ' + (pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-amber-400' : 'bg-[#1B9BF0]')} style={{ width: Math.min(100, pct) + '%' }}/></div>}</div></td>
                  <td className={'px-3 py-2.5 text-xs whitespace-nowrap ' + (isOverdue ? 'text-red-500 font-medium' : 'text-gray-500')}>{t.due_date ? new Date(t.due_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '—'}</td>
                  <td className="px-3 py-2.5"><span className={'text-xs px-2 py-0.5 rounded-full ' + priorityColors[t.priority]}>{t.priority}</span></td>
                  <td className="px-3 py-2.5"><span className={'text-xs px-2 py-0.5 rounded-full ' + statusColors[t.status]}>{statusLabels[t.status]}</span></td>
                  <td className="px-3 py-2.5"><div className="flex items-center gap-0.5">
                    <Link href={'/tareas/' + t.id} title="Ver" className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all"><Pencil size={12}/></Link>
                    {nextStatus[t.status] && <button onClick={() => advanceStatus(t.id, t.status)} disabled={loading === t.id} title={nextStatusLabel[t.status]} className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-all"><CheckCircle size={12}/></button>}
                    <button onClick={() => deleteTask(t.id)} disabled={loading === t.id} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 size={12}/></button>
                  </div></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="md:hidden space-y-2">
        {sorted.map(t => {
          const isOverdue = t.due_date && new Date(t.due_date) < new Date() && !['terminado','presentado'].includes(t.status)
          const collabs = t.task_collaborators ?? []
          return (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start justify-between mb-2"><p className="text-sm font-medium text-gray-900 flex-1 pr-2">{t.title}</p><span className={'text-xs px-2 py-0.5 rounded-full shrink-0 ' + statusColors[t.status]}>{statusLabels[t.status]}</span></div>
              <p className="text-xs text-gray-400 mb-1">{t.project?.client?.name} · {t.project?.name}</p>
              {collabs.length > 0 && <p className="text-xs text-gray-400 mb-2">Colaboradores: {collabs.map((c: any) => c.user?.full_name?.split(' ')[0]).filter(Boolean).join(', ')}</p>}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {t.due_date && <span className={isOverdue ? 'text-red-500' : ''}>{new Date(t.due_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>}
                  <span>{t.hours_logged}h{t.estimated_hours ? '/' + t.estimated_hours + 'h' : ''}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Link href={'/tareas/' + t.id} className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B9BF0] hover:bg-blue-50"><Pencil size={14}/></Link>
                  {nextStatus[t.status] && <button onClick={() => advanceStatus(t.id, t.status)} disabled={loading === t.id} className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50"><CheckCircle size={14}/></button>}
                  <button onClick={() => deleteTask(t.id)} disabled={loading === t.id} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={14}/></button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
