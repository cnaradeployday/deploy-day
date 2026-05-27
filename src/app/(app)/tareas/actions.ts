'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

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

export async function deleteTaskAction(taskId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  // Clean up all FK references before deleting the task
  await supabase.from('time_entries').delete().eq('task_id', taskId)
  await supabase.from('task_collaborators').delete().eq('task_id', taskId)
  await supabase.from('task_comments').delete().eq('task_id', taskId)
  await supabase.from('task_attachments').delete().eq('task_id', taskId)
  await supabase.from('hour_requests').delete().eq('task_id', taskId)
  // Null out task references in messages (FK may be RESTRICT)
  await supabase.from('messages').update({ task_id: null }).eq('task_id', taskId)
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) return { error: error.message }
  revalidatePath('/tareas', 'page')
  revalidatePath('/mis-tareas', 'page')
  revalidatePath('/', 'layout')
  return { error: null }
}
