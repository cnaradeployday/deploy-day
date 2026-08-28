import { createClient } from '@/lib/supabase/server'
import ChatLayout from './ChatLayout'
import { applyNickname } from '@/lib/utils/displayName'

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profileNick } = await supabase.from('users').select('nickname').eq('id', user?.id ?? '').single()
  const nickname = profileNick?.nickname ?? null

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
    .order('full_name')

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title')
    .not('status', 'in', '("finalizado")')
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
        .select('user_id, user:users(id, full_name)')
        .eq('conversation_id', cm.conversation_id)
      return { ...cm, members: members ?? [] }
    })
  )

  const usersWithNick = applyNickname(users ?? [], user?.id ?? '', nickname)
  const messagesWithNick = applyNickname(globalMessages ?? [], user?.id ?? '', nickname)
  const convsWithNick = applyNickname(convsWithMembers, user?.id ?? '', nickname)

  return (
    <ChatLayout
      currentUserId={user?.id ?? ''}
      users={usersWithNick}
      tasks={tasks ?? []}
      projects={projects ?? []}
      globalMessages={messagesWithNick}
      conversations={convsWithNick}
    />
  )
}
