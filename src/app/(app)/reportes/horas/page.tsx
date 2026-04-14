import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import HorasChart from './HorasChart'
import ReportFilters from '@/components/reportes/ReportFilters'

export default async function ReporteHorasPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (!['admin', 'gerente_operaciones'].includes(profile?.role ?? '')) redirect('/dashboard')

  const sp = await searchParams
  const { from, to, cliente, proyecto, colaborador } = sp

  const { data: clientes } = await supabase.from('clients').select('id, name').order('name')
  const { data: proyectosAll } = await supabase.from('projects').select('id, name, client_id, sold_hours, price_per_hour, client:clients(name)').order('name')
  const { data: usuarios } = await supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name')

  const proyectosFiltrados = cliente
    ? proyectosAll?.filter(p => p.client_id === cliente)
    : proyectosAll

  const proyectosTarget = proyecto
    ? proyectosFiltrados?.filter(p => p.id === proyecto)
    : proyectosFiltrados

  const { data: tareas } = await supabase.from('tasks').select('project_id, estimated_hours')
  
  let entriesQuery = supabase.from('time_entries').select('hours_logged, entry_date, task:tasks(project_id)')
  if (from) entriesQuery = entriesQuery.gte('entry_date', from)
  if (to) entriesQuery = entriesQuery.lte('entry_date', to)
  if (colaborador) entriesQuery = entriesQuery.eq('user_id', colaborador)
  const { data: entries } = await entriesQuery

  const data = proyectosTarget?.map(p => {
    const estimadas = tareas?.filter(t => t.project_id === p.id).reduce((s, t) => s + (t.estimated_hours ?? 0), 0) ?? 0
    const cargadas = entries?.filter(e => (e.task as any)?.project_id === p.id).reduce((s, e) => s + e.hours_logged, 0) ?? 0
    return {
      name: p.name,
      cliente: (p.client as any)?.name,
      vendidas: p.sold_hours,
      estimadas: Math.round(estimadas * 10) / 10,
      cargadas: Math.round(cargadas * 10) / 10,
    }
  }) ?? []

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/reportes" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Reportes
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Horas por proyecto</h1>
      <ReportFilters
        clientes={clientes?.map(c => ({ value: c.id, label: c.name })) ?? []}
        proyectos={proyectosFiltrados?.map(p => ({ value: p.id, label: p.name })) ?? []}
        colaboradores={usuarios?.map(u => ({ value: u.id, label: u.full_name })) ?? []}
      />
      <HorasChart data={data} />
    </div>
  )
}
