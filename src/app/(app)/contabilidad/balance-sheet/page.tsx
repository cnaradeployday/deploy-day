import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { hasModuleAccess } from '@/lib/permissions'
import BalanceSheetClient from './BalanceSheetClient'

export default async function BalanceSheetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!(await hasModuleAccess(supabase, user?.id, 'contabilidad'))) redirect('/dashboard')

  const { data: cuentas } = await supabase
    .from('plan_cuentas')
    .select('*')
    .in('categoria', ['activo', 'pasivo', 'patrimonio_neto', 'resultado'])
    .order('categoria').order('subcategoria').order('orden')

  return <BalanceSheetClient cuentas={cuentas ?? []}/>
}
