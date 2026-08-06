import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { hasModuleAccess } from '@/lib/permissions'
import TarjetaCreditoClient from './TarjetaCreditoClient'

export default async function TarjetaCreditoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!(await hasModuleAccess(supabase, user?.id, 'contabilidad'))) redirect('/dashboard')

  const { data: movimientos } = await supabase
    .from('tarjeta_credito')
    .select('*, tipo_gasto:tipos_gasto(numero, nombre)')
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })

  const { data: tipos } = await supabase.from('tipos_gasto').select('id, numero, nombre').order('numero')

  const { data: documentos } = await supabase
    .from('documentos_ia_importados')
    .select('id, archivo_nombre, archivo_path, cantidad_registros, created_at')
    .eq('seccion', 'tarjeta_credito')
    .order('created_at', { ascending: false })

  return <TarjetaCreditoClient movimientos={movimientos ?? []} tipos={tipos ?? []} documentos={documentos ?? []}/>
}
