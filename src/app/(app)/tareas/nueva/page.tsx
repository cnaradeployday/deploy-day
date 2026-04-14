'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NuevaTareaPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [proyectos, setProyectos] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [form, setForm] = useState({
    project_id: params.get('proyecto') ?? '',
    title: '', description: '',
    priority: 'media', due_date: '',
    direct_responsible_id: '', direct_hours: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    const sb = createClient()
    sb.from('projects').select('id, name, client:clients(name)').order('name').then(({ data }) => setProyectos(data ?? []))
    sb.from('users').select('id, full_name').eq('is_active', true).order('full_name').then(({ data }) => setUsuarios(data ?? []))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('tasks').insert({
      project_id: form.project_id,
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      due_date: form.due_date,
      direct_responsible_id: form.direct_responsible_id || null,
      direct_hours: form.direct_hours ? parseFloat(form.direct_hours) : null,
      status: 'creado',
      created_by: user?.id,
    })
    if (!error) router.push('/tareas')
    else { alert('Error al guardar'); setLoading(false) }
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Link href="/tareas" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15} /> Volver
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Nueva tarea</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto *</label>
          <select value={form.project_id} onChange={e => set('project_id', e.target.value)} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
            <option value="">Seleccionar proyecto</option>
            {proyectos.map(p => (
              <option key={p.id} value={p.id}>{(p.client as any)?.name} — {p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
          <input type="text" value={form.title} onChange={e => set('title', e.target.value)} required placeholder="Ej: Diseño de homepage" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} placeholder="Detalle de la tarea..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha límite *</label>
            <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Responsable directo</label>
            <select value={form.direct_responsible_id} onChange={e => set('direct_responsible_id', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
              <option value="">Sin asignar</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Horas asignadas</label>
            <input type="number" min="0" step="0.5" value={form.direct_hours} onChange={e => set('direct_hours', e.target.value)} placeholder="8" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black" />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Link href="/tareas" className="flex-1 text-center py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</Link>
          <button type="submit" disabled={loading} className="flex-1 bg-black text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
            {loading ? 'Guardando...' : 'Crear tarea'}
          </button>
        </div>
      </form>
    </div>
  )
}
