import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { hasModuleAccess } from '@/lib/permissions'
import FondoComunClient from './FondoComunClient'

export default async function FondoComunPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!(await hasModuleAccess(supabase, user?.id, 'contabilidad'))) redirect('/dashboard')

  const { data: movimientos } = await supabase
    .from('inversiones_fci_movimientos')
    .select('*')
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })

  const { data: cierres } = await supabase
    .from('inversiones_fci_cierres_mensuales')
    .select('*')
    .order('mes', { ascending: false })

  const { data: documentos } = await supabase
    .from('documentos_ia_importados')
    .select('id, archivo_nombre, archivo_path, cantidad_registros, created_at')
    .eq('seccion', 'fondo_comun_inversion')
    .order('created_at', { ascending: false })

  return <FondoComunClient movimientos={movimientos ?? []} cierres={cierres ?? []} documentos={documentos ?? []}/>
}
