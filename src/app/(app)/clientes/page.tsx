import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Building2, Mail, Phone } from 'lucide-react'

export default async function ClientesPage() {
  const supabase = await createClient()
  const { data: clientes } = await supabase
    .from('clients')
    .select('id, name, company, email, phone, is_active')
    .order('name')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-400 mt-0.5">{clientes?.length ?? 0} clientes</p>
        </div>
        <Link href="/clientes/nuevo" className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
          <Plus size={15} /> Nuevo cliente
        </Link>
      </div>

      {!clientes?.length ? (
        <div className="text-center py-20 text-gray-400">
          <Building2 size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay clientes aún</p>
          <Link href="/clientes/nuevo" className="text-sm text-black underline mt-2 inline-block">Crear el primero</Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {clientes.map(c => (
            <Link key={c.id} href={`/clientes/${c.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                  {c.name[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  {c.company && <p className="text-xs text-gray-400">{c.company}</p>}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                {c.email && <span className="hidden sm:flex items-center gap-1"><Mail size={11}/>{c.email}</span>}
                {c.phone && <span className="hidden sm:flex items-center gap-1"><Phone size={11}/>{c.phone}</span>}
                <span className={`px-2 py-0.5 rounded-full text-xs ${c.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  {c.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
