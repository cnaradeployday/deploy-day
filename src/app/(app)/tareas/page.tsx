import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import TareasTable from './TareasTable'
import { applyNickname } from '@/lib/utils/displayName'
import { currentMonthAR, monthBounds } from '@/lib/utils/date'

export default async function TareasPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileNick } = await supabase.from('users').select('nickname, role, custom_role_id').eq('id', user.id).single()
  const nickname = profileNick?.nickname ?? null

  const isAdmin = ['admin', 'gerente_operaciones'].includes(profileNick?.role ?? '')
  let canAccess = isAdmin
  if (!canAccess && profileNick?.custom_role_id) {
    const { data: perm } = await supabase
      .from('role_permissions').select('can_read')
      .eq('role_id', profileNick.custom_role_id).eq('module', 'tareas').single()
    canAccess = perm?.can_read ?? false
  }
  if (!canAccess) redirect('/dashboard')
  const sp = await searchParams
  const { status, priority, cliente, proyecto, responsable, mes } = sp

  const { data: clientes } = await supabase.from('clients').select('id, name').order('name')
  const { data: proyectosAll } = await supabase.from('projects').select('id, name, client_id').order('name')
  const { data: usuarios } = await supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name')

  let query = supabase
    .from('tasks')
    .select(`id, title, status, priority, due_date, estimated_hours, requires_review,
      project:projects(id, name, client:clients(id, name)),
      direct_responsible:users!tasks_direct_responsible_id_fkey(id, full_name),
      task_collaborators(id, assigned_hours, user:users(id, full_name))`)
    .order('due_date', { ascending: true })

  if (status) query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)
  if (responsable) query = query.eq('direct_responsible_id', responsable)
  if (proyecto) query = query.eq('project_id', proyecto)
  else if (cliente) {
    const ids = proyectosAll?.filter(p => p.client_id === cliente).map(p => p.id) ?? []
    if (ids.length) query = query.in('project_id', ids)
  }
  if (mes) {
    const { primerDia: desde, ultimoDia: hasta } = monthBounds(mes)
    query = query.gte('due_date', desde).lte('due_date', hasta)
  }

  const { data: tareas } = await query

  // Horas vendidas del mes (segmentos que intersectan el mes)
  const { primerDia: hDesde, ultimoDia: hHasta } = monthBounds(mes ?? currentMonthAR())
  const { data: segmentosMes } = await supabase
    .from('project_hour_segments')
    .select('horas')
    .lte('desde', hHasta)
    .gte('hasta', hDesde)
  const totalVendidas = (segmentosMes ?? []).reduce((s, seg) => s + seg.horas, 0)

  // Horas de todo el equipo, no solo las del usuario actual — usar admin client para saltar RLS.
  // Se suman agrupadas por tarea del lado de Postgres (RPC) en vez de traer cada fila cruda,
  // porque `time_entries` ya supera las 1000 filas por defecto que PostgREST devuelve por consulta.
  const taskIds = tareas?.map(t => t.id) ?? []
  const adminSupabase = createAdminClient()
  const { data: horasPorTareaRows } = taskIds.length
    ? await adminSupabase.rpc('sum_hours_by_task', { p_task_ids: taskIds })
    : { data: [] }

  const horasPorTarea: Record<string, number> = {}
  horasPorTareaRows?.forEach((r: { task_id: string; total_hours: number }) => {
    horasPorTarea[r.task_id] = r.total_hours
  })

  const tareasConHoras = applyNickname(
    tareas?.map(t => ({ ...t, hours_logged: Math.round((horasPorTarea[t.id] ?? 0) * 10) / 10 })) ?? [],
    user?.id ?? '', nickname
  )

  const proyectosFiltrados = cliente
    ? proyectosAll?.filter(p => p.client_id === cliente)
    : proyectosAll

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Tareas</h1>
          <p className="text-sm text-gray-400 mt-0.5">{tareasConHoras.length} tareas</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/tareas/nueva"
            className="flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
            <Plus size={15}/> Nueva tarea
          </Link>
        </div>
      </div>
      {/* @ts-ignore */}
      <TareasTable
        totalVendidas={totalVendidas}
        tareas={tareasConHoras}
        clientes={clientes?.map(c => ({ value: c.id, label: c.name })) ?? []}
        proyectos={proyectosFiltrados?.map(p => ({ value: p.id, label: p.name })) ?? []}
        usuarios={applyNickname(usuarios ?? [], user?.id ?? '', nickname).map((u: any) => ({ value: u.id, label: u.full_name }))}
        filters={{ status, priority, cliente, proyecto, responsable, mes }}
      />
    </div>
  )
}
