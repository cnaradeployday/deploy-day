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
    .eq('is_active', true).order('name')

  const proyectoIds = (proyectos ?? []).map(p => p.id)

  const { data: segmentos } = proyectoIds.length
    ? await supabase.from('project_hour_segments').select('project_id, horas')
        .in('project_id', proyectoIds).lte('desde', ultimoDia).gte('hasta', primerDia)
    : { data: [] }

  const { data: tareas } = proyectoIds.length
    ? await supabase.from('tasks').select('id, project_id').in('project_id', proyectoIds)
    : { data: [] }

  const taskIds = (tareas ?? []).map(t => t.id)

  const { data: entries } = taskIds.length
    ? await supabase.from('time_entries').select('task_id, hours_logged, user_id')
        .in('task_id', taskIds).gte('entry_date', primerDia).lte('entry_date', ultimoDia)
    : { data: [] }

  const { data: usuarios } = await supabase
    .from('users').select('id, hourly_cost, currency').eq('is_active', true)

  const { data: cotizMes } = await supabase
    .from('cotizaciones').select('fecha, usd_ars')
    .lte('fecha', ultimoDia).order('fecha', { ascending: false }).limit(1)

  const tipoCambio = cotizMes?.[0]?.usd_ars ?? null
  const fechaCotiz = cotizMes?.[0]?.fecha ?? null

  const userMap: Record<string, { hourly_cost: number; currency: string }> = {}
  ;(usuarios ?? []).forEach(u => { userMap[u.id] = { hourly_cost: u.hourly_cost ?? 0, currency: u.currency ?? 'ARS' } })

  const taskProyecto: Record<string, string> = {}
  ;(tareas ?? []).forEach(t => { taskProyecto[t.id] = t.project_id })

  const horasPorProyecto: Record<string, number> = {}
  ;(segmentos ?? []).forEach(s => { horasPorProyecto[s.project_id] = (horasPorProyecto[s.project_id] ?? 0) + s.horas })

  const costoUSDPorProyecto: Record<string, number> = {}
  ;(entries ?? []).forEach(e => {
    const proyId = taskProyecto[e.task_id]
    if (!proyId) return
    const u = userMap[e.user_id]
    if (!u || !u.hourly_cost) return
    const costoUSD = u.currency === 'USD' ? e.hours_logged * u.hourly_cost
      : tipoCambio ? (e.hours_logged * u.hourly_cost) / tipoCambio : 0
    costoUSDPorProyecto[proyId] = (costoUSDPorProyecto[proyId] ?? 0) + costoUSD
  })

  const clienteMap: Record<string, any> = {}
  ;(proyectos ?? []).filter(p => horasPorProyecto[p.id] !== undefined).forEach(p => {
    const cId = (p.client as any)?.id ?? 'sin-cliente'
    const cNombre = (p.client as any)?.name ?? '—'
    const horasVendidas = horasPorProyecto[p.id] ?? 0
    const precioHora = p.price_per_hour ?? null
    const moneda = p.currency ?? 'USD'
    let facturacionUSD: number | null = null
    let facturacionARS: number | null = null
    if (precioHora && precioHora > 0) {
      if (moneda === 'USD') {
        facturacionUSD = Math.round(horasVendidas * precioHora * 100) / 100
        facturacionARS = tipoCambio ? Math.round(facturacionUSD * tipoCambio) : null
      } else {
        facturacionARS = Math.round(horasVendidas * precioHora)
        facturacionUSD = tipoCambio ? Math.round((facturacionARS / tipoCambio) * 100) / 100 : null
      }
    }
    const costoUSD = Math.round((costoUSDPorProyecto[p.id] ?? 0) * 100) / 100
    const costoARS = tipoCambio ? Math.round(costoUSD * tipoCambio) : null
    const rentabilidadUSD = facturacionUSD !== null ? Math.round((facturacionUSD - costoUSD) * 100) / 100 : null
    const rentabilidadARS = facturacionARS !== null && costoARS !== null ? Math.round(facturacionARS - costoARS) : null
    const margen = facturacionUSD && facturacionUSD > 0 && rentabilidadUSD !== null
      ? Math.round((rentabilidadUSD / facturacionUSD) * 100) : null
    if (!clienteMap[cId]) clienteMap[cId] = { clienteId: cId, clienteNombre: cNombre, proyectos: [] }
    clienteMap[cId].proyectos.push({ id: p.id, nombre: p.name, horasVendidas, precioHora, moneda, facturacionARS, facturacionUSD, costoUSD, costoARS, rentabilidadUSD, rentabilidadARS, margen })
  })

  const filas = Object.values(clienteMap).sort((a: any, b: any) => a.clienteNombre.localeCompare(b.clienteNombre))
  const totalHoras = filas.reduce((s: number, c: any) => s + c.proyectos.reduce((ps: number, p: any) => ps + p.horasVendidas, 0), 0)
  const totalUSD = filas.reduce((s: number, c: any) => s + c.proyectos.reduce((ps: number, p: any) => ps + (p.facturacionUSD ?? 0), 0), 0)
  const totalARS = filas.reduce((s: number, c: any) => s + c.proyectos.reduce((ps: number, p: any) => ps + (p.facturacionARS ?? 0), 0), 0)
  const totalCostoUSD = filas.reduce((s: number, c: any) => s + c.proyectos.reduce((ps: number, p: any) => ps + (p.costoUSD ?? 0), 0), 0)
  const totalRentabilidadUSD = Math.round((totalUSD - totalCostoUSD) * 100) / 100
  const totalMargen = totalUSD > 0 ? Math.round((totalRentabilidadUSD / totalUSD) * 100) : null

  return (
    <FacturacionClient
      filas={filas} mes={mes} mesActual={mesActual}
      tipoCambio={tipoCambio} fechaCotiz={fechaCotiz}
      totalHoras={Math.round(totalHoras * 10) / 10}
      totalUSD={Math.round(totalUSD * 100) / 100}
      totalARS={Math.round(totalARS)}
      totalCostoUSD={Math.round(totalCostoUSD * 100) / 100}
      totalRentabilidadUSD={totalRentabilidadUSD}
      totalMargen={totalMargen}
    />
  )
}
