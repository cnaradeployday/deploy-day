import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { hasModuleAccess } from '@/lib/permissions'
import ExtractosBancariosClient from './ExtractosBancariosClient'

export default async function ExtractosBancariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!(await hasModuleAccess(supabase, user?.id, 'contabilidad'))) redirect('/dashboard')

  const { data: clasificaciones } = await supabase.from('banco_clasificaciones').select('*').order('descripcion')

  return <ExtractosBancariosClient clasificaciones={clasificaciones ?? []}/>
}
