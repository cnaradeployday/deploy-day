import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LiquidacionesColaborador from './LiquidacionesColaborador'
import LiquidacionesAdmin from './LiquidacionesAdmin'

export default async function LiquidacionesPage({ searchParams }: { searchParams: Promise<Record<string,string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('*').eq('id', user?.id ?? '').single()
  if (!profile) redirect('/login')

  const sp = await searchParams
  const isColaborador = profile.role === 'colaborador'
  const defaultTab = isColaborador ? 'mis-liquidaciones' : 'resumen'
  const tab = sp.tab ?? defaultTab

  if (isColaborador) {
    const { data: liquidaciones } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('user_id', user?.id)
      .order('mes', { ascending: false })

    const liqData = liquidaciones ?? []
    return (
      <LiquidacionesColaborador
        liquidaciones={liqData}
        userId={user?.id ?? ''}
        profile={profile}
        tab={tab}
      />
    )
  }

  const { data: liquidaciones } = await supabase
    .from('liquidaciones')
    .select('*, user:users(id, full_name, hourly_cost, currency, banco, cbu, cuenta_nombre)')
    .order('mes', { ascending: false })

  const { data: allUsers } = await supabase
    .from('users')
    .select('id, full_name, hourly_cost, currency')
    .eq('is_active', true)
    .order('full_name')

  return (
    <LiquidacionesAdmin
      liquidaciones={liquidaciones ?? []}
      allUsers={allUsers ?? []}
      userRole={profile.role}
      currentUserId={user?.id ?? ''}
      tab={tab}
    />
  )
}
