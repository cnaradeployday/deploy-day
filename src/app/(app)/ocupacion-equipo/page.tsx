import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import OcupacionEquipoClient from './OcupacionEquipoClient'

export default async function OcupacionEquipoPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('role, custom_role_id, nickname').eq('id', user.id).single()
  const nickname = profile?.nickname ?? null

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

  const adminSupabase = createAdminClient()

  const { data: tareasDirectas } = await adminSupabase
    .from('tasks')
    .select('id, title, status, due_date, direct_responsible_id, direct_hours, project:projects(name, client:clients(name))')
    .not('status', 'in', '(presentado,finalizado)')
    .gte('due_date', primerDia).lte('due_date', ultimoDia)
    .not('direct_responsible_id', 'is', null)

  const { data: tareasColab } = await adminSupabase
    .from('task_collaborators')
    .select('user_id, assigned_hours, task:tasks(id, title, status, due_date, project:projects(name, client:clients(name)))')
    .gte('task.due_date', primerDia)
    .lte('task.due_date', ultimoDia)

  // Sumado agrupado por usuario+tarea en Postgres (RPC) — evita el límite de 1000 filas
  // por consulta que PostgREST aplica al traer cada time_entry crudo.
  const { data: horasRows } = userIds.length
    ? await adminSupabase.rpc('sum_hours_by_user_task', { p_user_ids: userIds, p_from: primerDia, p_to: ultimoDia })
    : { data: [] }

  const disponibilidadPorUser: Record<string, number> = {}
  ;(disponibilidades ?? []).forEach((d: any) => {
    disponibilidadPorUser[d.user_id] = (disponibilidadPorUser[d.user_id] ?? 0) + d.horas
  })

  // Horas realizadas por usuario y tarea
  const realizadasPorUserTask: Record<string, Record<string, number>> = {}
  ;(horasRows ?? []).forEach((r: { user_id: string; task_id: string; total_hours: number }) => {
    if (!realizadasPorUserTask[r.user_id]) realizadasPorUserTask[r.user_id] = {}
    realizadasPorUserTask[r.user_id][r.task_id] = r.total_hours
  })

  const realizadasPorUser: Record<string, number> = {}
  Object.entries(realizadasPorUserTask).forEach(([uid, tasks]) => {
    realizadasPorUser[uid] = Object.values(tasks).reduce((s, h) => s + h, 0)
  })

  // Tareas detalle por usuario
  const tareasPorUser: Record<string, any[]> = {}

  ;(tareasDirectas ?? []).forEach((t: any) => {
    const uid = t.direct_responsible_id
    if (!uid) return
    if (!tareasPorUser[uid]) tareasPorUser[uid] = []
    tareasPorUser[uid].push({
      id: t.id,
      title: t.title,
      status: t.status,
      due_date: t.due_date,
      project_name: t.project?.name ?? '—',
      client_name: t.project?.client?.name ?? '—',
      horas_estimadas: t.direct_hours ?? 0,
      horas_realizadas: Math.round((realizadasPorUserTask[uid]?.[t.id] ?? 0) * 10) / 10,
      es_colaborador: false,
    })
  })

  const colabsFiltrados = (tareasColab ?? []).filter((c: any) => {
    const dd = c.task?.due_date
    return dd && dd >= primerDia && dd <= ultimoDia && !['presentado','finalizado'].includes(c.task?.status)
  })

  colabsFiltrados.forEach((c: any) => {
    const uid = c.user_id
    const t = c.task
    if (!uid || !t?.id) return
    // evitar duplicar si ya es responsable directo
    if (tareasPorUser[uid]?.some((x: any) => x.id === t.id)) return
    if (!tareasPorUser[uid]) tareasPorUser[uid] = []
    tareasPorUser[uid].push({
      id: t.id,
      title: t.title,
      status: t.status,
      due_date: t.due_date,
      project_name: t.project?.name ?? '—',
      client_name: t.project?.client?.name ?? '—',
      horas_estimadas: c.assigned_hours ?? 0,
      horas_realizadas: Math.round((realizadasPorUserTask[uid]?.[t.id] ?? 0) * 10) / 10,
      es_colaborador: true,
    })
  })

  const programadasPorUser: Record<string, number> = {}
  Object.entries(tareasPorUser).forEach(([uid, tareas]) => {
    programadasPorUser[uid] = Math.round(tareas.reduce((s, t) => s + (t.horas_estimadas ?? 0), 0) * 10) / 10
  })

  const filas = (usuarios ?? []).map((u: any) => {
    const disponibilidad = Math.round((disponibilidadPorUser[u.id] ?? 0) * 10) / 10
    const programadas    = Math.round((programadasPorUser[u.id] ?? 0) * 10) / 10
    const realizadas     = Math.round((realizadasPorUser[u.id] ?? 0) * 10) / 10
    const tareas = (tareasPorUser[u.id] ?? []).sort((a: any, b: any) =>
      (a.due_date ?? '').localeCompare(b.due_date ?? ''))
    const nombre = u.id === user.id && nickname ? nickname : u.full_name
    return { id: u.id, nombre, disponibilidad, programadas, realizadas,
      disponibles: Math.round((disponibilidad - programadas) * 10) / 10, tareas }
  })

  const { data: segmentos } = await supabase
    .from('project_hour_segments').select('desde').order('desde', { ascending: false })
  const mesesDisponibles = [...new Set(
    (segmentos ?? []).map((s: any) => s.desde?.slice(0, 7)).filter(Boolean)
  )].sort().reverse() as string[]
  if (!mesesDisponibles.includes(mesActual)) mesesDisponibles.unshift(mesActual)

  return <OcupacionEquipoClient filas={filas} mes={mes} mesActual={mesActual} mesesDisponibles={mesesDisponibles}/>
}
