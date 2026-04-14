import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import HourRequestActions from './HourRequestActions'
import { AlertCircle } from 'lucide-react'

const statusColors: Record<string, string> = {
  pendiente: 'bg-amber-50 text-amber-600',
  aprobado: 'bg-green-50 text-green-600',
  rechazado: 'bg-red-50 text-red-600',
}

export default async function SolicitudesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()

  if (!['admin', 'gerente_operaciones'].includes(profile?.role ?? '')) redirect('/dashboard')

  const { data: solicitudes } = await supabase
    .from('hour_requests')
    .select(`id, extra_hours, reason, status, created_at, review_notes,
      task:tasks(id, title, project:projects(name, client:clients(name))),
      requester:users!hour_requests_requested_by_fkey(full_name)`)
    .order('created_at', { ascending: false })

  const pendientes = solicitudes?.filter(s => s.status === 'pendiente') ?? []
  const resueltas = solicitudes?.filter(s => s.status !== 'pendiente') ?? []

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Solicitudes de horas</h1>
        <p className="text-sm text-gray-400 mt-0.5">{pendientes.length} pendientes</p>
      </div>

      {pendientes.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-500"/> Pendientes de revisión
          </h2>
          <div className="space-y-3">
            {pendientes.map(s => (
              <div key={s.id} className="bg-white rounded-xl border border-amber-200 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{(s.task as any)?.title}</p>
                    <p className="text-xs text-gray-400">{(s.task as any)?.project?.client?.name} · {(s.task as any)?.project?.name}</p>
                  </div>
                  <span className="text-sm font-semibold text-amber-600 shrink-0 ml-4">+{s.extra_hours}h</span>
                </div>
                <p className="text-xs text-gray-500 mb-3 bg-gray-50 rounded-lg px-3 py-2">{s.reason}</p>
                <p className="text-xs text-gray-400 mb-3">Solicitado por: {(s.requester as any)?.full_name}</p>
                {profile?.role === 'admin' && <HourRequestActions requestId={s.id} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {resueltas.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Historial</h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {resueltas.map(s => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm text-gray-900">{(s.task as any)?.title}</p>
                  <p className="text-xs text-gray-400">{(s.requester as any)?.full_name} · {new Date(s.created_at).toLocaleDateString('es-AR')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">+{s.extra_hours}h</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[s.status]}`}>{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!solicitudes?.length && (
        <div className="text-center py-20 text-gray-400">
          <AlertCircle size={32} className="mx-auto mb-3 opacity-30"/>
          <p className="text-sm">No hay solicitudes de horas</p>
        </div>
      )}
    </div>
  )
}
