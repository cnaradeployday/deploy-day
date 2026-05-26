import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import TaskActions from './TaskActions'
import TaskTimer from './TaskTimer'
import TaskAttachments from './TaskAttachments'
import TaskComments from './TaskComments'
import TimeEntriesList from './TimeEntriesList'

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

export default async function TareaDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params
  const sp = await searchParams
  const backTo = sp.from === 'mis-tareas' ? '/mis-tareas' : '/tareas'
  const backLabel = sp.from === 'mis-tareas' ? 'Mis tareas' : 'Tareas'
  const supabase = await createClient()

  const { data: t } = await supabase
    .from('tasks')
    .select(`*,
      project:projects(id, name, client:clients(name)),
      direct_responsible:users!tasks_direct_responsible_id_fkey(id, full_name),
      task_collaborators(id, assigned_hours, user:users(id, full_name))`)
    .eq('id', id).single()
  if (!t) notFound()

  // Fetch all time entries bypassing RLS so all users see the full total
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: timeEntries } = await admin
    .from('time_entries')
    .select('id, hours_logged, entry_date, notes, user_id, user:users(full_name)')
    .eq('task_id', id)
    .order('entry_date', { ascending: false })

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role, full_name, custom_role_id').eq('id', user?.id ?? '').single()

  const totalLogged = (timeEntries as any[])?.reduce((s: number, e: any) => s + e.hours_logged, 0) ?? 0
  const pct = t.estimated_hours ? Math.min(100, (totalLogged / t.estimated_hours) * 100) : 0
  const isOverdue = t.due_date && new Date(t.due_date) < new Date() && !['terminado','presentado'].includes(t.status)
  const isAdmin = ['admin','gerente_operaciones'].includes(profile?.role ?? '')

  // Permiso editar tareas
  let canEditTask = isAdmin
  if (!canEditTask && profile?.custom_role_id) {
    const { data: permEdit } = await supabase
      .from('role_permissions').select('can_read')
      .eq('role_id', profile.custom_role_id).eq('module', 'tareas').single()
    canEditTask = permEdit?.can_read ?? false
  }

  // Permiso cargar horas en nombre de otros
  let canCargarHorasOtros = isAdmin
  if (!canCargarHorasOtros && profile?.custom_role_id) {
    const { data: permHoras } = await supabase
      .from('role_permissions').select('can_read')
      .eq('role_id', profile.custom_role_id).eq('module', 'cargar_horas_otros').single()
    canCargarHorasOtros = permHoras?.can_read ?? false
  }

  const isDirectResponsible = t.direct_responsible_id === user?.id
  const isCollaborator = (t.task_collaborators as any[])?.some((c: any) => c.user?.id === user?.id)
  const isAssigned = isDirectResponsible || isCollaborator
  const canUseTimer = ['estimado','en_proceso'].includes(t.status) && isAssigned

  const { data: comments } = await supabase
    .from('task_comments')
    .select('id, content, created_at, user:users(id, full_name)')
    .eq('task_id', id)

  const { data: attachments } = await supabase
    .from('task_attachments')
    .select('*')
    .eq('task_id', id)
    .order('created_at', { ascending: false })
    .order('created_at', { ascending: true })

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href={backTo} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> {backLabel}
      </Link>

      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 mb-1">{(t.project as any)?.client?.name} · {(t.project as any)?.name}</p>
          <h1 className="text-xl font-semibold text-gray-900">{t.title}</h1>
          {t.description && <p className="text-sm text-gray-500 mt-1">{t.description}</p>}
        </div>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <span className={'text-xs px-2 py-0.5 rounded-full ' + priorityColors[t.priority]}>{t.priority}</span>
          <span className={'text-xs px-2.5 py-1 rounded-full ' + statusColors[t.status]}>{statusLabels[t.status]}</span>
          {canEditTask && (
            <Link href={'/tareas/' + t.id + '/editar'}
              className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
              <Pencil size={14}/>
            </Link>
          )}
        </div>
      </div>

      {(t.task_collaborators as any[])?.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-gray-400">Colaboradores:</span>
          {(t.task_collaborators as any[]).map((c: any) => (
            <span key={c.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {c.user?.full_name}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Horas estimadas', value: t.estimated_hours ? t.estimated_hours + 'h' : '—' },
          { label: 'Horas cargadas', value: Math.round(totalLogged * 100) / 100 + 'h' },
          { label: 'Responsable', value: (t.direct_responsible as any)?.full_name ?? '—' },
          { label: 'Vence', value: t.due_date ? new Date(t.due_date).toLocaleDateString('es-AR') : '—', alert: isOverdue },
        ].map(({ label, value, alert }) => (
          <div key={label} className={'bg-white rounded-2xl border px-4 py-3 ' + (alert ? 'border-red-200' : 'border-gray-100')}>
            <p className="text-xs text-gray-400">{label}</p>
            <p className={'text-sm font-semibold mt-0.5 ' + (alert ? 'text-red-500' : 'text-gray-900')}>{value}</p>
            {alert && <p className="text-xs text-red-400">Vencida</p>}
          </div>
        ))}
      </div>

      {t.estimated_hours && (
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 mb-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
            <span>Progreso</span>
            <span>{Math.round(totalLogged * 100) / 100}h / {t.estimated_hours}h ({Math.round(pct)}%)</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={'h-full rounded-full ' + (pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-amber-400' : 'bg-[#1B9BF0]')}
              style={{ width: pct + '%' }}/>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="space-y-4">
          {canUseTimer && (
            <TaskTimer taskId={t.id} userId={user?.id ?? ''} taskTitle={t.title} taskStatus={t.status}/>
          )}
          <TaskActions
            task={{ id: t.id, status: t.status, estimated_hours: t.estimated_hours }}
            userId={user?.id ?? ''}
            userRole={profile?.role ?? 'colaborador'}
            canCargarHorasOtros={canCargarHorasOtros}
            timeEntries={(timeEntries as any[]) ?? []}
            isDirectResponsible={isDirectResponsible}
          />
        </div>
        <TimeEntriesList
          entries={(timeEntries as any[]) ?? []}
          canEdit={isAdmin}
          currentUserId={user?.id ?? ''}
          taskId={t.id}
        />
      </div>

      <TaskAttachments
        taskId={t.id}
        userId={user?.id ?? ''}
        userName={profile?.full_name ?? ''}
        canUpload={isAssigned || isAdmin}
        initialAttachments={attachments ?? []}
      />

      <TaskComments
        taskId={t.id}
        currentUserId={user?.id ?? ''}
        currentUserName={profile?.full_name ?? ''}
        initialComments={comments ?? []}
      />
    </div>
  )
}
