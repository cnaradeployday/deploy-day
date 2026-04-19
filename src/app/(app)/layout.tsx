import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, role, custom_role_id')
    .eq('id', user.id)
    .single()

  const isAdmin = ['admin', 'gerente_operaciones'].includes(profile?.role ?? '')
  let canSeeOnlineUsers = isAdmin
  let customRoleName: string | null = null
  let customPermissions: string[] = []

  if (profile?.custom_role_id) {
    const [{ data: customRole }, { data: perms }] = await Promise.all([
      supabase
        .from('custom_roles')
        .select('name')
        .eq('id', profile.custom_role_id)
        .single(),
      supabase
        .from('role_permissions')
        .select('module, can_read')
        .eq('role_id', profile.custom_role_id),
    ])
    customRoleName = customRole?.name ?? null
    if (perms) {
      customPermissions = perms.filter(p => p.can_read).map(p => p.module)
      if (!canSeeOnlineUsers) {
        canSeeOnlineUsers = perms.some(p => p.module === 'online_users' && p.can_read)
      }
    }
  }

  return (
    <AppLayout
      userRole={profile?.role ?? 'colaborador'}
      userName={profile?.full_name ?? ''}
      userId={user.id}
      customRoleName={customRoleName}
      customPermissions={customPermissions}
      canSeeOnlineUsers={canSeeOnlineUsers}
    >
      {children}
    </AppLayout>
  )
}
