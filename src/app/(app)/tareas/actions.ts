'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
