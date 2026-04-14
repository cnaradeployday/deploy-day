import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import OcupacionChart from './OcupacionChart'
import ReportFilters from '@/components/reportes/ReportFilters'

export default async function ReporteOcupacionPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (!['admin', 'gerente_operaciones'].includes(profile?.role ?? '')) redirect('/dashboard')

  const sp = await searchParams
  const { from, to, cliente, proyecto, colaborador } = sp

  const { data: clientes } = await supabase.from('clients').select('id, name').order('name')
  const { data: proyectosAll } = await supabase.from('projects').select('id, name, client_id').order('name')
  const { data: usuarios } = await supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name')

  let query = supabase.from('time_entries').select(`
    hours_logged, entry_date,
    user:users(id, full_name),
    task:tasks(project_id, project:projects(client_id))
  `).order('entry_date', { ascending: true })

  if (from) query = query.gte('entry_date', from)
  if (to) query = query.lte('entry_date', to)
  if (colaborador) query = query.eq('user_id', colaborador)

  const { data: entries } = await query

  const filtered = entries?.filter(e => {
    if (proyecto && (e.task as any)?.project_id !== proyecto) return false
    if (cliente && (e.task as any)?.project?.client_id !== cliente) return false
    return true
  }) ?? []

  const userMap: Record<string, { name: string; total: number; byMonth: Record<string, number> }> = {}
  filtered.forEach(e => {
    const uid = (e.user as any)?.id
    const name = (e.user as any)?.full_name ?? 'Desconocido'
    const month = e.entry_date.slice(0, 7)
    if (!userMap[uid]) userMap[uid] = { name, total: 0, byMonth: {} }
    userMap[uid].total += e.hours_logged
    userMap[uid].byMonth[month] = (userMap[uid].byMonth[month] ?? 0) + e.hours_logged
  })

  const months = [...new Set(filtered.map(e => e.entry_date.slice(0, 7)))].sort().slice(-6)
  const chartData = months.map(m => {
    const row: Record<string, any> = { month: m.slice(5) + '/' + m.slice(0, 4) }
    Object.values(userMap).forEach(u => { row[u.name] = Math.round((u.byMonth[m] ?? 0) * 10) / 10 })
    return row
  })

  const usersData = Object.values(userMap).sort((a, b) => b.total - a.total)
  const COLORS = ['#1B9BF0','#0F7ACC','#93c5fd','#bbf7d0','#fde68a','#fca5a5','#e9d5ff','#fed7aa']

  const proyectosFiltrados = cliente ? proyectosAll?.filter(p => p.client_id === cliente) : proyectosAll

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/reportes" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Reportes
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Ocupación del equipo</h1>
      <ReportFilters
        clientes={clientes?.map(c => ({ value: c.id, label: c.name })) ?? []}
        proyectos={proyectosFiltrados?.map(p => ({ value: p.id, label: p.name })) ?? []}
        colaboradores={usuarios?.map(u => ({ value: u.id, label: u.full_name })) ?? []}
      />
      <OcupacionChart chartData={chartData} users={usersData} colors={COLORS} />
    </div>
  )
}
