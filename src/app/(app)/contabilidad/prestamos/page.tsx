import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { hasModuleAccess } from '@/lib/permissions'
import PrestamosClient from './PrestamosClient'

export default async function PrestamosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!(await hasModuleAccess(supabase, user?.id, 'contabilidad'))) redirect('/dashboard')

  const { data: prestamos } = await supabase
    .from('prestamos')
    .select('*')
    .order('fecha_inicio', { ascending: false })

  const { data: devengamientos } = await supabase
    .from('prestamo_devengamientos')
    .select('prestamo_id')

  const mesesDevengados = new Map<string, number>()
  for (const d of devengamientos ?? []) {
    mesesDevengados.set(d.prestamo_id, (mesesDevengados.get(d.prestamo_id) ?? 0) + 1)
  }

  return <PrestamosClient prestamos={prestamos ?? []} mesesDevengados={Object.fromEntries(mesesDevengados)}/>
}
