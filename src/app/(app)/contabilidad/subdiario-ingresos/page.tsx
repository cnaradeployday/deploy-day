import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { hasModuleAccess } from '@/lib/permissions'
import SubdiarioFacturasClient from '../SubdiarioFacturasClient'
import { fetchSubdiarioFacturas } from '../data'

export default async function SubdiarioIngresosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!(await hasModuleAccess(supabase, user?.id, 'contabilidad'))) redirect('/dashboard')

  const { facturas, clientes, meses } = await fetchSubdiarioFacturas(supabase)

  return (
    <SubdiarioFacturasClient
      title="Subdiario de Ingresos"
      subtitle="Facturas de sociedad SAS · importe neto y estado de cobro"
      facturas={facturas}
      clientes={clientes}
      meses={meses}
      montoKey="importe_neto"
      montoLabel="Importe neto"
      showEstado={true}
      exportFilename="subdiario_ingresos"
    />
  )
}
