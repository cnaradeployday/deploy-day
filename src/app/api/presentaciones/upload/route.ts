import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generarSlugUnico } from '@/lib/presentaciones/slug'
import { extraerZip, encontrarArchivoPrincipal, contentTypeFor, type ArchivoExtraido } from '@/lib/presentaciones/zip'
import { capturarPortada } from '@/lib/presentaciones/screenshot'

export const runtime = 'nodejs'
export const maxDuration = 90

const MAX_ZIP_BYTES = 100 * 1024 * 1024 // 100MB

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'No se pudo leer la carga. Intenta de nuevo.' }, { status: 400 })
  }

  const presentacionId = (formData.get('presentacion_id') as string) || null
  const clientId = formData.get('client_id') as string | null
  const nombre = (formData.get('nombre') as string | null)?.trim()
  const descripcion = (formData.get('descripcion') as string | null)?.trim() || null
  const visibilidad = (formData.get('visibilidad') as string | null) === 'privada' ? 'privada' : 'publica'
  const mode = formData.get('mode') as string | null

  if (!presentacionId && (!clientId || !nombre)) {
    return NextResponse.json({ error: 'Cliente y nombre son obligatorios.' }, { status: 400 })
  }

  // 1. Extraer/juntar archivos ------------------------------------------------
  let archivos: ArchivoExtraido[]
  try {
    if (mode === 'zip') {
      const zipFile = formData.get('zip') as File | null
      if (!zipFile) return NextResponse.json({ error: 'Falta el archivo ZIP.' }, { status: 400 })
      if (zipFile.size > MAX_ZIP_BYTES) return NextResponse.json({ error: 'El archivo es demasiado pesado (maximo 100MB).' }, { status: 400 })
      const buffer = Buffer.from(await zipFile.arrayBuffer())
      archivos = await extraerZip(buffer)
      if (archivos.length === 0) return NextResponse.json({ error: 'El ZIP esta vacio o no se pudo leer. Verifica que el archivo no este corrupto.' }, { status: 400 })
    } else {
      const files = formData.getAll('file') as File[]
      const pathsRaw = formData.get('paths') as string | null
      if (!files.length || !pathsRaw) return NextResponse.json({ error: 'No se recibieron archivos.' }, { status: 400 })
      const paths: string[] = JSON.parse(pathsRaw)
      if (paths.length !== files.length) return NextResponse.json({ error: 'Error interno al procesar los archivos. Intenta de nuevo.' }, { status: 400 })
      const totalBytes = files.reduce((acc, f) => acc + f.size, 0)
      if (totalBytes > MAX_ZIP_BYTES) return NextResponse.json({ error: 'Los archivos son demasiado pesados en conjunto (maximo 100MB).' }, { status: 400 })
      archivos = await Promise.all(files.map(async (f, i) => ({
        path: paths[i],
        buffer: Buffer.from(await f.arrayBuffer()),
        contentType: contentTypeFor(paths[i]),
      })))
    }
  } catch (err) {
    console.error('Error leyendo archivos de presentacion:', err)
    return NextResponse.json({ error: 'El ZIP es invalido o esta corrupto.' }, { status: 400 })
  }

  const principal = encontrarArchivoPrincipal(archivos)
  if (!principal) {
    return NextResponse.json({ error: 'No se encontro el archivo principal index.html.' }, { status: 400 })
  }

  // 2. Presentacion: crear o validar que se puede reemplazar ------------------
  let presentacion: { id: string; slug: string; client_id: string }

  if (presentacionId) {
    const { data, error } = await supabase.from('presentaciones').select('id, slug, client_id').eq('id', presentacionId).single()
    if (error || !data) return NextResponse.json({ error: 'No se encontro la presentacion a actualizar.' }, { status: 404 })
    presentacion = data
    if (nombre || descripcion !== null || formData.has('visibilidad')) {
      await supabase.from('presentaciones').update({
        ...(nombre ? { nombre } : {}),
        ...(descripcion !== null ? { descripcion } : {}),
        ...(formData.has('visibilidad') ? { visibilidad } : {}),
      }).eq('id', presentacionId)
    }
  } else {
    const { data: client } = await supabase.from('clients').select('name').eq('id', clientId!).single()
    if (!client) return NextResponse.json({ error: 'Cliente invalido.' }, { status: 400 })
    const slug = await generarSlugUnico(supabase, client.name, nombre!)
    const { data, error } = await supabase.from('presentaciones').insert({
      client_id: clientId, nombre, descripcion, visibilidad, slug, estado: 'procesando', created_by: user.id,
    }).select('id, slug, client_id').single()
    if (error || !data) {
      console.error('Error creando presentacion:', error)
      return NextResponse.json({ error: 'No se pudo crear la presentacion.' }, { status: 500 })
    }
    presentacion = data
  }

  // 3. Subir archivos a Storage -------------------------------------------------
  const { data: versiones } = await supabase
    .from('presentaciones_versiones')
    .select('numero_version')
    .eq('presentacion_id', presentacion.id)
    .order('numero_version', { ascending: false })
    .limit(1)
  const numeroVersion = (versiones?.[0]?.numero_version ?? 0) + 1
  const prefix = `${presentacion.id}/v${numeroVersion}`

  for (const archivo of archivos) {
    const { error: upErr } = await supabase.storage
      .from('presentaciones')
      .upload(`${prefix}/${archivo.path}`, archivo.buffer, { contentType: archivo.contentType, upsert: true })
    if (upErr) {
      console.error('Error subiendo archivo de presentacion:', archivo.path, upErr.message)
      await supabase.from('presentaciones').update({ estado: 'error', error_mensaje: `Error subiendo ${archivo.path}: ${upErr.message}` }).eq('id', presentacion.id)
      return NextResponse.json({ error: `Error durante la carga (${archivo.path}). Podes reintentar.` }, { status: 500 })
    }
  }

  const archivoPrincipalRel = principal.path
  await supabase.from('presentaciones_versiones').insert({
    presentacion_id: presentacion.id, numero_version: numeroVersion, storage_prefix: prefix,
    archivo_principal: archivoPrincipalRel, created_by: user.id,
  })

  await supabase.from('presentaciones').update({
    estado: 'publicada', version_actual: numeroVersion, error_mensaje: null,
  }).eq('id', presentacion.id)

  // 4. Portada automatica (best-effort, no bloquea la respuesta si falla) ------
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
  const publicUrl = `${origin}/p/${presentacion.slug}`
  try {
    const portada = await capturarPortada(publicUrl)
    if (portada) {
      const portadaPath = `${presentacion.id}/portada.png`
      const { error: portadaErr } = await supabase.storage.from('presentaciones').upload(portadaPath, portada, { contentType: 'image/png', upsert: true })
      if (!portadaErr) await supabase.from('presentaciones').update({ portada_path: portadaPath }).eq('id', presentacion.id)
    }
  } catch (err) {
    console.error('Fallo la captura de portada:', err)
  }

  return NextResponse.json({ id: presentacion.id, slug: presentacion.slug, url: publicUrl, estado: 'publicada' })
}
