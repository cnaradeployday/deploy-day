import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ResumenFacturasClient from './ResumenFacturasClient'

// Meses YYYY-MM del 1 de enero al 31 de diciembre de un año dado
function monthsOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
}

const YEARS_BACK = 4 // años anteriores disponibles para elegir, ademas del actual

export default async function ResumenFacturasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: YEARS_BACK + 1 }, (_, i) => String(currentYear - i))
  const allMonths = years.flatMap(y => monthsOfYear(Number(y)))

  const { data: facturas } = await supabase
    .from('facturas_clientes')
    .select('id, client_id, mes_servicio, importe, currency, estado, fecha_vencimiento, client:clients(id, name)')
    .in('mes_servicio', allMonths)

  return <ResumenFacturasClient facturas={facturas ?? []} years={years} currentYear={String(currentYear)}/>
}
