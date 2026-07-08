import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { checkAllUsersComputedNotifications } from '../novedades/actions'
import NovedadesEquipoClient from './NovedadesEquipoClient'

export default async function NovedadesEquipoPage() {
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
      .eq('role_id', profile.custom_role_id).eq('module', 'novedades_equipo').single()
    canAccess = perm?.can_read ?? false
  }
  if (!canAccess) redirect('/dashboard')

  await checkAllUsersComputedNotifications()

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: notifications } = await admin
    .from('notifications')
    .select('*, user:users!notifications_user_id_fkey(id, full_name, avatar_url)')
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(200)

  return <NovedadesEquipoClient notifications={notifications ?? []} />
}
