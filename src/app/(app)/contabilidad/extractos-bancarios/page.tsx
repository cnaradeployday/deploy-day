import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ExtractosBancariosClient from './ExtractosBancariosClient'

export default async function ExtractosBancariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: clasificaciones } = await supabase.from('banco_clasificaciones').select('*').order('descripcion')

  return <ExtractosBancariosClient clasificaciones={clasificaciones ?? []}/>
}
