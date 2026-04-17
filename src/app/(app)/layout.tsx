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

  // Si tiene rol custom, traer sus permisos y el nombre del rol
  let customRoleName: string | null = null
  let customPermissions: string[] = []

  if (profile?.custom_role_id) {
    const [{ data: roleData }, { data: perms }] = await Promise.all([
      supabase.from('roles').select('name').eq('id', profile.custom_role_id).single(),
      supabase.from('role_permissions').select('module, can_read').eq('role_id', profile.custom_role_id),
    ])
    customRoleName = roleData?.name ?? null
    customPermissions = (perms ?? []).filter(p => p.can_read).map(p => p.module)
  }

  return (
    <AppLayout
      userRole={profile?.role ?? 'colaborador'}
      userName={profile?.full_name ?? ''}
      userId={user.id}
      customRoleName={customRoleName}
      customPermissions={customPermissions}
    >{children}</AppLayout>
  )
}
