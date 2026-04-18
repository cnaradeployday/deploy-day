import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FacturacionClient from './FacturacionClient'

export default async function FacturacionPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const sp = await searchParams
  const mesActual = new Date().toISOString().slice(0, 7)
  const mes = sp.mes ?? mesActual

  const [anio, mesNum] = mes.split('-').map(Number)
  const primerDia = new Date(anio, mesNum - 1, 1).toISOString().split('T')[0]
  const ultimoDia = new Date(anio, mesNum, 0).toISOString().split('T')[0]

  const { data: proyectos } = await supabase
    .from('projects')
    .select('id, name, price_per_hour, currency, sold_hours, client:clients(id, name)')
    .eq('is_active', true)
    .order('name')

  const proyectoIds = (proyectos ?? []).map(p => p.id)

  const { data: segmentos } = proyectoIds.length
    ? await supabase
        .from('project_hour_segments')
        .select('project_id, horas')
        .in('project_id', proyectoIds)
        .lte('desde', ultimoDia)
        .gte('hasta', primerDia)
    : { data: [] }

  const { data: cotizMes } = await supabase
    .from('cotizaciones')
    .select('fecha, usd_ars')
    .lte('fecha', ultimoDia)
    .order('fecha', { ascending: false })
    .limit(1)

  const tipoCambio = cotizMes?.[0]?.usd_ars ?? null
  const fechaCotiz = cotizMes?.[0]?.fecha ?? null

  const horasPorProyecto: Record<string, number> = {}
  ;(segmentos ?? []).forEach(s => {
    horasPorProyecto[s.project_id] = (horasPorProyecto[s.project_id] ?? 0) + s.horas
  })

  const clienteMap: Record<string, any> = {}

  ;(proyectos ?? []).filter(p => horasPorProyecto[p.id] !== undefined).forEach(p => {
    const cId = (p.client as any)?.id ?? 'sin-cliente'
    const cNombre = (p.client as any)?.name ?? '—'
    const horasVendidas = horasPorProyecto[p.id] ?? 0
    const precioHora = p.price_per_hour ?? null
    const moneda = p.currency ?? 'USD'

    let facturacionARS: number | null = null
    let facturacionUSD: number | null = null

    if (precioHora !== null && precioHora > 0) {
      if (moneda === 'USD') {
        facturacionUSD = Math.round(horasVendidas * precioHora * 100) / 100
        facturacionARS = tipoCambio ? Math.round(facturacionUSD * tipoCambio) : null
      } else {
        facturacionARS = Math.round(horasVendidas * precioHora)
        facturacionUSD = tipoCambio ? Math.round((facturacionARS / tipoCambio) * 100) / 100 : null
      }
    }

    if (!clienteMap[cId]) clienteMap[cId] = { clienteId: cId, clienteNombre: cNombre, proyectos: [] }
    clienteMap[cId].proyectos.push({ id: p.id, nombre: p.name, horasVendidas, precioHora, moneda, facturacionARS, facturacionUSD })
  })

  const filas = Object.values(clienteMap).sort((a: any, b: any) => a.clienteNombre.localeCompare(b.clienteNombre))
  const totalHoras = filas.reduce((s: number, c: any) => s + c.proyectos.reduce((ps: number, p: any) => ps + p.horasVendidas, 0), 0)
  const totalUSD = filas.reduce((s: number, c: any) => s + c.proyectos.reduce((ps: number, p: any) => ps + (p.facturacionUSD ?? 0), 0), 0)
  const totalARS = filas.reduce((s: number, c: any) => s + c.proyectos.reduce((ps: number, p: any) => ps + (p.facturacionARS ?? 0), 0), 0)

  return (
    <FacturacionClient
      filas={filas} mes={mes} mesActual={mesActual}
      tipoCambio={tipoCambio} fechaCotiz={fechaCotiz}
      totalHoras={Math.round(totalHoras * 10) / 10}
      totalUSD={Math.round(totalUSD * 100) / 100}
      totalARS={Math.round(totalARS)}
    />
  )
}
