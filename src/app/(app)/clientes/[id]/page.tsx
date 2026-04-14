import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail, Phone, FileText, FolderKanban } from 'lucide-react'

export default async function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: cliente } = await supabase.from('clients').select('*').eq('id', id).single()
  if (!cliente) notFound()

  const { data: proyectos } = await supabase
    .from('projects')
    .select('id, name, service_type, sold_hours, is_active')
    .eq('client_id', id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/clientes" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15} /> Clientes
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-base font-semibold text-gray-600">
            {cliente.name[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{cliente.name}</h1>
            {cliente.company && <p className="text-sm text-gray-400">{cliente.company}</p>}
          </div>
        </div>
        <Link href={`/clientes/${id}/editar`} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
          Editar
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {cliente.email && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
            <Mail size={15} className="text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Email</p>
              <p className="text-sm text-gray-900">{cliente.email}</p>
            </div>
          </div>
        )}
        {cliente.phone && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
            <Phone size={15} className="text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Teléfono</p>
              <p className="text-sm text-gray-900">{cliente.phone}</p>
            </div>
          </div>
        )}
        {cliente.notes && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-start gap-3 sm:col-span-2">
            <FileText size={15} className="text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-400">Notas</p>
              <p className="text-sm text-gray-900">{cliente.notes}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><FolderKanban size={15}/>Proyectos</h2>
        <Link href={`/proyectos/nuevo?cliente=${id}`} className="text-xs text-black underline">+ Nuevo proyecto</Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {!proyectos?.length ? (
          <p className="text-sm text-gray-400 text-center py-8">Sin proyectos aún</p>
        ) : proyectos.map(p => (
          <Link key={p.id} href={`/proyectos/${p.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-900">{p.name}</p>
              <p className="text-xs text-gray-400 capitalize">{p.service_type?.replace(/_/g,' ')}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">{p.sold_hours}hs vendidas</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                {p.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
