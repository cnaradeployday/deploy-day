import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FacturasClientesClient from './FacturasClientesClient'

export default async function FacturasClientesPage({ searchParams }: { searchParams: Promise<Record<string,string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: facturas } = await supabase
    .from('facturas_clientes')
    .select('*, client:clients(name), project:projects(name)')
    .order('fecha_vencimiento', { ascending: true })

  // Tipo de cambio más reciente
  const { data: cotiz } = await supabase
    .from('cotizaciones')
    .select('usd_ars, fecha')
    .order('fecha', { ascending: false })
    .limit(1)
  const tipoCambio = cotiz?.[0]?.usd_ars ?? null

  // Clientes únicos para filtro
  const clientes = [...new Map(
    (facturas ?? []).map(f => [(f.client as any)?.name, (f.client as any)?.name])
  ).values()].filter(Boolean).sort() as string[]

  // Meses únicos para filtro
  const meses = [...new Set((facturas ?? []).map(f => f.mes_servicio).filter(Boolean))].sort().reverse() as string[]

  return (
    <FacturasClientesClient
      facturas={facturas ?? []}
      tipoCambio={tipoCambio}
      clientes={clientes}
      meses={meses}
    />
  )
}
