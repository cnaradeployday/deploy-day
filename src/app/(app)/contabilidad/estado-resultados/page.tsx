import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { hasModuleAccess } from '@/lib/permissions'
import EstadoResultadosClient from './EstadoResultadosClient'

export default async function EstadoResultadosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!(await hasModuleAccess(supabase, user?.id, 'contabilidad'))) redirect('/dashboard')

  const { data: cuentas } = await supabase
    .from('plan_cuentas')
    .select('*')
    .eq('categoria', 'resultado')
    .order('subcategoria').order('orden')

  return <EstadoResultadosClient cuentas={cuentas ?? []}/>
}
