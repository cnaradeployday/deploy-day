import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ResumenFacturasClient from './ResumenFacturasClient'

export default async function ResumenFacturasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('role, custom_role_id').eq('id', user.id).single()

  const isAdmin = profile?.role === 'admin'
  let canAccess = isAdmin
  if (!canAccess && profile?.custom_role_id) {
    const { data: perm } = await supabase
      .from('role_permissions').select('can_read')
      .eq('role_id', profile.custom_role_id).eq('module', 'resumen_facturas').single()
    canAccess = perm?.can_read ?? false
  }
  if (!canAccess) redirect('/dashboard')

  const { data: clientes } = await supabase
    .from('clients')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  const now = new Date()
  const mesActual = now.toISOString().slice(0, 7)
  // First day of the month 11 months ago = start of the 12-month window
  const hace12Meses = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 7)

  const { data: facturas } = await supabase
    .from('facturas_clientes')
    .select('id, client_id, mes_servicio, importe, currency, estado, fecha_vencimiento, numero')
    .gte('mes_servicio', hace12Meses)
    .lte('mes_servicio', mesActual)
    .not('mes_servicio', 'is', null)

  return (
    <ResumenFacturasClient
      clientes={clientes ?? []}
      facturas={facturas ?? []}
      hace12Meses={hace12Meses}
    />
  )
}
