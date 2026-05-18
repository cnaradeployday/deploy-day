'use client'
import { logActivity } from '@/lib/logActivity'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { Download, CheckCircle, X, Plus, ChevronUp, ChevronDown, Loader2, Play, Pause, Square, Timer, Zap, ExternalLink } from 'lucide-react'
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
  canCreateTask?: boolean
  horasEstimadasDelMes?: number
  userId?: string
}

function formatTimerSecs(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`
}

function TaskPopover({ task, userId, onStatusAdvanced, onHoursLogged, onClose }: {
  task: any
  userId: string
  onStatusAdvanced: (taskId: string, newStatus: string) => void
  onHoursLogged: (taskId: string, hours: number) => void
  onClose: () => void
}) {
  const storageKey = `timer_${task.id}_${userId}`
  const [timerState, setTimerState] = useState<any>(null)
  const [timerSecs, setTimerSecs] = useState(0)
  const [hours, setHours] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [advancing, setAdvancing] = useState(false)

  useEffect(() => {
    function readTimer() {
      try {
        const raw = localStorage.getItem(storageKey)
        if (!raw) { setTimerState(null); return }
        const data = JSON.parse(raw)
        setTimerState(data)
        if (data.isPaused || !data.start) {
          setTimerSecs(data.accumulatedSeconds ?? 0)
        } else {
          setTimerSecs((data.accumulatedSeconds ?? 0) + Math.floor((Date.now() - new Date(data.start).getTime()) / 1000))
        }
      } catch { setTimerState(null) }
    }
    readTimer()
    const iv = setInterval(readTimer, 1000)
    return () => clearInterval(iv)
  }, [storageKey])

  function startTimer() {
    const now = new Date()
    const data = { taskId: task.id, taskTitle: task.title, userId, start: now.toISOString(), accumulatedSeconds: 0, isPaused: false }
    localStorage.setItem(storageKey, JSON.stringify(data))
    setTimerState(data); setTimerSecs(0)
    window.dispatchEvent(new Event('storage'))
  }
  function pauseTimer() {
    if (!timerState) return
    const data = { ...timerState, start: null, accumulatedSeconds: timerSecs, isPaused: true }
    localStorage.setItem(storageKey, JSON.stringify(data))
    setTimerState(data)
  }
  function resumeTimer() {
    if (!timerState) return
    const data = { ...timerState, start: new Date().toISOString(), accumulatedSeconds: timerSecs, isPaused: false }
    localStorage.setItem(storageKey, JSON.stringify(data))
    setTimerState(data)
  }
  async function stopTimer() {
    if (!timerState) return
    setSaving(true)
    const h = Math.round((timerSecs / 3600) * 100) / 100
    if (h > 0) {
      await createClient().from('time_entries').insert({ task_id: task.id, user_id: userId, hours_logged: h, entry_date: new Date().toISOString().split('T')[0], notes: 'Registrado con cronómetro' })
      onHoursLogged(task.id, h)
    }
    localStorage.removeItem(storageKey)
    setTimerState(null); setTimerSecs(0); setSaving(false)
    window.dispatchEvent(new Event('storage'))
  }

  async function logHours() {
    const h = parseFloat(hours)
    if (!h || h <= 0) return
    setSaving(true)
    await createClient().from('time_entries').insert({ task_id: task.id, user_id: userId, hours_logged: h, entry_date: new Date().toISOString().split('T')[0], notes: notes.trim() || null })
    onHoursLogged(task.id, h)
    setHours(''); setNotes(''); setSaved(true); setSaving(false)
    setTimeout(() => { setSaved(false); onClose() }, 1200)
  }

  async function advance() {
    const ns: Record<string,string> = { creado:'estimado', estimado:'en_proceso', en_proceso:'terminado', terminado:'presentado' }
    if (!ns[task.status]) return
    setAdvancing(true)
    await createClient().from('tasks').update({ status: ns[task.status] }).eq('id', task.id)
    onStatusAdvanced(task.id, ns[task.status])
    setAdvancing(false); onClose()
  }

  const canTimer = ['estimado','en_proceso'].includes(task.status)
  const nextLabel: Record<string,string> = { creado:'Iniciar', estimado:'En proceso', en_proceso:'Terminar', terminado:'Presentar' }
  const nextS: Record<string,string> = { creado:'estimado', estimado:'en_proceso', en_proceso:'terminado', terminado:'presentado' }

  return (
    <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-2xl border border-gray-200 shadow-xl w-64 overflow-hidden">
      {/* Timer */}
      {canTimer && (
        <div className="px-4 py-3 border-b border-gray-50">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Cronómetro</p>
          {!timerState ? (
            <button onClick={startTimer}
              className="w-full flex items-center justify-center gap-2 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-semibold transition-all">
              <Play size={12} /> Iniciar cronómetro
            </button>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${timerState.isPaused ? 'bg-amber-400' : 'bg-green-400 animate-pulse'}`} />
                <span className="text-base font-mono font-bold text-gray-900 tabular-nums flex-1">{formatTimerSecs(timerSecs)}</span>
                <span className="text-xs text-gray-400">{(Math.round(timerSecs/36)/100)}h</span>
              </div>
              <div className="flex gap-1.5">
                {timerState.isPaused
                  ? <button onClick={resumeTimer} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-all"><Play size={10}/> Reanudar</button>
                  : <button onClick={pauseTimer} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-amber-400 hover:bg-amber-500 text-white rounded-lg text-xs font-medium transition-all"><Pause size={10}/> Pausar</button>
                }
                <button onClick={stopTimer} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50">
                  {saving ? <Loader2 size={10} className="animate-spin"/> : <><Square size={10}/> Detener</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cargar horas */}
      <div className="px-4 py-3 border-b border-gray-50">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Cargar horas</p>
        {saved ? (
          <p className="text-xs text-green-600 font-medium text-center py-1">✓ Horas registradas</p>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input type="number" value={hours} onChange={e => setHours(e.target.value)} placeholder="Horas" step="0.25" min="0.25"
                className="w-20 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]" />
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Nota (opcional)"
                className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]" />
            </div>
            <button onClick={logHours} disabled={saving || !hours || parseFloat(hours) <= 0}
              className="w-full py-1.5 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
              {saving ? <Loader2 size={11} className="animate-spin"/> : 'Registrar horas'}
            </button>
          </div>
        )}
      </div>

      {/* Avanzar estado */}
      {nextS[task.status] && (
        <div className="px-4 py-2.5 border-b border-gray-50">
          <button onClick={advance} disabled={advancing}
            className="w-full flex items-center gap-2 py-2 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50">
            {advancing ? <Loader2 size={12} className="animate-spin"/> : <CheckCircle size={12} className="text-green-500"/>}
            Avanzar: {nextLabel[task.status]}
          </button>
        </div>
      )}

      {/* Ver tarea */}
      <div className="px-4 py-2">
        <Link href={`/tareas/${task.id}?from=mis-tareas`} onClick={onClose}
          className="w-full flex items-center gap-2 py-1.5 text-xs text-gray-500 hover:text-[#1B9BF0] transition-colors">
          <ExternalLink size={11}/> Ver tarea completa
        </Link>
      </div>
    </div>
  )
}

export default function MisTareasClient({
  tareas, proyectos, clientes, filters, mesActual,
  canCreateTask = true, horasEstimadasDelMes = 0, userId = ''
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [sortKey, setSortKey] = useState('due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [loading, setLoading] = useState<string | null>(null)
  const [tareasLocal, setTareasLocal] = useState<any[]>(tareas)
  const [openPopover, setOpenPopover] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setTareasLocal(tareas) }, [tareas])

  useEffect(() => {
    if (!openPopover) return
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpenPopover(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openPopover])

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
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  meses.push(nextMonth.toISOString().slice(0, 7))

  function nombreMes(m: string) {
    return new Date(m + '-15').toLocaleString('es-AR', { month: 'long', year: 'numeric' })
  }

  const mes = filters.mes ?? mesActual
  const [anio, mesNum] = mes.split('-').map(Number)
  const primerDia = new Date(anio, mesNum - 1, 1).toISOString().split('T')[0]
  const ultimoDia = new Date(anio, mesNum, 0).toISOString().split('T')[0]

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ k }: { k: string }) => {
    if (sortKey !== k) return <ChevronUp size={11} className="opacity-20"/>
    return sortDir === 'asc' ? <ChevronUp size={11}/> : <ChevronDown size={11}/>
  }

  const sorted = [...tareasLocal].sort((a, b) => {
    if (sortKey === 'my_assigned_hours' || sortKey === 'hours_logged') {
      const na = Number(a[sortKey] ?? 0); const nb = Number(b[sortKey] ?? 0)
      return sortDir === 'asc' ? na - nb : nb - na
    }
    let va = '', vb = ''
    if (sortKey === 'client') { va = a.project?.client?.name ?? ''; vb = b.project?.client?.name ?? '' }
    else if (sortKey === 'project') { va = a.project?.name ?? ''; vb = b.project?.name ?? '' }
    else if (sortKey === 'responsible') { va = a.direct_responsible?.full_name ?? ''; vb = b.direct_responsible?.full_name ?? '' }
    else { va = String(a[sortKey] ?? ''); vb = String(b[sortKey] ?? '') }
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
  })

  // KPIs: estimadas vienen del server (tareas con due_date en el mes)
  // Usadas: hours_logged ya filtrado por entry_date del mes desde el server
  const totalUsadas = tareasLocal.reduce((s, t) => s + (t.hours_logged ?? 0), 0)
  const totalRestantes = horasEstimadasDelMes - totalUsadas

  function handleStatusAdvanced(taskId: string, newStatus: string) {
    setTareasLocal(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    router.refresh()
  }

  function handleHoursLogged(taskId: string, hours: number) {
    setTareasLocal(prev => prev.map(t => t.id === taskId ? { ...t, hours_logged: (t.hours_logged ?? 0) + hours } : t))
  }

  async function advanceStatus(taskId: string, status: string) {
    if (!nextStatus[status] || loading) return
    setLoading(taskId)
    setTareasLocal(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: nextStatus[status] } : t
    ))
    const { error } = await createClient().from('tasks').update({ status: nextStatus[status] }).eq('id', taskId)
    if (!error) logActivity({ action: 'cambiar estado', section: 'tareas', entityId: taskId, detail: status + ' → ' + nextStatus[status] })
    if (error) {
      setTareasLocal(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
      alert('Error: ' + error.message)
    } else {
      router.refresh()
    }
    setLoading(null)
  }

  function exportar() {
    const data = tareasLocal.map(t => ({
      Tarea: t.title, Rol: t.es_colaborador ? 'Colaborador' : 'Responsable',
      Cliente: t.project?.client?.name ?? '—', Proyecto: t.project?.name ?? '—',
      Estado: statusLabels[t.status] ?? t.status, Prioridad: t.priority,
      'Mis horas': t.my_assigned_hours ?? '—', 'Horas usadas': t.hours_logged ?? 0,
      Vence: t.due_date ? new Date(t.due_date).toLocaleDateString('es-AR') : '—',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Mis tareas')
    XLSX.writeFile(wb, 'mis-tareas-' + mes + '.xlsx')
  }

  return (
    <div className="p-4 md:p-6 max-w-full">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Mis tareas</h1>
          <p className="text-sm text-gray-400 mt-0.5 capitalize">{nombreMes(mes)} · {tareasLocal.length} tarea{tareasLocal.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mes} onChange={e => update('mes', e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white capitalize">
            {meses.map(m => <option key={m} value={m}>{nombreMes(m)}</option>)}
          </select>
          <button onClick={exportar} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            <Download size={14}/> Excel
          </button>
          {canCreateTask && (
            <Link href="/tareas/nueva"
              className="flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
              <Plus size={15}/> Nueva tarea
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Horas estimadas (mes)', value: Math.round(horasEstimadasDelMes * 10) / 10, color: 'text-gray-900' },
          { label: 'Horas usadas (mes)',    value: Math.round(totalUsadas * 10) / 10,           color: 'text-[#1B9BF0]' },
          { label: 'Restantes',             value: Math.round(totalRestantes * 10) / 10,         color: totalRestantes < 0 ? 'text-red-500' : 'text-green-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400">{label}</p>
            <p className={'text-xl font-bold mt-0.5 ' + color}>{value}h</p>
          </div>
        ))}
      </div>

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
              {['baja','media','alta','critica'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
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

      {/* Tabla desktop — sin overflow-hidden para que el popover no quede clippeado */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100">
        <table className="w-full table-fixed">
          <colgroup>
            <col style={{width:'14%'}}/><col style={{width:'8%'}}/><col style={{width:'9%'}}/>
            <col style={{width:'13%'}}/><col style={{width:'12%'}}/><col style={{width:'5%'}}/>
            <col style={{width:'8%'}}/><col style={{width:'7%'}}/><col style={{width:'7%'}}/>
            <col style={{width:'9%'}}/><col style={{width:'8%'}}/>
          </colgroup>
          <thead>
            <tr className="border-b border-gray-50">
              {[
                { key: 'title', label: 'Tarea' }, { key: 'es_colaborador', label: 'Rol' },
                { key: 'client', label: 'Cliente' }, { key: 'project', label: 'Proyecto' },
                { key: 'responsible', label: 'Responsable' }, { key: 'my_assigned_hours', label: 'Est.' },
                { key: 'hours_logged', label: 'Usado' }, { key: 'due_date', label: 'Vence' },
                { key: 'priority', label: 'Prioridad' }, { key: 'status', label: 'Estado' },
                { key: 'actions', label: '' },
              ].map(({ key, label }) => (
                <th key={key} onClick={() => key !== 'actions' && toggleSort(key)}
                  className={'px-3 py-3 text-left text-xs font-medium text-gray-400 ' + (key !== 'actions' ? 'cursor-pointer hover:text-gray-600 select-none' : '')}>
                  <div className="flex items-center gap-1">{label}{key !== 'actions' && <SortIcon k={key}/>}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!sorted.length ? (
              <tr><td colSpan={11} className="text-center py-12 text-sm text-gray-400">Sin tareas asignadas</td></tr>
            ) : sorted.map(t => {
              const isOverdue = t.due_date && new Date(t.due_date) < new Date() && !['terminado','presentado'].includes(t.status)
              const myHours = t.my_assigned_hours ?? 0
              const pct = myHours > 0 ? Math.min(100, Math.round(((t.hours_logged ?? 0) / myHours) * 100)) : null
              const isLoading = loading === t.id
              const esOtroMes = t.due_date && (t.due_date < primerDia || t.due_date > ultimoDia)
              return (
                <tr key={t.id} className={'border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors' + (esOtroMes ? ' opacity-60' : '')}>
                  <td className="px-3 py-3 text-sm font-medium text-gray-900 truncate" title={t.title}>
                    {t.title}
                    {esOtroMes && t.due_date && <span className="ml-1 text-[10px] text-gray-400 bg-gray-100 px-1 rounded">{t.due_date.slice(0,7)}</span>}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${t.es_colaborador ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                      {t.es_colaborador ? 'Colab.' : 'Resp.'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500 truncate">{t.project?.client?.name ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 truncate">{t.project?.name ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 truncate">{t.direct_responsible?.full_name ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-700 font-semibold">{myHours > 0 ? myHours + 'h' : '—'}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <span className={'text-xs font-medium ' + (pct && pct > 90 ? 'text-red-500' : 'text-gray-500')}>{t.hours_logged ?? 0}h</span>
                      {pct !== null && (
                        <div className="w-8 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={'h-full rounded-full ' + (pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-amber-400' : 'bg-[#1B9BF0]')} style={{ width: Math.min(100, pct) + '%' }}/>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className={'px-3 py-3 text-xs ' + (isOverdue ? 'text-red-500 font-medium' : 'text-gray-500')}>
                    {t.due_date ? new Date(t.due_date).toLocaleDateString('es-AR', { day:'numeric', month:'short' }) : '—'}
                  </td>
                  <td className="px-3 py-3"><span className={'text-xs px-1.5 py-0.5 rounded-full ' + priorityColors[t.priority]}>{t.priority}</span></td>
                  <td className="px-3 py-3"><span className={'text-xs px-1.5 py-0.5 rounded-full ' + statusColors[t.status]}>{statusLabels[t.status]}</span></td>
                  <td className="px-3 py-3">
                    <div ref={openPopover === t.id ? popoverRef : undefined} className="relative flex justify-center">
                      <button
                        onClick={() => setOpenPopover(openPopover === t.id ? null : t.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all
                          ${openPopover === t.id ? 'bg-[#1B9BF0] text-white' : 'bg-gray-100 text-gray-600 hover:bg-[#E8F4FE] hover:text-[#1B9BF0]'}`}
                        title="Gestionar tarea">
                        <Zap size={11}/> Gestionar
                      </button>
                      {openPopover === t.id && (
                        <TaskPopover
                          task={t} userId={userId}
                          onStatusAdvanced={handleStatusAdvanced}
                          onHoursLogged={handleHoursLogged}
                          onClose={() => setOpenPopover(null)}
                        />
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
        {sorted.map(t => {
          const isOverdue = t.due_date && new Date(t.due_date) < new Date() && !['terminado','presentado'].includes(t.status)
          const myHours = t.my_assigned_hours ?? 0
          const isLoading = loading === t.id
          const esOtroMes = t.due_date && (t.due_date < primerDia || t.due_date > ultimoDia)
          return (
            <div key={t.id} className={'bg-white rounded-2xl border p-4 ' + (esOtroMes ? 'border-gray-50 opacity-70' : 'border-gray-100')}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 pr-2">
                  <p className="text-sm font-medium text-gray-900">{t.title}</p>
                  {esOtroMes && t.due_date && <span className="text-[10px] text-gray-400">{t.due_date.slice(0,7)}</span>}
                </div>
                <span className={'text-xs px-2 py-0.5 rounded-full shrink-0 ' + statusColors[t.status]}>{statusLabels[t.status]}</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${t.es_colaborador ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                  {t.es_colaborador ? 'Colaborador' : 'Responsable'}
                </span>
                <span className="text-xs text-gray-400 truncate">{t.project?.client?.name} · {t.project?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {t.due_date && <span className={isOverdue ? 'text-red-500' : ''}>{new Date(t.due_date).toLocaleDateString('es-AR', { day:'numeric', month:'short' })}</span>}
                  <span>{t.hours_logged ?? 0}h{myHours > 0 ? '/' + myHours + 'h' : ''}</span>
                </div>
                <div ref={openPopover === t.id ? popoverRef : undefined} className="relative">
                  <button onClick={() => setOpenPopover(openPopover === t.id ? null : t.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all
                      ${openPopover === t.id ? 'bg-[#1B9BF0] text-white' : 'bg-gray-100 text-gray-600'}`}>
                    <Zap size={12}/> Gestionar
                  </button>
                  {openPopover === t.id && (
                    <TaskPopover
                      task={t} userId={userId}
                      onStatusAdvanced={handleStatusAdvanced}
                      onHoursLogged={handleHoursLogged}
                      onClose={() => setOpenPopover(null)}
                    />
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
