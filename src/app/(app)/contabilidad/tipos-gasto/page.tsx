import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { hasModuleAccess } from '@/lib/permissions'
import TiposGastoClient from './TiposGastoClient'

export default async function TiposGastoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!(await hasModuleAccess(supabase, user?.id, 'contabilidad'))) redirect('/dashboard')

  const { data: tipos } = await supabase.from('tipos_gasto').select('*').order('numero')

  return <TiposGastoClient tipos={tipos ?? []}/>
}
