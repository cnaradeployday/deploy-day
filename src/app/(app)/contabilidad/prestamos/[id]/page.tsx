import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { hasModuleAccess } from '@/lib/permissions'
import PrestamoDetalleClient from './PrestamoDetalleClient'

export default async function PrestamoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!(await hasModuleAccess(supabase, user?.id, 'contabilidad'))) redirect('/dashboard')

  const { data: prestamo } = await supabase.from('prestamos').select('*').eq('id', id).single()
  if (!prestamo) notFound()

  const { data: devengamientos } = await supabase
    .from('prestamo_devengamientos')
    .select('*')
    .eq('prestamo_id', id)
    .order('mes', { ascending: true })

  return <PrestamoDetalleClient prestamo={prestamo} devengamientos={devengamientos ?? []}/>
}
