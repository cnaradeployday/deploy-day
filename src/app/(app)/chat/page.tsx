import { createClient } from '@/lib/supabase/server'
import ChatClient from './ChatClient'

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: messages } = await supabase
    .from('messages')
    .select(`id, content, created_at, mentions, task_id, project_id, is_global,
      user:users(id, full_name),
      task:tasks(id, title),
      project:projects(id, name)`)
    .eq('is_global', true)
    .order('created_at', { ascending: true })
    .limit(100)

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name')

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title')
    .not('status', 'in', '("presentado")')
    .order('title')
    .limit(50)

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  return (
    <ChatClient
      initialMessages={messages ?? []}
      currentUserId={user?.id ?? ''}
      users={users ?? []}
      tasks={tasks ?? []}
      projects={projects ?? []}
    />
  )
}
