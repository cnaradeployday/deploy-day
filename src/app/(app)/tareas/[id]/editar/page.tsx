'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, X } from 'lucide-react'

export default function EditarTareaPage() {
  const router = useRouter()
  const { id } = useParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [proyectos, setProyectos] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [colaboradores, setColaboradores] = useState<string[]>([])
  const [form, setForm] = useState({
    project_id: '', title: '', description: '',
    priority: 'media', due_date: '',
    direct_responsible_id: '', estimated_hours: '',
    status: 'creado',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    const sb = createClient()
    sb.from('projects').select('id, name, client:clients(name)').order('name').then(({ data }) => setProyectos(data ?? []))
    sb.from('users').select('id, full_name').eq('is_active', true).order('full_name').then(({ data }) => setUsuarios(data ?? []))
    sb.from('tasks')
      .select('*, task_collaborators(user_id)')
      .eq('id', id).single()
      .then(({ data }) => {
        if (!data) return
        setForm({
          project_id: data.project_id ?? '',
          title: data.title ?? '',
          description: data.description ?? '',
          priority: data.priority ?? 'media',
          due_date: data.due_date ?? '',
          direct_responsible_id: data.direct_responsible_id ?? '',
          estimated_hours: data.estimated_hours?.toString() ?? '',
          status: data.status ?? 'creado',
        })
        setColaboradores((data.task_collaborators ?? []).map((c: any) => c.user_id))
      })
  }, [id])

  function addColaborador(uid: string) {
    if (!uid || colaboradores.includes(uid) || uid === form.direct_responsible_id) return
    setColaboradores(prev => [...prev, uid])
  }

  function removeColaborador(uid: string) {
    setColaboradores(prev => prev.filter(x => x !== uid))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { error: err } = await supabase.from('tasks').update({
      project_id: form.project_id,
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      due_date: form.due_date || null,
      direct_responsible_id: form.direct_responsible_id || null,
      estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null,
      status: form.status,
    }).eq('id', id)

    if (err) { setError('Error: ' + err.message); setLoading(false); return }

    // Sync colaboradores: delete all and re-insert
    await supabase.from('task_collaborators').delete().eq('task_id', id)
    if (colaboradores.length > 0) {
      await supabase.from('task_collaborators').insert(
        colaboradores.map(uid => ({ task_id: id, user_id: uid }))
      )
    }

    router.push('/tareas/' + id)
  }

  const availableColabs = usuarios.filter(u =>
    u.id !== form.direct_responsible_id && !colaboradores.includes(u.id)
  )

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
            {proyectos.map(p => (
              <option key={p.id} value={p.id}>{(p.client as any)?.name} — {p.name}</option>
            ))}
          </select>
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha límite</label>
            <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Horas estimadas</label>
            <input type="number" min="0" step="0.5" value={form.estimated_hours}
              onChange={e => set('estimated_hours', e.target.value)} placeholder="8"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Responsable directo</label>
            <select value={form.direct_responsible_id} onChange={e => set('direct_responsible_id', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Sin asignar</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div className="invisible">{/* spacer */}</div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Colaboradores adicionales</label>
          {colaboradores.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {colaboradores.map(uid => {
                const u = usuarios.find(x => x.id === uid)
                return (
                  <span key={uid} className="flex items-center gap-1.5 bg-[#E8F4FE] text-[#1B9BF0] text-xs px-2.5 py-1 rounded-full">
                    {u?.full_name ?? uid}
                    <button type="button" onClick={() => removeColaborador(uid)}><X size={11}/></button>
                  </span>
                )
              })}
            </div>
          )}
          <select value="" onChange={e => { addColaborador(e.target.value); e.target.value = '' }}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
            <option value="">+ Agregar colaborador</option>
            {availableColabs.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl">{error}</div>}

        <div className="flex gap-3 pt-2">
          <Link href={'/tareas/' + id} className="flex-1 text-center py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </Link>
          <button type="submit" disabled={loading}
            className="flex-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
