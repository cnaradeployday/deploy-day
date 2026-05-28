import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import OcupacionEquipoClient from './OcupacionEquipoClient'

export default async function OcupacionEquipoPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
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
      .eq('role_id', profile.custom_role_id).eq('module', 'ocupacion_equipo').single()
    canAccess = perm?.can_read ?? false
  }
  if (!canAccess) redirect('/dashboard')

  const sp = await searchParams
  const mesActual = new Date().toISOString().slice(0, 7)
  const mes = sp.mes ?? mesActual
  const [anio, mesNum] = mes.split('-').map(Number)
  const primerDia = new Date(anio, mesNum - 1, 1).toISOString().split('T')[0]
  const ultimoDia = new Date(anio, mesNum, 0).toISOString().split('T')[0]

  const { data: usuarios } = await supabase
    .from('users').select('id, full_name').eq('is_active', true).order('full_name')

  const userIds = (usuarios ?? []).map((u: any) => u.id)

  const { data: disponibilidades } = userIds.length ? await supabase
    .from('user_availability').select('user_id, horas')
    .in('user_id', userIds).lte('desde', ultimoDia).gte('hasta', primerDia)
    : { data: [] }

  const { data: tareasDirectas } = await supabase
    .from('tasks')
    .select('direct_responsible_id, direct_hours, project:projects(id, client:clients(id, name))')
    .not('status', 'in', '(presentado)')
    .gte('due_date', primerDia).lte('due_date', ultimoDia)
    .not('direct_responsible_id', 'is', null)

  const { data: tareasColab } = await supabase
    .from('task_collaborators')
    .select('user_id, assigned_hours, task:tasks(due_date, status, project:projects(id, client:clients(id, name)))')
    .gte('task.due_date', primerDia)
    .lte('task.due_date', ultimoDia)

  // Use admin client to bypass RLS so all users see totals for all team members
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: timeEntries } = userIds.length ? await admin
    .from('time_entries')
    .select('user_id, hours_logged, task:tasks(project:projects(id, client:clients(id, name)))')
    .in('user_id', userIds).gte('entry_date', primerDia).lte('entry_date', ultimoDia)
    : { data: [] }

  const disponibilidadPorUser: Record<string, number> = {}
  ;(disponibilidades ?? []).forEach((d: any) => {
    disponibilidadPorUser[d.user_id] = (disponibilidadPorUser[d.user_id] ?? 0) + d.horas
  })

  const programadasPorUser: Record<string, number> = {}
  ;(tareasDirectas ?? []).forEach((t: any) => {
    if (t.direct_responsible_id && t.direct_hours)
      programadasPorUser[t.direct_responsible_id] = (programadasPorUser[t.direct_responsible_id] ?? 0) + t.direct_hours
  })
  ;(tareasColab ?? []).filter((c: any) => {
    const dd = c.task?.due_date
    return dd && dd >= primerDia && dd <= ultimoDia && c.task?.status !== 'presentado'
  }).forEach((c: any) => {
    if (c.assigned_hours)
      programadasPorUser[c.user_id] = (programadasPorUser[c.user_id] ?? 0) + c.assigned_hours
  })

  const realizadasPorUser: Record<string, number> = {}
  ;(timeEntries ?? []).forEach((e: any) => {
    realizadasPorUser[e.user_id] = (realizadasPorUser[e.user_id] ?? 0) + e.hours_logged
  })

  const filas = (usuarios ?? []).map((u: any) => {
    const disponibilidad = Math.round((disponibilidadPorUser[u.id] ?? 0) * 10) / 10
    const programadas    = Math.round((programadasPorUser[u.id] ?? 0) * 10) / 10
    const realizadas     = Math.round((realizadasPorUser[u.id] ?? 0) * 10) / 10

    // Desglose por cliente
    const clienteMap: Record<string, { nombre: string; estimadas: number; realizadas: number }> = {}

    ;(tareasDirectas ?? []).filter((t: any) => t.direct_responsible_id === u.id).forEach((t: any) => {
      const cId = t.project?.client?.id ?? 'sin-cliente'
      const cNombre = t.project?.client?.name ?? 'Sin cliente'
      if (!clienteMap[cId]) clienteMap[cId] = { nombre: cNombre, estimadas: 0, realizadas: 0 }
      clienteMap[cId].estimadas += t.direct_hours ?? 0
    })

    ;(tareasColab ?? []).filter((c: any) => {
      const dd = c.task?.due_date
      return c.user_id === u.id && dd && dd >= primerDia && dd <= ultimoDia && c.task?.status !== 'presentado'
    }).forEach((c: any) => {
      const cId = c.task?.project?.client?.id ?? 'sin-cliente'
      const cNombre = c.task?.project?.client?.name ?? 'Sin cliente'
      if (!clienteMap[cId]) clienteMap[cId] = { nombre: cNombre, estimadas: 0, realizadas: 0 }
      clienteMap[cId].estimadas += c.assigned_hours ?? 0
    })

    ;(timeEntries ?? []).filter((e: any) => e.user_id === u.id).forEach((e: any) => {
      const cId = e.task?.project?.client?.id ?? 'sin-cliente'
      const cNombre = e.task?.project?.client?.name ?? 'Sin cliente'
      if (!clienteMap[cId]) clienteMap[cId] = { nombre: cNombre, estimadas: 0, realizadas: 0 }
      clienteMap[cId].realizadas += e.hours_logged ?? 0
    })

    const desglose = Object.values(clienteMap)
      .map(c => ({ ...c, estimadas: Math.round(c.estimadas * 10) / 10, realizadas: Math.round(c.realizadas * 10) / 10 }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))

    return { id: u.id, nombre: u.full_name, disponibilidad, programadas, realizadas,
      disponibles: Math.round((disponibilidad - programadas) * 10) / 10, desglose }
  })

  const { data: segmentos } = await supabase
    .from('project_hour_segments').select('desde').order('desde', { ascending: false })
  const mesesDisponibles = [...new Set(
    (segmentos ?? []).map((s: any) => s.desde?.slice(0, 7)).filter(Boolean)
  )].sort().reverse() as string[]
  if (!mesesDisponibles.includes(mesActual)) mesesDisponibles.unshift(mesActual)

  return <OcupacionEquipoClient filas={filas} mes={mes} mesActual={mesActual} mesesDisponibles={mesesDisponibles}/>
}
