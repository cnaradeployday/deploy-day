import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LiquidacionesColaborador from './LiquidacionesColaborador'
import LiquidacionesAdmin from './LiquidacionesAdmin'
import { currentMonthAR } from '@/lib/utils/date'

export default async function LiquidacionesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('*').eq('id', user?.id ?? '').single()
  if (!profile) redirect('/login')

  const isAdmin = ['admin', 'gerente_operaciones'].includes(profile.role ?? '')
  // Custom role users need explicit liquidaciones permission
  if (!isAdmin && profile.custom_role_id) {
    const { data: perm } = await supabase
      .from('role_permissions').select('can_read')
      .eq('role_id', profile.custom_role_id).eq('module', 'liquidaciones').single()
    if (!perm?.can_read) redirect('/dashboard')
  }

  const sp = await searchParams
  const isColaborador = profile.role === 'colaborador'
  const tab = sp.tab ?? (isColaborador ? 'mis-liquidaciones' : 'resumen')
  const selectedMes = sp.mes ?? currentMonthAR()

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
