'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function deleteTaskAction(taskId: string) {
  const supabase = await createClient()
  await supabase.from('time_entries').delete().eq('task_id', taskId)
  await supabase.from('task_collaborators').delete().eq('task_id', taskId)
  await supabase.from('task_comments').delete().eq('task_id', taskId)
  await supabase.from('task_attachments').delete().eq('task_id', taskId)
  await supabase.from('hour_requests').delete().eq('task_id', taskId)
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) throw new Error(error.message)
  revalidatePath('/tareas', 'page')
  revalidatePath('/mis-tareas', 'page')
  revalidatePath('/', 'layout')
}
