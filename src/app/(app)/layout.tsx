import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, nickname, avatar_url, role, custom_role_id')
    .eq('id', user.id)
    .single()

  const isAdmin = ['admin', 'gerente_operaciones'].includes(profile?.role ?? '')
  let canSeeOnlineUsers = isAdmin
  let canManageNews = isAdmin
  let customRoleName: string | null = null
  let customPermissions: string[] = []

  if (profile?.custom_role_id) {
    const [{ data: customRole }, { data: perms }] = await Promise.all([
      supabase.from('custom_roles').select('name').eq('id', profile.custom_role_id).single(),
      supabase.from('role_permissions').select('module, can_read').eq('role_id', profile.custom_role_id),
    ])
    customRoleName = customRole?.name ?? null
    if (perms) {
      customPermissions = perms.filter(p => p.can_read).map(p => p.module)
      if (!canSeeOnlineUsers) canSeeOnlineUsers = perms.some(p => p.module === 'online_users' && p.can_read)
      if (!canManageNews) canManageNews = perms.some(p => p.module === 'news' && p.can_read)
    }
  }

  // News activo visible para este usuario
  const { data: activeNews } = await supabase
    .from('news')
    .select('id, content, visible_to')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  return (
    <AppLayout
      userRole={profile?.role ?? 'colaborador'}
      userName={profile?.nickname || profile?.full_name || ''}
      userId={user.id}
      avatarUrl={profile?.avatar_url ?? null}
      customRoleName={customRoleName}
      customPermissions={customPermissions}
      canSeeOnlineUsers={canSeeOnlineUsers}
      canManageNews={canManageNews}
      activeNews={activeNews ?? null}
    >
      {children}
    </AppLayout>
  )
}
