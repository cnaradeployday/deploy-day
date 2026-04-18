import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProyectosMesClient from './ProyectosMesClient'

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
  const mesActual = new Date().toISOString().slice(0, 7)
  const mes = sp.mes ?? mesActual
  const [anio, mesNum] = mes.split('-').map(Number)
  const primerDia = new Date(anio, mesNum - 1, 1).toISOString().split('T')[0]
  const ultimoDia = new Date(anio, mesNum, 0).toISOString().split('T')[0]

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

  return (
    <ProyectosMesClient
      filas={filas}
      clientes={clientes}
      mes={mes}
      mesActual={mesActual}
    />
  )
}
