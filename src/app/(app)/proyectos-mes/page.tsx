import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProyectosMesClient from './ProyectosMesClient'
import { currentMonthAR, monthBounds } from '@/lib/utils/date'

export default async function ProyectosMesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('role, custom_role_id').eq('id', user.id).single()

  const isAdmin = ['admin', 'gerente_operaciones'].includes(profile?.role ?? '')
  let canAccess = isAdmin
  if (!canAccess && profile?.custom_role_id) {
    const { data: perm } = await supabase
      .from('role_permissions').select('can_read')
      .eq('role_id', profile.custom_role_id).eq('module', 'proyectos_mes').single()
    canAccess = perm?.can_read ?? false
  }
  if (!canAccess) redirect('/dashboard')

  const sp = await searchParams
  const mesActual = currentMonthAR()
  const mes = sp.mes ?? mesActual
  const { primerDia, ultimoDia } = monthBounds(mes)

  // Proyectos que tienen segmentos en el mes
  const { data: segmentos } = await supabase
    .from('project_hour_segments')
    .select('project_id, horas')
    .lte('desde', ultimoDia)
    .gte('hasta', primerDia)

  const proyectoIds = [...new Set((segmentos ?? []).map(s => s.project_id))]

  const { data: proyectos } = proyectoIds.length
    ? await supabase
        .from('projects')
        .select('id, name, service_type, sold_hours, is_active, start_date, end_date, price_per_hour, currency, client:clients(id, name)')
        .in('id', proyectoIds)
        .order('name')
    : { data: [] }

  // Horas del segmento del mes por proyecto
  const horasMes: Record<string, number> = {}
  ;(segmentos ?? []).forEach(s => {
    horasMes[s.project_id] = (horasMes[s.project_id] ?? 0) + s.horas
  })

  const clientes = [...new Map(
    (proyectos ?? []).map(p => [(p.client as any)?.id, p.client])
  ).values()].filter(Boolean) as any[]

  const filas = (proyectos ?? []).map(p => ({
    id: p.id,
    nombre: p.name,
    cliente: (p.client as any)?.name ?? '—',
    clienteId: (p.client as any)?.id ?? '',
    servicio: p.service_type ?? '',
    horasMes: horasMes[p.id] ?? 0,
    soldHours: p.sold_hours ?? 0,
    precioHora: p.price_per_hour ?? null,
    moneda: p.currency ?? 'USD',
    startDate: p.start_date ?? null,
    endDate: p.end_date ?? null,
    isActive: p.is_active,
  }))


  // Meses disponibles desde segmentos de proyectos
  const { data: todosSegmentos } = await supabase
    .from('project_hour_segments')
    .select('desde')
    .order('desde', { ascending: false })

  const mesesSet = new Set<string>()

  // Agregar meses de segmentos
  ;(todosSegmentos ?? []).forEach((s: any) => {
    if (s.desde) mesesSet.add(s.desde.slice(0, 7))
  })

  // Agregar meses de fechas de proyectos activos
  const { data: proyFechas } = await supabase
    .from('projects')
    .select('start_date, end_date')
    .eq('is_active', true)

  ;(proyFechas ?? []).forEach((p: any) => {
    if (!p.start_date) return
    let [y, m] = p.start_date.slice(0, 7).split('-').map(Number)
    let finY: number, finM: number
    if (p.end_date) {
      ;[finY, finM] = p.end_date.slice(0, 7).split('-').map(Number)
    } else {
      const [hoyY, hoyM] = currentMonthAR().split('-').map(Number)
      const total = hoyM + 6
      finY = hoyY + Math.floor((total - 1) / 12)
      finM = ((total - 1) % 12) + 1
    }
    while (y < finY || (y === finY && m <= finM)) {
      mesesSet.add(`${y}-${String(m).padStart(2, '0')}`)
      m++
      if (m > 12) { m = 1; y++ }
    }
  })

  const mesesDisponibles = [...mesesSet].sort().reverse()
  if (!mesesDisponibles.includes(mesActual)) mesesDisponibles.unshift(mesActual)

  return (
    <ProyectosMesClient
      filas={filas}
      clientes={clientes}
      mes={mes}
      mesActual={mesActual}
      mesesDisponibles={mesesDisponibles}
    />
  )
}
