import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TiposGastoClient from './TiposGastoClient'

export default async function TiposGastoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: tipos } = await supabase.from('tipos_gasto').select('*').order('numero')

  return <TiposGastoClient tipos={tipos ?? []}/>
}
