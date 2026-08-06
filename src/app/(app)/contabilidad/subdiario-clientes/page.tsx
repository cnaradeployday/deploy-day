import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { hasModuleAccess } from '@/lib/permissions'
import SubdiarioFacturasClient from '../SubdiarioFacturasClient'
import { fetchSubdiarioFacturas } from '../data'

export default async function SubdiarioClientesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!(await hasModuleAccess(supabase, user?.id, 'contabilidad'))) redirect('/dashboard')

  const { facturas, clientes, meses } = await fetchSubdiarioFacturas(supabase)

  return (
    <SubdiarioFacturasClient
      title="Subdiario de Cliente"
      subtitle="Facturas de sociedad SAS · importe total y estado de cobro"
      facturas={facturas}
      clientes={clientes}
      meses={meses}
      montoKey="importe"
      montoLabel="Importe total"
      showEstado={true}
      exportFilename="subdiario_clientes"
    />
  )
}
