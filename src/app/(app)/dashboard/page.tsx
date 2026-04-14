import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('full_name, role').eq('id', user.id).single()
  const { count: totalTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true })
  const { count: inProgress } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'en_proceso')
  const { count: pendingRequests } = await supabase.from('hour_requests').select('*', { count: 'exact', head: true }).eq('status', 'pendiente')

  const cards = [
    { label: 'Tareas totales', value: totalTasks ?? 0, color: 'bg-blue-50 text-blue-700' },
    { label: 'En proceso', value: inProgress ?? 0, color: 'bg-amber-50 text-amber-700' },
    { label: 'Solicitudes pendientes', value: pendingRequests ?? 0, color: 'bg-red-50 text-red-700' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Bienvenido, {profile?.full_name}</h1>
        <p className="text-sm text-gray-500 capitalize mt-0.5">{profile?.role?.replace('_', ' ')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color.split(' ')[1]}`}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
