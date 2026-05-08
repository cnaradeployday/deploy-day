import { createClient } from '@/lib/supabase/server'
import ChatLayout from './ChatLayout'

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase.from('users').select('role, custom_role_id').eq('id', user?.id ?? '').single()
  const isAdmin = ['admin','gerente_operaciones'].includes(profile?.role ?? '')
  let canSeeOnlineChat = isAdmin
  if (!canSeeOnlineChat && profile?.custom_role_id) {
    const { data: perm } = await supabase.from('role_permissions').select('can_read')
      .eq('role_id', profile.custom_role_id).eq('module', 'online_chat').single()
    canSeeOnlineChat = perm?.can_read ?? false
  }

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
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
    .select('conversation_id, last_read_at, conversation:conversations(id, name, is_group, created_at)')
    .eq('user_id', user?.id)
    .order('joined_at', { ascending: false })

  const convsWithMembers = await Promise.all(
    (myConversations ?? []).map(async (cm) => {
      const { data: members } = await supabase
        .from('conversation_members')
        .select('user_id, last_read_at, user:users(id, full_name)')
        .eq('conversation_id', cm.conversation_id)
      return { ...cm, members: members ?? [] }
    })
  )

  return (
    <ChatLayout
      currentUserId={user?.id ?? ''}
      users={users ?? []}
      tasks={tasks ?? []}
      projects={projects ?? []}
      globalMessages={globalMessages ?? []}
      conversations={convsWithMembers}
      canSeeOnlineChat={canSeeOnlineChat}
    />
  )
}
