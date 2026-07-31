import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FacturasCompraClient from './FacturasCompraClient'

export default async function FacturasCompraPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: facturas } = await supabase
    .from('facturas_compra')
    .select('*, tipo_gasto:tipos_gasto(numero, nombre)')
    .order('fecha_factura', { ascending: false })

  return <FacturasCompraClient facturas={facturas ?? []}/>
}
