import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BalanceSheetClient from './BalanceSheetClient'

export default async function BalanceSheetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: cuentas } = await supabase
    .from('plan_cuentas')
    .select('*')
    .in('categoria', ['activo', 'pasivo', 'patrimonio_neto', 'resultado'])
    .order('categoria').order('subcategoria').order('orden')

  return <BalanceSheetClient cuentas={cuentas ?? []}/>
}
