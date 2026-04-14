import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckSquare, Clock, AlertCircle, FolderKanban, ArrowRight } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('full_name, role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'
  const isGerente = profile?.role === 'gerente_operaciones'

  const { count: totalTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true })
  const { count: inProgress } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'en_proceso')
  const { count: pending } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'estimado')
  const { count: pendingRequests } = await supabase.from('hour_requests').select('*', { count: 'exact', head: true }).eq('status', 'pendiente')

  const { data: myTasks } = await supabase
    .from('tasks')
    .select('id, title, status, due_date, project:projects(name, client:clients(name))')
    .eq('direct_responsible_id', user.id)
    .in('status', ['estimado', 'en_proceso'])
    .order('due_date', { ascending: true })
    .limit(5)

  const statusColors: Record<string, string> = {
    estimado: 'bg-blue-50 text-blue-600',
    en_proceso: 'bg-amber-50 text-amber-600',
  }
  const statusLabels: Record<string, string> = {
    estimado: 'Estimado', en_proceso: 'En proceso',
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Bienvenido, {profile?.full_name?.split(' ')[0]}</h1>
        <p className="text-sm text-gray-400 mt-0.5 capitalize">{profile?.role?.replace(/_/g, ' ')}</p>
      </div>

      {(isAdmin || isGerente) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total tareas', value: totalTasks ?? 0, icon: CheckSquare, href: '/tareas' },
            { label: 'En proceso', value: inProgress ?? 0, icon: Clock, href: '/tareas' },
            { label: 'Pendientes', value: pending ?? 0, icon: FolderKanban, href: '/tareas' },
            { label: 'Solicitudes', value: pendingRequests ?? 0, icon: AlertCircle, href: '/solicitudes' },
          ].map(({ label, value, icon: Icon, href }) => (
            <Link key={label} href={href} className="bg-white rounded-2xl border border-gray-100 px-4 py-4 hover:border-gray-200 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-400">{label}</p>
                <Icon size={14} className="text-gray-300" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{value}</p>
            </Link>
          ))}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Mis tareas activas</h2>
          <Link href="/mis-tareas" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">Ver todas <ArrowRight size={12}/></Link>
        </div>
        {!myTasks?.length ? (
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-8 text-center">
            <p className="text-sm text-gray-400">No tenés tareas activas</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {myTasks.map(t => (
              <Link key={t.id} href={`/tareas/${t.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{t.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{(t.project as any)?.client?.name} · {(t.project as any)?.name}</p>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  {t.due_date && <span className="text-xs text-gray-400">{new Date(t.due_date).toLocaleDateString('es-AR', { day:'numeric', month:'short' })}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[t.status]}`}>{statusLabels[t.status]}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
