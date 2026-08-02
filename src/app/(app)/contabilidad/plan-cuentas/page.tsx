import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlanCuentasClient from './PlanCuentasClient'

export default async function PlanCuentasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: cuentas } = await supabase.from('plan_cuentas').select('*').order('categoria').order('subcategoria').order('orden')

  return <PlanCuentasClient cuentas={cuentas ?? []}/>
}
