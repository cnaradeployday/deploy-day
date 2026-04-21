'use client'
import { logActivity } from '@/lib/logActivity'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, X, AlertTriangle, CheckCircle } from 'lucide-react'

interface Colab { uid: string; hours: string }

interface ProyectoInfo {
  id: string
  name: string
  client: any
  horasMes: number      // horas del segmento del mes seleccionado
  horasAsignadas: number // ya asignadas a otras tareas en ese proyecto ese mes
}

interface UsuarioInfo {
  id: string
  full_name: string
  disponibilidadMes: number  // horas disponibles según user_availability
  yaAsignadasMes: number     // horas ya asignadas en otras tareas ese mes
}

export default function NuevaTareaPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [proyectos, setProyectos] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [colaboradores, setColaboradores] = useState<Colab[]>([])
  const [proyectoInfo, setProyectoInfo] = useState<ProyectoInfo | null>(null)
  const [usuariosInfo, setUsuariosInfo] = useState<Record<string, UsuarioInfo>>({})
  const [form, setForm] = useState({
    project_id: params.get('proyecto') ?? '',
    title: '', description: '',
    priority: 'media', due_date: '',
    direct_responsible_id: '', direct_hours: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // Mes derivado de la fecha límite o el mes actual
  const mesRef = form.due_date
    ? form.due_date.slice(0, 7)
    : new Date().toISOString().slice(0, 7)
  const [anioM, mesM] = mesRef.split('-').map(Number)
  const primerDiaMes = new Date(anioM, mesM - 1, 1).toISOString().split('T')[0]
  const ultimoDiaMes = new Date(anioM, mesM, 0).toISOString().split('T')[0]

  useEffect(() => {
    const sb = createClient()
    sb.from('projects').select('id, name, client:clients(name)').order('name').then(({ data }) => setProyectos(data ?? []))
    sb.from('users').select('id, full_name').eq('is_active', true).order('full_name').then(({ data }) => setUsuarios(data ?? []))
  }, [])

  // Cargar info del proyecto cuando cambia proyecto o mes
  useEffect(() => {
    if (!form.project_id) { setProyectoInfo(null); return }
    const sb = createClient()
    async function loadProyecto() {
      // Segmento del mes para este proyecto
      const { data: seg } = await sb
        .from('project_hour_segments')
        .select('horas')
        .eq('project_id', form.project_id)
        .lte('desde', ultimoDiaMes)
        .gte('hasta', primerDiaMes)
      const horasMes = (seg ?? []).reduce((s: number, x: any) => s + x.horas, 0)

      // Horas ya asignadas a tareas activas del proyecto (sin filtrar por due_date)
      const { data: tareasProy } = await sb
        .from('tasks')
        .select('id, direct_hours, task_collaborators(assigned_hours)')
        .eq('project_id', form.project_id)
        .not('status', 'in', '(presentado)')
      const horasAsignadas = (tareasProy ?? []).reduce((s: number, t: any) => {
        const dh = t.direct_hours ?? 0
        const ch = (t.task_collaborators ?? []).reduce((cs: number, c: any) => cs + (c.assigned_hours ?? 0), 0)
        return s + dh + ch
      }, 0)

      const p = proyectos.find(x => x.id === form.project_id)
      setProyectoInfo({
        id: form.project_id,
        name: p?.name ?? '',
        client: p?.client,
        horasMes,
        horasAsignadas,
      })
    }
    loadProyecto()
  }, [form.project_id, mesRef, proyectos])

  // Cargar info de usuario cuando cambia responsable, colaboradores o mes
  const loadUsuarioInfo = useCallback(async (uid: string) => {
    if (!uid) return
    const sb = createClient()
    // Disponibilidad del usuario en el mes
    const { data: avail } = await sb
      .from('user_availability')
      .select('horas')
      .eq('user_id', uid)
      .lte('desde', ultimoDiaMes)
      .gte('hasta', primerDiaMes)
    const disponibilidadMes = (avail ?? []).reduce((s: number, a: any) => s + a.horas, 0)

    // Horas ya asignadas al usuario en tareas de ese mes (responsable + colab)
    const { data: tareasResp } = await sb
      .from('tasks')
      .select('direct_hours')
      .eq('direct_responsible_id', uid)
      .not('status', 'in', '(presentado)')
      .gte('due_date', primerDiaMes)
      .lte('due_date', ultimoDiaMes)
    const horasResp = (tareasResp ?? []).reduce((s: number, t: any) => s + (t.direct_hours ?? 0), 0)

    const { data: tareasColab } = await sb
      .from('task_collaborators')
      .select('assigned_hours, task:tasks(due_date, status)')
      .eq('user_id', uid)
    const horasColab = (tareasColab ?? [])
      .filter((c: any) => {
        const dd = c.task?.due_date
        return dd && dd >= primerDiaMes && dd <= ultimoDiaMes && c.task?.status !== 'presentado'
      })
      .reduce((s: number, c: any) => s + (c.assigned_hours ?? 0), 0)

    setUsuariosInfo(prev => ({
      ...prev,
      [uid]: { id: uid, full_name: '', disponibilidadMes, yaAsignadasMes: horasResp + horasColab }
    }))
  }, [primerDiaMes, ultimoDiaMes])

  useEffect(() => {
    if (form.direct_responsible_id) loadUsuarioInfo(form.direct_responsible_id)
  }, [form.direct_responsible_id, mesRef])

  useEffect(() => {
    colaboradores.forEach(c => loadUsuarioInfo(c.uid))
  }, [colaboradores.map(c => c.uid).join(','), mesRef])

  const totalHoras = (parseFloat(form.direct_hours) || 0) + colaboradores.reduce((s, c) => s + (parseFloat(c.hours) || 0), 0)

  // Validaciones
  const horasLibresProyecto = proyectoInfo ? proyectoInfo.horasMes - proyectoInfo.horasAsignadas : null
  const proyectoExcedido = horasLibresProyecto !== null && horasLibresProyecto > 0 && totalHoras > horasLibresProyecto

  function getUsuarioWarning(uid: string, horasAsignando: number): string | null {
    const info = usuariosInfo[uid]
    if (!info || info.disponibilidadMes === 0) return null
    const libres = info.disponibilidadMes - info.yaAsignadasMes
    if (horasAsignando > libres) return `Supera disponibilidad: ${libres}h libres de ${info.disponibilidadMes}h`
    return null
  }

  function addColaborador(uid: string) {
    if (!uid || colaboradores.find(c => c.uid === uid) || uid === form.direct_responsible_id) return
    setColaboradores(prev => [...prev, { uid, hours: '' }])
  }
  function removeColaborador(uid: string) { setColaboradores(prev => prev.filter(c => c.uid !== uid)) }
  function setColabHours(uid: string, hours: string) { setColaboradores(prev => prev.map(c => c.uid === uid ? { ...c, hours } : c)) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: task, error: err } = await supabase.from('tasks').insert({
      project_id: form.project_id, title: form.title,
      description: form.description || null, priority: form.priority,
      due_date: form.due_date || null,
      direct_responsible_id: form.direct_responsible_id || null,
      estimated_hours: totalHoras || null,
      direct_hours: form.direct_hours ? parseFloat(form.direct_hours) : null,
      status: 'creado', created_by: user?.id,
    }).select().single()
    if (err) { setError('Error: ' + err.message); setLoading(false); return }
    if (colaboradores.length > 0 && task) {
      await supabase.from('task_collaborators').insert(
        colaboradores.map(c => ({ task_id: task.id, user_id: c.uid, assigned_hours: c.hours ? parseFloat(c.hours) : null }))
      )
    }
    logActivity({ action: 'crear tarea', section: 'tareas', entityName: form.title, detail: 'Nueva tarea creada' })
    router.push('/tareas')
  }

  const availableColabs = usuarios.filter(u => u.id !== form.direct_responsible_id && !colaboradores.find(c => c.uid === u.id))
  const respWarning = form.direct_responsible_id ? getUsuarioWarning(form.direct_responsible_id, parseFloat(form.direct_hours) || 0) : null

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Link href="/tareas" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Volver
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Nueva tarea</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Proyecto *</label>
          <select value={form.project_id} onChange={e => set('project_id', e.target.value)} required
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
            <option value="">Seleccionar proyecto</option>
            {proyectos.map(p => <option key={p.id} value={p.id}>{(p.client as any)?.name} — {p.name}</option>)}
          </select>
          {/* Info del proyecto */}
          {proyectoInfo && proyectoInfo.horasMes > 0 && (
            <div className={`mt-2 px-3 py-2 rounded-xl text-xs flex items-center gap-2 ${proyectoExcedido ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
              {proyectoExcedido ? <AlertTriangle size={12}/> : <CheckCircle size={12}/>}
              <span>
                Proyecto: <strong>{proyectoInfo.horasMes}h</strong> en {new Date(mesRef + '-15').toLocaleString('es-AR', { month: 'long' })}
                {' · '}<strong>{Math.max(0, proyectoInfo.horasMes - proyectoInfo.horasAsignadas)}h</strong> disponibles
                {proyectoInfo.horasAsignadas > 0 && ` (${proyectoInfo.horasAsignadas}h ya asignadas)`}
                {proyectoExcedido && ` · ⚠️ Superás las horas del proyecto`}
              </span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Título *</label>
          <input type="text" value={form.title} onChange={e => set('title', e.target.value)} required
            placeholder="Ej: Diseño de homepage"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
            placeholder="Detalle de la tarea..."
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] resize-none"/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Prioridad</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha límite</label>
            <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
        </div>

        {/* HORAS DESGLOSADAS */}
        <div className="border border-gray-100 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Estimación de horas</p>
            {totalHoras > 0 && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${proyectoExcedido ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-[#1B9BF0]'}`}>
                Total: {totalHoras}h
              </span>
            )}
          </div>
          <div className="grid grid-cols-5 gap-1 px-1">
            <span className="col-span-3 text-xs text-gray-400">Persona</span>
            <span className="col-span-2 text-xs text-gray-400">Horas</span>
          </div>

          {/* Responsable */}
          <div className="space-y-1">
            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-3">
                <select value={form.direct_responsible_id} onChange={e => set('direct_responsible_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
                  <option value="">Responsable — sin asignar</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <input type="number" min="0" step="0.5" value={form.direct_hours}
                  onChange={e => set('direct_hours', e.target.value)} placeholder="0"
                  className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] ${respWarning ? 'border-amber-300' : 'border-gray-200'}`}/>
              </div>
            </div>
            {/* Info disponibilidad responsable */}
            {form.direct_responsible_id && usuariosInfo[form.direct_responsible_id] && (
              <div className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 ${respWarning ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500'}`}>
                {respWarning ? <AlertTriangle size={11}/> : <CheckCircle size={11} className="text-green-500"/>}
                {(() => {
                  const info = usuariosInfo[form.direct_responsible_id]
                  if (info.disponibilidadMes === 0) return 'Sin disponibilidad cargada para este mes'
                  const libres = info.disponibilidadMes - info.yaAsignadasMes
                  return respWarning
                    ? respWarning
                    : `${libres}h libres de ${info.disponibilidadMes}h (${info.yaAsignadasMes}h ya asignadas)`
                })()}
              </div>
            )}
          </div>

          {/* Colaboradores */}
          {colaboradores.map(c => {
            const u = usuarios.find(x => x.id === c.uid)
            const colabWarning = getUsuarioWarning(c.uid, parseFloat(c.hours) || 0)
            const colabInfo = usuariosInfo[c.uid]
            return (
              <div key={c.uid} className="space-y-1">
                <div className="grid grid-cols-5 gap-2 items-center">
                  <div className="col-span-3 flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl">
                    <span className="text-sm text-gray-600 truncate flex-1">{u?.full_name ?? c.uid}</span>
                    <button type="button" onClick={() => removeColaborador(c.uid)} className="text-gray-300 hover:text-red-400 shrink-0"><X size={12}/></button>
                  </div>
                  <div className="col-span-2">
                    <input type="number" min="0" step="0.5" value={c.hours}
                      onChange={e => setColabHours(c.uid, e.target.value)} placeholder="0"
                      className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] ${colabWarning ? 'border-amber-300' : 'border-gray-200'}`}/>
                  </div>
                </div>
                {colabInfo && (
                  <div className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 ${colabWarning ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500'}`}>
                    {colabWarning ? <AlertTriangle size={11}/> : <CheckCircle size={11} className="text-green-500"/>}
                    {colabInfo.disponibilidadMes === 0
                      ? 'Sin disponibilidad cargada para este mes'
                      : colabWarning || `${colabInfo.disponibilidadMes - colabInfo.yaAsignadasMes}h libres de ${colabInfo.disponibilidadMes}h`
                    }
                  </div>
                )}
              </div>
            )
          })}

          <select value="" onChange={e => { addColaborador(e.target.value); e.target.value = '' }}
            className="w-full px-3 py-2 border border-dashed border-gray-200 rounded-xl text-sm text-gray-400 bg-white focus:outline-none">
            <option value="">+ Agregar colaborador</option>
            {availableColabs.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </div>

        {/* Advertencia de proyecto excedido */}
        {proyectoExcedido && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 px-4 py-3 rounded-xl text-sm text-red-600">
            <AlertTriangle size={15} className="shrink-0 mt-0.5"/>
            <span>
              Las horas asignadas ({totalHoras}h) superan las disponibles del proyecto en este mes ({Math.max(0, (proyectoInfo?.horasMes ?? 0) - (proyectoInfo?.horasAsignadas ?? 0))}h).
              Podés guardar igual, pero revisá la planificación.
            </span>
          </div>
        )}

        {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl">{error}</div>}

        <div className="flex gap-3 pt-2">
          <Link href="/tareas" className="flex-1 text-center py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</Link>
          <button type="submit" disabled={loading}
            className="flex-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
            {loading ? 'Guardando...' : 'Crear tarea'}
          </button>
        </div>
      </form>
    </div>
  )
}
