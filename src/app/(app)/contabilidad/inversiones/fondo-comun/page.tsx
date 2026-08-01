import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FondoComunClient from './FondoComunClient'

export default async function FondoComunPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: movimientos } = await supabase
    .from('inversiones_fci_movimientos')
    .select('*')
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })

  const { data: cierres } = await supabase
    .from('inversiones_fci_cierres_mensuales')
    .select('*')
    .order('mes', { ascending: false })

  return <FondoComunClient movimientos={movimientos ?? []} cierres={cierres ?? []}/>
}
