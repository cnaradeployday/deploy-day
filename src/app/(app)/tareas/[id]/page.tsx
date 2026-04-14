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
const priorityColors: Record<string, string> = {
  baja: 'bg-gray-100 text-gray-400', media: 'bg-blue-50 text-blue-500',
  alta: 'bg-amber-50 text-amber-600', critica: 'bg-red-50 text-red-600'
}

export default async function TareaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: t } = await supabase
    .from('tasks')
    .select(`*, 
      project:projects(id, name, client:clients(name)),
      direct_responsible:users!tasks_direct_responsible_id_fkey(id, full_name),
      task_collaborators(id, assigned_hours, user:users(id, full_name)),
      time_entries(id, hours_logged, entry_date, notes, user:users(full_name))`)
    .eq('id', id).single()
  if (!t) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()

  const totalLogged = (t.time_entries as any[])?.reduce((s: number, e: any) => s + e.hours_logged, 0) ?? 0
  const pct = t.estimated_hours ? Math.min(100, (totalLogged / t.estimated_hours) * 100) : 0
  const isOverdue = t.due_date && new Date(t.due_date) < new Date() && !['terminado','presentado'].includes(t.status)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/tareas" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Tareas
      </Link>

      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 mb-1">{(t.project as any)?.client?.name} · {(t.project as any)?.name}</p>
          <h1 className="text-xl font-semibold text-gray-900">{t.title}</h1>
          {t.description && <p className="text-sm text-gray-500 mt-1">{t.description}</p>}
        </div>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[t.priority]}`}>{t.priority}</span>
          <span className={`text-xs px-2.5 py-1 rounded-full ${statusColors[t.status]}`}>{statusLabels[t.status]}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Horas estimadas', value: t.estimated_hours ? `${t.estimated_hours}h` : '—' },
          { label: 'Horas cargadas', value: `${totalLogged}h` },
          { label: 'Responsable', value: (t.direct_responsible as any)?.full_name ?? '—' },
          { label: 'Vence', value: t.due_date ? new Date(t.due_date).toLocaleDateString('es-AR') : '—', alert: isOverdue },
        ].map(({ label, value, alert }) => (
          <div key={label} className={`bg-white rounded-2xl border px-4 py-3 ${alert ? 'border-red-200' : 'border-gray-100'}`}>
            <p className="text-xs text-gray-400">{label}</p>
            <p className={`text-sm font-semibold mt-0.5 ${alert ? 'text-red-500' : 'text-gray-900'}`}>{value}</p>
            {alert && <p className="text-xs text-red-400">Vencida</p>}
          </div>
        ))}
      </div>

      {t.estimated_hours && (
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 mb-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
            <span>Progreso de horas</span>
            <span>{totalLogged}h / {t.estimated_hours}h ({Math.round(pct)}%)</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-amber-400' : 'bg-[#1B9BF0]'}`}
              style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <TaskActions
        task={{ id: t.id, status: t.status, estimated_hours: t.estimated_hours }}
        userId={user?.id ?? ''}
        userRole={profile?.role ?? 'colaborador'}
        timeEntries={(t.time_entries as any[]) ?? []}
      />
    </div>
  )
}
