import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { hasModuleAccess } from '@/lib/permissions'
import PrestamoDetalleClient from './PrestamoDetalleClient'
import { combinarDevengamientos } from '@/lib/contabilidad/prestamos'
import { currentMonthAR } from '@/lib/utils/date'

export default async function PrestamoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!(await hasModuleAccess(supabase, user?.id, 'contabilidad'))) redirect('/dashboard')

  const { data: prestamo } = await supabase.from('prestamos').select('*').eq('id', id).single()
  if (!prestamo) notFound()

  const { data: devengamientos } = await supabase
    .from('prestamo_devengamientos')
    .select('id, prestamo_id, mes, monto')
    .eq('prestamo_id', id)

  // Meses cargados a mano + meses calculados automáticamente hasta el mes actual.
  const devengados = combinarDevengamientos([prestamo], devengamientos ?? [], currentMonthAR())

  return <PrestamoDetalleClient prestamo={prestamo} devengamientos={devengados}/>
}
