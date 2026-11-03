import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import FacturaLLCForm from '../../nueva/FacturaLLCForm'
import type { FacturaLLC } from '@/lib/facturas/llc'

export default async function EditarFacturaLLCPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: f } = await supabase.from('facturas_clientes')
    .select('id, client_id, project_id, fecha_vencimiento, mes_servicio, factura_llc').eq('id', id).single()
  if (!f?.factura_llc) notFound()

  return <FacturaLLCForm editar={{
    id: f.id, clientId: f.client_id, projectId: f.project_id ?? '',
    vencimiento: f.fecha_vencimiento, mesServicio: f.mes_servicio ?? '',
    factura: f.factura_llc as FacturaLLC,
  }} />
}
