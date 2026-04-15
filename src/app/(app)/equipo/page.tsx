import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Pencil } from 'lucide-react'

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
    .select('id, full_name, email, role, is_active, hourly_cost, currency')
    .order('full_name')

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Equipo</h1>
          <p className="text-sm text-gray-400 mt-0.5">{equipo?.length ?? 0} miembros</p>
        </div>
        {isAdmin && (
          <Link href="/equipo/nuevo"
            className="flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
            <Plus size={15}/> Agregar miembro
          </Link>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {equipo?.map(m => (
          <div key={m.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#E8F4FE] flex items-center justify-center text-sm font-semibold text-[#1B9BF0]">
                {m.full_name[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{m.full_name}</p>
                <p className="text-xs text-gray-400">{m.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {m.hourly_cost && (
                <span className="text-xs text-gray-400 hidden sm:block">
                  {m.currency === 'USD' ? 'USD ' : '$'}{m.hourly_cost}/h
                </span>
              )}
              <span className={'text-xs px-2.5 py-1 rounded-full ' + roleColors[m.role]}>
                {roleLabels[m.role]}
              </span>
              <span className={'text-xs px-2.5 py-1 rounded-full ' + (m.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400')}>
                {m.is_active ? 'Activo' : 'Inactivo'}
              </span>
              {isAdmin && (
                <Link href={'/equipo/' + m.id}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#1B9BF0] border border-gray-200 hover:border-[#1B9BF0] px-2.5 py-1 rounded-lg transition-all">
                  <Pencil size={11}/> Editar
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
