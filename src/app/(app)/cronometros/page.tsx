import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CronometrosClient from './CronometrosClient'

export default async function CronometrosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, custom_role_id')
    .eq('id', user.id)
    .single()

  const isRoleAllowed = ['admin', 'gerente_operaciones'].includes(profile?.role ?? '')

  if (!isRoleAllowed && profile?.custom_role_id) {
    const { data: perm } = await supabase
      .from('role_permissions')
      .select('can_read')
      .eq('role_id', profile.custom_role_id)
      .eq('module', 'cronometros')
      .single()
    if (!perm?.can_read) redirect('/dashboard')
  } else if (!isRoleAllowed) {
    redirect('/dashboard')
  }

  return <CronometrosClient />
}
