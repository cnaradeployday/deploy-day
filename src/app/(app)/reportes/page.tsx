import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BarChart3, TrendingUp, Users, Clock } from 'lucide-react'

export default async function ReportesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (!['admin', 'gerente_operaciones'].includes(profile?.role ?? '')) redirect('/dashboard')

  const isAdmin = profile?.role === 'admin'

  const reportes = [
    { href: '/reportes/tareas', label: 'Estado de tareas', desc: 'Distribución por estado, prioridad y proyecto', icon: BarChart3, color: 'bg-blue-50' },
    { href: '/reportes/ocupacion', label: 'Ocupación del equipo', desc: 'Horas cargadas por colaborador y período', icon: Users, color: 'bg-amber-50' },
    { href: '/reportes/horas', label: 'Horas por proyecto', desc: 'Vendidas vs estimadas vs cargadas', icon: Clock, color: 'bg-green-50' },
    ...(isAdmin ? [{ href: '/reportes/rentabilidad', label: 'Rentabilidad', desc: 'Margen por cliente y proyecto', icon: TrendingUp, color: 'bg-purple-50' }] : []),
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-400 mt-0.5">Dashboards interactivos y exportables</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {reportes.map(({ href, label, desc, icon: Icon, color }) => (
          <Link key={href} href={href} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all">
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
              <Icon size={18} className="text-gray-700" />
            </div>
            <p className="text-sm font-semibold text-gray-900">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
