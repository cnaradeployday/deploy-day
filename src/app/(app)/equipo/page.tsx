import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, UserCircle } from 'lucide-react'

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  gerente_operaciones: 'Gerente de operaciones',
  colaborador: 'Colaborador',
}
const roleColors: Record<string, string> = {
  admin: 'bg-purple-50 text-purple-600',
  gerente_operaciones: 'bg-blue-50 text-blue-600',
  colaborador: 'bg-gray-100 text-gray-500',
}

export default async function EquipoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()

  if (!['admin', 'gerente_operaciones'].includes(profile?.role ?? '')) redirect('/dashboard')

  const { data: equipo } = await supabase
    .from('users')
    .select('id, full_name, email, role, is_active, created_at')
    .order('full_name')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Equipo</h1>
          <p className="text-sm text-gray-400 mt-0.5">{equipo?.length ?? 0} miembros</p>
        </div>
        {profile?.role === 'admin' && (
          <Link href="/equipo/nuevo" className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">
            <Plus size={15}/> Agregar miembro
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {equipo?.map(m => (
          <div key={m.id} className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                {m.full_name[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{m.full_name}</p>
                <p className="text-xs text-gray-400">{m.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[m.role]}`}>{roleLabels[m.role]}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${m.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                {m.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
