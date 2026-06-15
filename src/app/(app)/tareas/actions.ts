'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createNotification } from '@/app/(app)/novedades/actions'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function deleteTimeEntryAction(entryId: string, taskId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autorizado')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isAdmin = ['admin', 'gerente_operaciones'].includes(profile?.role ?? '')

  let result
  if (isAdmin) {
    result = await getAdminClient().from('time_entries').delete().eq('id', entryId).select()
  } else {
    result = await supabase.from('time_entries').delete().eq('id', entryId).eq('user_id', user.id).select()
  }

  if (result.error) throw new Error(result.error.message)
  if (!result.data?.length) throw new Error('No se pudo eliminar la entrada (sin permiso o ya no existe)')
  revalidatePath(`/tareas/${taskId}`)
}

export async function updateTaskAction(taskId: string, data: {
  project_id: string
  title: string
  description: string | null
  priority: string
  due_date: string | null
  direct_responsible_id: string | null
  estimated_hours: number | null
  direct_hours: number | null
  status: string
  collaborators: { uid: string; hours: string }[]
}): Promise<{ error: string | null }> {
  const admin = getAdminClient()

  // Read current state to detect assignment changes
  const { data: prev } = await admin
    .from('tasks').select('direct_responsible_id, title, task_collaborators(user_id)')
    .eq('id', taskId).single()

  const { error } = await admin.from('tasks').update({
    project_id: data.project_id,
    title: data.title,
    description: data.description,
    priority: data.priority,
    due_date: data.due_date,
    direct_responsible_id: data.direct_responsible_id,
    estimated_hours: data.estimated_hours,
    direct_hours: data.direct_hours,
    status: data.status,
  }).eq('id', taskId)

  if (error) return { error: error.message }

  // Detect new direct responsible
  if (data.direct_responsible_id && data.direct_responsible_id !== prev?.direct_responsible_id) {
    await createNotification({
      user_id: data.direct_responsible_id,
      type: 'task_assigned',
      title: `Te asignaron la tarea "${data.title}"`,
      body: data.due_date ? `Vence el ${new Date(data.due_date + 'T12:00:00').toLocaleDateString('es-AR')}.` : undefined,
      link: `/mis-tareas`,
      dedup_key: `task_assigned_direct_${taskId}_${data.direct_responsible_id}`,
    }).catch(() => {})
  }

  // Detect new collaborators
  const prevCollabIds = ((prev as any)?.task_collaborators ?? []).map((c: any) => c.user_id as string)
  const newCollabIds = data.collaborators.map(c => c.uid)
  const addedCollabs = newCollabIds.filter(uid => !prevCollabIds.includes(uid))

  await admin.from('task_collaborators').delete().eq('task_id', taskId)
  if (data.collaborators.length > 0) {
    await admin.from('task_collaborators').insert(
      data.collaborators.map(c => ({
        task_id: taskId,
        user_id: c.uid,
        assigned_hours: c.hours ? parseFloat(c.hours) : null,
      }))
    )
  }

  await Promise.all(addedCollabs.map(uid =>
    createNotification({
      user_id: uid,
      type: 'task_assigned',
      title: `Te agregaron como colaborador en "${data.title}"`,
      body: data.due_date ? `Vence el ${new Date(data.due_date + 'T12:00:00').toLocaleDateString('es-AR')}.` : undefined,
      link: `/mis-tareas`,
      dedup_key: `task_assigned_collab_${taskId}_${uid}`,
    }).catch(() => {})
  ))

  revalidatePath(`/tareas/${taskId}`)
  revalidatePath('/tareas')
  revalidatePath('/mis-tareas')
  return { error: null }
}

export async function deleteTaskAction(taskId: string): Promise<{ error: string | null }> {
  const admin = getAdminClient()
  // Clean up all FK references using admin client to bypass RLS
  await admin.from('time_entries').delete().eq('task_id', taskId)
  await admin.from('task_collaborators').delete().eq('task_id', taskId)
  await admin.from('task_comments').delete().eq('task_id', taskId)
  await admin.from('task_attachments').delete().eq('task_id', taskId)
  await admin.from('hour_requests').delete().eq('task_id', taskId)
  await admin.from('messages').update({ task_id: null }).eq('task_id', taskId)
  const { error } = await admin.from('tasks').delete().eq('id', taskId)
  if (error) return { error: error.message }
  revalidatePath('/tareas', 'page')
  revalidatePath('/mis-tareas', 'page')
  revalidatePath('/', 'layout')
  return { error: null }
}
