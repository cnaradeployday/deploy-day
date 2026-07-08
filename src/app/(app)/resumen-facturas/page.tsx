import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ResumenFacturasClient from './ResumenFacturasClient'

function getLast12Months(): string[] {
  const months: string[] = []
  const today = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    months.push(d.toISOString().slice(0, 7))
  }
  return months
}

export default async function ResumenFacturasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const months = getLast12Months()

  const { data: facturas } = await supabase
    .from('facturas_clientes')
    .select('id, client_id, mes_servicio, importe, currency, estado, fecha_vencimiento, client:clients(id, name)')
    .in('mes_servicio', months)

  return <ResumenFacturasClient facturas={facturas ?? []} months={months} />
}
