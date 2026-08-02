import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EstadoResultadosClient from './EstadoResultadosClient'

export default async function EstadoResultadosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: cuentas } = await supabase
    .from('plan_cuentas')
    .select('*')
    .eq('categoria', 'resultado')
    .order('subcategoria').order('orden')

  return <EstadoResultadosClient cuentas={cuentas ?? []}/>
}
