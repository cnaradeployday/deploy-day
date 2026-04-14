import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import TasksChart from './TasksChart'

export default async function ReporteTareasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (!['admin', 'gerente_operaciones'].includes(profile?.role ?? '')) redirect('/dashboard')

  const { data: tareas } = await supabase
    .from('tasks')
    .select('status, priority, project:projects(name, client:clients(name))')

  const byStatus = ['creado','estimado','en_proceso','terminado','presentado'].map(s => ({
    name: { creado:'Creado', estimado:'Estimado', en_proceso:'En proceso', terminado:'Terminado', presentado:'Presentado' }[s],
    value: tareas?.filter(t => t.status === s).length ?? 0
  }))

  const byPriority = ['baja','media','alta','critica'].map(p => ({
    name: p.charAt(0).toUpperCase() + p.slice(1),
    value: tareas?.filter(t => t.priority === p).length ?? 0
  }))

  const clientMap: Record<string, number> = {}
  tareas?.forEach(t => {
    const name = (t.project as any)?.client?.name ?? 'Sin cliente'
    clientMap[name] = (clientMap[name] ?? 0) + 1
  })
  const byClient = Object.entries(clientMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 8)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/reportes" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Reportes
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Estado de tareas</h1>
      <TasksChart byStatus={byStatus} byPriority={byPriority} byClient={byClient} total={tareas?.length ?? 0} />
    </div>
  )
}
