import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CotizacionesClient from './CotizacionesClient'

export default async function CotizacionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: cotizaciones } = await supabase
    .from('cotizaciones')
    .select('*')
    .order('fecha', { ascending: false })
    .limit(60)

  return <CotizacionesClient cotizaciones={cotizaciones ?? []} />
}
