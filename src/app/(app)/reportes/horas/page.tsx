import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import HorasChart from './HorasChart'

export default async function ReporteHorasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (!['admin', 'gerente_operaciones'].includes(profile?.role ?? '')) redirect('/dashboard')

  const { data: proyectos } = await supabase
    .from('projects')
    .select('id, name, sold_hours, client:clients(name)')
    .eq('is_active', true)

  const { data: tareas } = await supabase.from('tasks').select('project_id, estimated_hours')
  const { data: entries } = await supabase.from('time_entries').select('hours_logged, task:tasks(project_id)')

  const data = proyectos?.map(p => {
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
      <HorasChart data={data} />
    </div>
  )
}
