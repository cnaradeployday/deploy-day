import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generarSlugUnico } from '@/lib/presentaciones/slug'

export const runtime = 'nodejs'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const { data: original } = await supabase.from('presentaciones').select('*, clients(name)').eq('id', id).single()
  if (!original) return NextResponse.json({ error: 'No se encontro la presentacion.' }, { status: 404 })

  const { data: version } = await supabase.from('presentaciones_versiones')
    .select('*').eq('presentacion_id', id).eq('numero_version', original.version_actual).maybeSingle()

  const nombreCopia = `${original.nombre} (copia)`
  const slug = await generarSlugUnico(supabase, (original.clients as any)?.name ?? '', nombreCopia)

  const { data: nueva, error } = await supabase.from('presentaciones').insert({
    client_id: original.client_id, nombre: nombreCopia, descripcion: original.descripcion,
    visibilidad: original.visibilidad, slug, estado: version ? 'procesando' : 'borrador', created_by: user.id,
  }).select('id').single()
  if (error || !nueva) return NextResponse.json({ error: 'No se pudo duplicar.' }, { status: 500 })

  if (version) {
    const { data: archivos } = await supabase.storage.from('presentaciones').list(version.storage_prefix, { limit: 1000 })
    const nuevoPrefix = `${nueva.id}/v1`
    for (const archivo of archivos ?? []) {
      const { data: descargado } = await supabase.storage.from('presentaciones').download(`${version.storage_prefix}/${archivo.name}`)
      if (descargado) {
        await supabase.storage.from('presentaciones').upload(`${nuevoPrefix}/${archivo.name}`, descargado, { upsert: true })
      }
    }
    await supabase.from('presentaciones_versiones').insert({
      presentacion_id: nueva.id, numero_version: 1, storage_prefix: nuevoPrefix,
      archivo_principal: version.archivo_principal, created_by: user.id,
    })
    await supabase.from('presentaciones').update({ estado: 'publicada', version_actual: 1 }).eq('id', nueva.id)
  }

  return NextResponse.json({ id: nueva.id })
}
