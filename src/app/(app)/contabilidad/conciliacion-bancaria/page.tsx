import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ConciliacionBancariaClient from './ConciliacionBancariaClient'

export default async function ConciliacionBancariaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: movimientos } = await supabase
    .from('conciliacion_bancaria')
    .select('*')
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })

  const { data: clasificaciones } = await supabase.from('banco_clasificaciones').select('*').order('descripcion')

  return <ConciliacionBancariaClient movimientos={movimientos ?? []} clasificaciones={clasificaciones ?? []}/>
}
