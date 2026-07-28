import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ResumenFacturasClient from './ResumenFacturasClient'

function getMonthsOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
}

export default async function ResumenFacturasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const sp = await searchParams
  const currentYear = new Date().getFullYear()
  const year = Number(sp.year) || currentYear

  const months = getMonthsOfYear(year)

  const { data: facturas } = await supabase
    .from('facturas_clientes')
    .select('id, client_id, mes_servicio, importe, currency, estado, fecha_vencimiento, client:clients(id, name)')
    .gte('mes_servicio', months[0])
    .lte('mes_servicio', months[11])

  // Años disponibles para el selector (siempre incluye el año en curso)
  const { data: mesesTodos } = await supabase.from('facturas_clientes').select('mes_servicio')
  const yearsWithData = new Set(
    (mesesTodos ?? []).map(f => Number(f.mes_servicio?.slice(0, 4))).filter(Boolean)
  )
  yearsWithData.add(currentYear)
  const availableYears = [...yearsWithData].sort((a, b) => b - a)

  // Todos los clientes, para el filtro multi-selector
  const { data: clientesAll } = await supabase.from('clients').select('id, name').order('name')

  // Tipo de cambio más reciente
  const { data: cotiz } = await supabase
    .from('cotizaciones')
    .select('usd_ars, fecha')
    .order('fecha', { ascending: false })
    .limit(1)
  const tipoCambio = cotiz?.[0]?.usd_ars ?? null

  return (
    <ResumenFacturasClient
      facturas={facturas ?? []}
      months={months}
      year={year}
      availableYears={availableYears}
      clientesAll={clientesAll ?? []}
      tipoCambio={tipoCambio}
    />
  )
}
