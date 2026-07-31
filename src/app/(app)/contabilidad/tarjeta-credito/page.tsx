import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TarjetaCreditoClient from './TarjetaCreditoClient'

export default async function TarjetaCreditoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: movimientos } = await supabase
    .from('tarjeta_credito')
    .select('*, tipo_gasto:tipos_gasto(numero, nombre)')
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })

  const { data: tipos } = await supabase.from('tipos_gasto').select('id, numero, nombre').order('numero')

  return <TarjetaCreditoClient movimientos={movimientos ?? []} tipos={tipos ?? []}/>
}
