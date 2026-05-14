import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ActiveTimers from '@/components/ActiveTimers'
import { Timer } from 'lucide-react'

export default async function CronometrosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role, custom_role_id').eq('id', user.id).single()
  const isAdmin = ['admin', 'gerente_operaciones'].includes(profile?.role ?? '')
  let canAccess = isAdmin
  if (!canAccess && profile?.custom_role_id) {
    const { data: perm } = await supabase.from('role_permissions').select('can_read')
      .eq('role_id', profile.custom_role_id).eq('module', 'cronometros').single()
    canAccess = perm?.can_read ?? false
  }
  if (!canAccess) redirect('/dashboard')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Timer size={18} className="text-[#1B9BF0]"/> Cronómetros en curso
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Usuarios con cronómetros activos en tiempo real</p>
      </div>
      <ActiveTimers/>
    </div>
  )
}
