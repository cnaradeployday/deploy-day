import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { hasModuleAccess } from '@/lib/permissions'
import ClienteDetalleClient from './ClienteDetalleClient'

export default async function PresentacionesClientePage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await hasModuleAccess(supabase, user.id, 'presentaciones'))) redirect('/dashboard')

  const [{ data: cliente }, { data: presentaciones }, { data: favoritosPres }, { data: favoritosClientes }, puedeEscribir] = await Promise.all([
    supabase.from('clients').select('id, name, company').eq('id', clientId).single(),
    supabase.from('presentaciones')
      .select('id, client_id, nombre, slug, descripcion, visibilidad, estado, portada_path, password_hash, link_expira_at, created_by, created_at, updated_at')
      .eq('client_id', clientId)
      .order('updated_at', { ascending: false }),
    supabase.from('presentaciones_favoritos').select('presentacion_id').eq('user_id', user.id),
    supabase.from('presentaciones_clientes_favoritos').select('client_id').eq('user_id', user.id),
    hasModuleAccess(supabase, user.id, 'presentaciones', 'write'),
  ])

  if (!cliente) notFound()

  const portadaPaths = (presentaciones ?? []).filter(p => p.portada_path).map(p => p.portada_path as string)
  let portadaUrls: Record<string, string> = {}
  if (portadaPaths.length) {
    const { data: signed } = await supabase.storage.from('presentaciones').createSignedUrls(portadaPaths, 3600)
    signed?.forEach((s, i) => { if (s.signedUrl) portadaUrls[portadaPaths[i]] = s.signedUrl })
  }

  const favPresSet = new Set((favoritosPres ?? []).map(f => f.presentacion_id))

  const presentacionesEnriquecidas = (presentaciones ?? []).map(p => ({
    id: p.id, clientId: p.client_id, clienteNombre: cliente.name, nombre: p.nombre, slug: p.slug,
    descripcion: p.descripcion, visibilidad: p.visibilidad as 'publica' | 'privada',
    estado: p.estado as 'borrador' | 'procesando' | 'publicada' | 'error' | 'despublicada',
    portadaUrl: p.portada_path ? (portadaUrls[p.portada_path] ?? null) : null,
    tieneClave: !!p.password_hash, linkExpiraAt: p.link_expira_at, esMia: p.created_by === user.id,
    esFavorita: favPresSet.has(p.id), createdAt: p.created_at, updatedAt: p.updated_at,
  }))

  return (
    <ClienteDetalleClient
      cliente={{ id: cliente.id, nombre: cliente.name, empresa: cliente.company, esFavorito: (favoritosClientes ?? []).some(f => f.client_id === cliente.id) }}
      presentaciones={presentacionesEnriquecidas}
      userId={user.id}
      puedeEscribir={!!puedeEscribir}
    />
  )
}
