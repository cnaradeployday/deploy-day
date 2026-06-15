import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { checkComputedNotifications, fetchNotifications } from './actions'
import NovedadesClient from './NovedadesClient'

export default async function NovedadesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('role, custom_role_id').eq('id', user.id).single()

  const isAdmin = ['admin', 'gerente_operaciones'].includes(profile?.role ?? '')
  let canAccess = isAdmin
  if (!canAccess && profile?.custom_role_id) {
    const { data: perm } = await supabase
      .from('role_permissions').select('can_read')
      .eq('role_id', profile.custom_role_id).eq('module', 'novedades').single()
    canAccess = perm?.can_read ?? false
  }
  if (!canAccess) redirect('/dashboard')

  await checkComputedNotifications()
  const { data: notifications } = await fetchNotifications()

  return <NovedadesClient initialNotifications={notifications} />
}
