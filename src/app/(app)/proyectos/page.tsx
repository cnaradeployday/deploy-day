import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, FolderKanban, Pencil } from 'lucide-react'
import DeleteButton from '@/components/DeleteButton'

const serviceLabels: Record<string, string> = {
  marketing_digital: 'Marketing digital',
  desarrollo_producto: 'Desarrollo de producto',
  desarrollo_software: 'Desarrollo de software',
  otro: 'Otro',
}

export default async function ProyectosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('users').select('role, custom_role_id').eq('id', user?.id ?? '').single()

  const isAdmin = ['admin', 'gerente_operaciones'].includes(profile?.role ?? '')
  let canDelete = isAdmin
  if (!canDelete && profile?.custom_role_id) {
    const { data: perm } = await supabase
      .from('role_permissions').select('can_delete')
      .eq('role_id', profile.custom_role_id).eq('module', 'proyectos').single()
    canDelete = perm?.can_delete ?? false
  }

  const { data: proyectos } = await supabase
    .from('projects')
    .select('id, name, service_type, sold_hours, is_active, client:clients(name)')
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Proyectos</h1>
          <p className="text-sm text-gray-400 mt-0.5">{proyectos?.length ?? 0} proyectos</p>
        </div>
        <Link href="/proyectos/nuevo" className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
          <Plus size={15}/> Nuevo proyecto
        </Link>
      </div>

      {!proyectos?.length ? (
        <div className="text-center py-20 text-gray-400">
          <FolderKanban size={32} className="mx-auto mb-3 opacity-30"/>
          <p className="text-sm">No hay proyectos aún</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {proyectos.map(p => (
            <div key={p.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
              <Link href={`/proyectos/${p.id}`} className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{(p.client as any)?.name} · {serviceLabels[p.service_type] ?? p.service_type}</p>
              </Link>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <span className="text-xs text-gray-400">{p.sold_hours}hs</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  {p.is_active ? 'Activo' : 'Inactivo'}
                </span>
                {isAdmin && (
                  <Link href={`/proyectos/${p.id}/editar`}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
                    <Pencil size={14}/>
                  </Link>
                )}
                {canDelete && (
                  <DeleteButton
                    table="projects"
                    id={p.id}
                    redirectTo="/proyectos"
                    confirmMessage={`¿Eliminar el proyecto "${p.name}"? Esta acción no se puede deshacer.`}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
