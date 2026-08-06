import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { hasModuleAccess } from '@/lib/permissions'
import PlanCuentasClient from './PlanCuentasClient'

export default async function PlanCuentasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!(await hasModuleAccess(supabase, user?.id, 'contabilidad'))) redirect('/dashboard')

  const { data: cuentas } = await supabase.from('plan_cuentas').select('*').order('categoria').order('subcategoria').order('orden')

  return <PlanCuentasClient cuentas={cuentas ?? []}/>
}
