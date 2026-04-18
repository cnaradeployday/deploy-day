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

  if (!canSeeOnlineUsers && profile?.custom_role_id) {
    const { data: perm } = await supabase
      .from('role_permissions').select('can_read')
      .eq('role_id', profile.custom_role_id).eq('module', 'online_users').single()
    canSeeOnlineUsers = perm?.can_read ?? false
  }

  return (
    <AppLayout
      userRole={profile?.role ?? 'colaborador'}
      userName={profile?.full_name ?? ''}
      userId={user.id}
      canSeeOnlineUsers={canSeeOnlineUsers}
    >
      {children}
    </AppLayout>
  )
}
