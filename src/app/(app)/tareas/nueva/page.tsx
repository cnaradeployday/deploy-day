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
    sb.from('users').select('id, full_name, role').eq('is_active', true).order('full_name').then(({ data }) => setUsuarios(data ?? []))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      project_id: form.project_id,
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      due_date: form.due_date,
      direct_responsible_id: form.direct_responsible_id || null,
      direct_hours: form.direct_hours ? parseFloat(form.direct_hours) : null,
      status: 'creado',
      created_by: user?.id,
    }
    const { error } = await supabase.from('tasks').insert(payload)
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
          <select value={form.project_id} onChange={e => set('project_id', e.target.value)} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
cat > "src/app/(app)/tareas/[id]/page.tsx" << 'ENDOFFILE'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import TaskActions from './TaskActions'

const statusColors: Record<string, string> = {
  creado: 'bg-gray-100 text-gray-500', estimado: 'bg-blue-50 text-blue-600',
  en_proceso: 'bg-amber-50 text-amber-600', terminado: 'bg-green-50 text-green-600',
  presentado: 'bg-purple-50 text-purple-600',
}
const statusLabels: Record<string, string> = {
  creado: 'Creado', estimado: 'Estimado', en_proceso: 'En proceso',
  terminado: 'Terminado', presentado: 'Presentado'
}

export default async function TareaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: t } = await supabase
    .from('tasks')
    .select(`*, project:projects(id, name, client:clients(name)),
      direct_responsible:users!tasks_direct_responsible_id_fkey(id, full_name),
      task_collaborators(id, assigned_hours, user:users(id, full_name)),
      time_entries(id, hours_logged, entry_date, notes, user:users(full_name))`)
    .eq('id', id).single()
  if (!t) notFound()

  const { data: authUser } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', authUser.user?.id ?? '').single()

  const totalLogged = (t.time_entries as any[])?.reduce((s: number, e: any) => s + e.hours_logged, 0) ?? 0
  const pct = t.estimated_hours ? Math.min(100, (totalLogged / t.estimated_hours) * 100) : 0

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/tareas" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15} /> Tareas
      </Link>

      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-gray-400 mb-1">{(t.project as any)?.client?.name} · {(t.project as any)?.name}</p>
          <h1 className="text-xl font-semibold text-gray-900">{t.title}</h1>
          {t.description && <p className="text-sm text-gray-500 mt-1">{t.description}</p>}
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 ml-4 ${statusColors[t.status]}`}>{statusLabels[t.status]}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Horas estimadas', value: t.estimated_hours ? `${t.estimated_hours}h` : '—' },
          { label: 'Horas cargadas', value: `${totalLogged}h` },
          { label: 'Responsable', value: (t.direct_responsible as any)?.full_name ?? '—' },
          { label: 'Vence', value: t.due_date ? new Date(t.due_date).toLocaleDateString('es-AR') : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {t.estimated_hours && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 mb-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
            <span>Progreso de horas</span>
            <span>{totalLogged}h / {t.estimated_hours}h ({Math.round(pct)}%)</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-amber-400' : 'bg-green-400'}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <TaskActions
        task={{ id: t.id, status: t.status, estimated_hours: t.estimated_hours }}
        userId={authUser.user?.id ?? ''}
        userRole={profile?.role ?? 'colaborador'}
        timeEntries={(t.time_entries as any[]) ?? []}
      />
    </div>
  )
}
