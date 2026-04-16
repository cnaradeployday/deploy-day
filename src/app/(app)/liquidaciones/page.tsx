import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LiquidacionesColaborador from './LiquidacionesColaborador'
import LiquidacionesAdmin from './LiquidacionesAdmin'

export default async function LiquidacionesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('*').eq('id', user?.id ?? '').single()
  if (!profile) redirect('/login')

  const sp = await searchParams
  const isColaborador = profile.role === 'colaborador'
  const tab = sp.tab ?? (isColaborador ? 'mis-liquidaciones' : 'resumen')
  const selectedMes = sp.mes ?? new Date().toISOString().slice(0, 7)

  if (isColaborador) {
    const { data: liquidaciones } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('user_id', user?.id)
      .order('mes', { ascending: false })

    return (
      <LiquidacionesColaborador
        liquidaciones={liquidaciones ?? []}
        userId={user?.id ?? ''}
        profile={profile}
        tab={tab}
      />
    )
  }

  const { data: liqDelMesRaw } = await supabase
    .from('liquidaciones')
    .select('*')
    .eq('mes', selectedMes)
    .order('estado', { ascending: true })

  const { data: conFacturaRaw } = await supabase
    .from('liquidaciones')
    .select('*')
    .eq('estado', 'factura_subida')
    .order('mes', { ascending: false })

  const { data: misLiquidaciones } = await supabase
    .from('liquidaciones')
    .select('*')
    .eq('user_id', user?.id)
    .order('mes', { ascending: false })

  const { data: allUsers } = await supabase
    .from('users')
    .select('id, full_name, hourly_cost, currency, banco, cbu, cuenta_nombre, role')
    .order('full_name')

  const usersMap = Object.fromEntries((allUsers ?? []).map(u => [u.id, u]))
  const liqDelMes = (liqDelMesRaw ?? []).map(l => ({ ...l, user: usersMap[l.user_id] ?? null }))
  const conFactura = (conFacturaRaw ?? []).map(l => ({ ...l, user: usersMap[l.user_id] ?? null }))

  return (
    <LiquidacionesAdmin
      liqDelMes={liqDelMes}
      conFactura={conFactura}
      misLiquidaciones={misLiquidaciones ?? []}
      allUsers={allUsers ?? []}
      userRole={profile.role}
      currentUserId={user?.id ?? ''}
      currentUserName={profile.full_name ?? ''}
      currentUserProfile={profile}
      tab={tab}
      selectedMes={selectedMes}
    />
  )
}
