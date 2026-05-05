import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Hourglass } from 'lucide-react'
import ActiveTimersClient from './ActiveTimersClient'

export default async function CronometrosActivosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, custom_role_id')
    .eq('id', user.id)
    .single()

  const isAdmin = ['admin', 'gerente_operaciones'].includes(profile?.role ?? '')
  let canAccess = isAdmin

  if (!canAccess && profile?.custom_role_id) {
    const { data: perm } = await supabase
      .from('role_permissions')
      .select('can_read')
      .eq('role_id', profile.custom_role_id)
      .eq('module', 'cronometros_activos')
      .single()
    canAccess = perm?.can_read ?? false
  }

  if (!canAccess) redirect('/dashboard')

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Hourglass size={20} className="text-green-600" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Cronómetros activos</h1>
          <p className="text-xs text-gray-400 mt-0.5">Usuarios con cronómetro corriendo en este momento</p>
        </div>
      </div>
      <ActiveTimersClient currentUserId={user.id} />
    </div>
  )
}
