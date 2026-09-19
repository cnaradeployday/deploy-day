import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hashPassword } from '@/lib/presentaciones/password'

export const runtime = 'nodejs'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const body = await request.json()
  const update: Record<string, unknown> = {}
  if (typeof body.nombre === 'string') update.nombre = body.nombre.trim()
  if (typeof body.descripcion === 'string' || body.descripcion === null) update.descripcion = body.descripcion
  if (body.visibilidad === 'publica' || body.visibilidad === 'privada') update.visibilidad = body.visibilidad
  if (body.estado === 'despublicada' || body.estado === 'publicada') update.estado = body.estado
  if (body.linkExpiraAt === null || typeof body.linkExpiraAt === 'string') update.link_expira_at = body.linkExpiraAt

  if (body.password === null) update.password_hash = null
  else if (typeof body.password === 'string' && body.password.length > 0) update.password_hash = hashPassword(body.password)

  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from('presentaciones').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (Array.isArray(body.tags)) {
    const nombres: string[] = body.tags.map((t: string) => t.trim()).filter(Boolean)
    const tagIds: string[] = []
    for (const nombre of nombres) {
      const { data: existente } = await supabase.from('presentaciones_tags').select('id').eq('nombre', nombre).maybeSingle()
      if (existente) tagIds.push(existente.id)
      else {
        const { data: creado, error } = await supabase.from('presentaciones_tags').insert({ nombre }).select('id').single()
        if (!error && creado) tagIds.push(creado.id)
      }
    }
    await supabase.from('presentaciones_tags_rel').delete().eq('presentacion_id', id)
    if (tagIds.length) {
      await supabase.from('presentaciones_tags_rel').insert(tagIds.map(tag_id => ({ presentacion_id: id, tag_id })))
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const { data: archivos } = await supabase.storage.from('presentaciones').list(id, { limit: 1000 })
  // list() no es recursivo: recorremos las carpetas de version (v1, v2, ...) y borramos cada una.
  const paths: string[] = []
  for (const entry of archivos ?? []) {
    if (entry.id === null) {
      const { data: dentro } = await supabase.storage.from('presentaciones').list(`${id}/${entry.name}`, { limit: 1000 })
      dentro?.forEach(f => paths.push(`${id}/${entry.name}/${f.name}`))
    } else {
      paths.push(`${id}/${entry.name}`)
    }
  }
  if (paths.length) await supabase.storage.from('presentaciones').remove(paths)

  const { error } = await supabase.from('presentaciones').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
