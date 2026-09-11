import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { hasModuleAccess } from '@/lib/permissions'
import PlazoFijoClient from './PlazoFijoClient'

export default async function PlazoFijoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!(await hasModuleAccess(supabase, user?.id, 'contabilidad'))) redirect('/dashboard')

  const { data: plazos } = await supabase
    .from('inversiones_plazo_fijo')
    .select('*')
    .order('fecha_inicio', { ascending: false })

  return <PlazoFijoClient plazos={plazos ?? []}/>
}
