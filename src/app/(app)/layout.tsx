import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
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

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Use admin client to read custom_role_id — RLS on users table may not
  // expose this column to the user themselves via the regular client.
  const { data: fullProfile } = await admin
    .from('users')
    .select('custom_role_id')
    .eq('id', user.id)
    .single()
  const customRoleId = fullProfile?.custom_role_id ?? null

  const isAdmin = ['admin', 'gerente_operaciones'].includes(profile?.role ?? '')
  let canSeeOnlineUsers = isAdmin
  let canManageNews = isAdmin
  let customRoleName: string | null = null
  let customPermissions: string[] = []

  if (customRoleId) {
    const [{ data: customRole }, { data: perms }] = await Promise.all([
      admin.from('roles').select('name').eq('id', customRoleId).single(),
      admin.from('role_permissions').select('module, can_read').eq('role_id', customRoleId),
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
