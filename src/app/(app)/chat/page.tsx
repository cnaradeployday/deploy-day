import { createClient } from '@/lib/supabase/server'
import ChatLayout from './ChatLayout'

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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

  const { data: globalMessages } = await supabase
    .from('messages')
    .select('id, content, created_at, mentions, task_id, project_id, is_global, user:users(id, full_name), task:tasks(id, title), project:projects(id, name)')
    .eq('is_global', true)
    .order('created_at', { ascending: true })
    .limit(100)

  const { data: myConversations } = await supabase
    .from('conversation_members')
    .select(`
      conversation_id, last_read_at,
      conversation:conversations(
        id, name, is_group, created_at,
        conversation_members(user_id, user:users(id, full_name))
      )
    `)
    .eq('user_id', user?.id)
    .order('joined_at', { ascending: false })

  return (
    <ChatLayout
      currentUserId={user?.id ?? ''}
      users={users ?? []}
      tasks={tasks ?? []}
      projects={projects ?? []}
      globalMessages={globalMessages ?? []}
      conversations={myConversations ?? []}
    />
  )
}
EOFcat > "src/app/(app)/chat/page.tsx" << 'EOF'
import { createClient } from '@/lib/supabase/server'
import ChatLayout from './ChatLayout'

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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

  const { data: globalMessages } = await supabase
    .from('messages')
    .select('id, content, created_at, mentions, task_id, project_id, is_global, user:users(id, full_name), task:tasks(id, title), project:projects(id, name)')
    .eq('is_global', true)
    .order('created_at', { ascending: true })
    .limit(100)

  const { data: myConversations } = await supabase
    .from('conversation_members')
    .select(`
      conversation_id, last_read_at,
      conversation:conversations(
        id, name, is_group, created_at,
        conversation_members(user_id, user:users(id, full_name))
      )
    `)
    .eq('user_id', user?.id)
    .order('joined_at', { ascending: false })

  return (
    <ChatLayout
      currentUserId={user?.id ?? ''}
      users={users ?? []}
      tasks={tasks ?? []}
      projects={projects ?? []}
      globalMessages={globalMessages ?? []}
      conversations={myConversations ?? []}
    />
  )
}
