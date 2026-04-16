'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, X } from 'lucide-react'

interface Colab { uid: string; hours: string }

export default function EditarTareaPage() {
  const router = useRouter()
  const { id } = useParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [proyectos, setProyectos] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [colaboradores, setColaboradores] = useState<Colab[]>([])
  const [form, setForm] = useState({
    project_id: '', title: '', description: '',
    priority: 'media', due_date: '',
    direct_responsible_id: '', direct_hours: '', status: 'creado',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    const sb = createClient()
    sb.from('projects').select('id, name, client:clients(name)').order('name').then(({ data }) => setProyectos(data ?? []))
    sb.from('users').select('id, full_name').eq('is_active', true).order('full_name').then(({ data }) => setUsuarios(data ?? []))
    sb.from('tasks').select('*, task_collaborators(user_id, assigned_hours)').eq('id', id).single()
      .then(({ data }) => {
        if (!data) return
        setForm({
          project_id: data.project_id ?? '',
          title: data.title ?? '',
          description: data.description ?? '',
          priority: data.priority ?? 'media',
          due_date: data.due_date ?? '',
          direct_responsible_id: data.direct_responsible_id ?? '',
          direct_hours: data.direct_hours?.toString() ?? data.estimated_hours?.toString() ?? '',
          status: data.status ?? 'creado',
        })
        setColaboradores((data.task_collaborators ?? []).map((c: any) => ({ uid: c.user_id, hours: c.assigned_hours?.toString() ?? '' })))
      })
  }, [id])

  const totalHoras = (parseFloat(form.direct_hours) || 0) + colaboradores.reduce((s, c) => s + (parseFloat(c.hours) || 0), 0)

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
    const { error: err } = await supabase.from('tasks').update({
      project_id: form.project_id, title: form.title,
      description: form.description || null, priority: form.priority,
      due_date: form.due_date || null,
      direct_responsible_id: form.direct_responsible_id || null,
      estimated_hours: totalHoras || null,
      direct_hours: form.direct_hours ? parseFloat(form.direct_hours) : null,
      status: form.status,
    }).eq('id', id)
    if (err) { setError('Error: ' + err.message); setLoading(false); return }
    await supabase.from('task_collaborators').delete().eq('task_id', id)
    if (colaboradores.length > 0) {
      await supabase.from('task_collaborators').insert(
        colaboradores.map(c => ({ task_id: id, user_id: c.uid, assigned_hours: c.hours ? parseFloat(c.hours) : null }))
      )
    }
    router.push('/tareas/' + id)
  }

  const availableColabs = usuarios.filter(u => u.id !== form.direct_responsible_id && !colaboradores.find(c => c.uid === u.id))

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Link href={'/tareas/' + id} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Volver
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Editar tarea</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Proyecto *</label>
          <select value={form.project_id} onChange={e => set('project_id', e.target.value)} required
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
            <option value="">Seleccionar proyecto</option>
            {proyectos.map(p => <option key={p.id} value={p.id}>{(p.client as any)?.name} — {p.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Título *</label>
          <input type="text" value={form.title} onChange={e => set('title', e.target.value)} required
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] resize-none"/>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="creado">Creado</option>
              <option value="estimado">Iniciado</option>
              <option value="en_proceso">En proceso</option>
              <option value="terminado">Terminado</option>
              <option value="presentado">Presentado</option>
            </select>
          </div>
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
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha límite</label>
          <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>

        {/* HORAS DESGLOSADAS */}
        <div className="border border-gray-100 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Estimación de horas</p>
            {totalHoras > 0 && (
              <span className="text-xs font-semibold text-[#1B9BF0] bg-blue-50 px-2.5 py-1 rounded-full">Total: {totalHoras}h</span>
            )}
          </div>
          <div className="grid grid-cols-5 gap-1 px-1">
            <span className="col-span-3 text-xs text-gray-400">Persona</span>
            <span className="col-span-2 text-xs text-gray-400">Horas</span>
          </div>

          {/* Responsable */}
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
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
            </div>
          </div>

          {/* Colaboradores */}
          {colaboradores.map(c => {
            const u = usuarios.find(x => x.id === c.uid)
            return (
              <div key={c.uid} className="grid grid-cols-5 gap-2 items-center">
                <div className="col-span-3 flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl">
                  <span className="text-sm text-gray-600 truncate flex-1">{u?.full_name ?? c.uid}</span>
                  <button type="button" onClick={() => removeColaborador(c.uid)} className="text-gray-300 hover:text-red-400 shrink-0"><X size={12}/></button>
                </div>
                <div className="col-span-2">
                  <input type="number" min="0" step="0.5" value={c.hours}
                    onChange={e => setColabHours(c.uid, e.target.value)} placeholder="0"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
                </div>
              </div>
            )
          })}

          <select value="" onChange={e => { addColaborador(e.target.value); e.target.value = '' }}
            className="w-full px-3 py-2 border border-dashed border-gray-200 rounded-xl text-sm text-gray-400 bg-white focus:outline-none">
            <option value="">+ Agregar colaborador</option>
            {availableColabs.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl">{error}</div>}

        <div className="flex gap-3 pt-2">
          <Link href={'/tareas/' + id} className="flex-1 text-center py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</Link>
          <button type="submit" disabled={loading}
            className="flex-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
