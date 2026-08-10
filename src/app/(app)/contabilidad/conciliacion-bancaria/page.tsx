import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { hasModuleAccess } from '@/lib/permissions'
import ConciliacionBancariaClient from './ConciliacionBancariaClient'

export default async function ConciliacionBancariaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!(await hasModuleAccess(supabase, user?.id, 'contabilidad'))) redirect('/dashboard')

  const { data: movimientos } = await supabase
    .from('conciliacion_bancaria')
    .select('*')
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })

  const { data: clasificaciones } = await supabase.from('banco_clasificaciones').select('*').order('descripcion')

  const { data: documentos } = await supabase
    .from('documentos_ia_importados')
    .select('id, archivo_nombre, archivo_path, cantidad_registros, created_at')
    .eq('seccion', 'conciliacion_bancaria')
    .order('created_at', { ascending: false })

  return <ConciliacionBancariaClient movimientos={movimientos ?? []} clasificaciones={clasificaciones ?? []} documentos={documentos ?? []}/>
}
