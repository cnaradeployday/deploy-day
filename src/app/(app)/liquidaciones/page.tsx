import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LiquidacionesAdmin from './LiquidacionesAdmin'
import LiquidacionesColaborador from './LiquidacionesColaborador'

export default async function LiquidacionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role, full_name, hourly_cost').eq('id', user?.id ?? '').single()

  if (profile?.role === 'colaborador') {
    const { data: liquidaciones } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('user_id', user?.id)
      .order('mes', { ascending: false })

    return <LiquidacionesColaborador liquidaciones={liquidaciones ?? []} userId={user?.id ?? ''} profile={profile} />
  }

  if (['admin', 'gerente_operaciones'].includes(profile?.role ?? '')) {
    const { data: liquidaciones } = await supabase
      .from('liquidaciones')
      .select('*, user:users(id, full_name, hourly_cost)')
      .order('mes', { ascending: false })
      .order('estado', { ascending: true })

    return <LiquidacionesAdmin liquidaciones={liquidaciones ?? []} userRole={profile?.role ?? ''} currentUserId={user?.id ?? ''} />
  }

  redirect('/dashboard')
}
