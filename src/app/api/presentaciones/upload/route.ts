import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generarSlugUnico } from '@/lib/presentaciones/slug'
import { extraerZip, encontrarArchivoPrincipal, contentTypeFor, type ArchivoExtraido } from '@/lib/presentaciones/zip'
import { capturarPortada } from '@/lib/presentaciones/screenshot'

export const runtime = 'nodejs'
export const maxDuration = 90

const MAX_ZIP_BYTES = 100 * 1024 * 1024 // 100MB

// Vercel rechaza bodies > ~4.5MB en funciones serverless, asi que el navegador
// sube los archivos directo a Storage (carpeta temporal `staging/<user>/<id>`)
// y este endpoint solo recibe metadatos y los lee desde ahi.
async function descargarStaging(supabase: Awaited<ReturnType<typeof createClient>>, path: string) {
  const { data, error } = await supabase.storage.from('presentaciones').download(path)
  if (error || !data) throw new Error(`No se pudo leer ${path}: ${error?.message}`)
  return data
}

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

  // 1. Extraer/juntar archivos (subidos antes por el navegador a Storage) -----
  const stagingPrefix = formData.get('staging_prefix') as string | null
  if (!stagingPrefix || !stagingPrefix.startsWith(`staging/${user.id}/`) || stagingPrefix.includes('..')) {
    return NextResponse.json({ error: 'Carga temporal invalida. Intenta de nuevo.' }, { status: 400 })
  }

  let archivos: ArchivoExtraido[]
  try {
    if (mode === 'zip') {
      const blob = await descargarStaging(supabase, `${stagingPrefix}/archivo.zip`)
      if (blob.size > MAX_ZIP_BYTES) return NextResponse.json({ error: 'El archivo es demasiado pesado (maximo 100MB).' }, { status: 400 })
      const buffer = Buffer.from(await blob.arrayBuffer())
      archivos = await extraerZip(buffer)
      if (archivos.length === 0) return NextResponse.json({ error: 'El ZIP esta vacio o no se pudo leer. Verifica que el archivo no este corrupto.' }, { status: 400 })
    } else {
      const pathsRaw = formData.get('paths') as string | null
      if (!pathsRaw) return NextResponse.json({ error: 'No se recibieron archivos.' }, { status: 400 })
      const paths: string[] = JSON.parse(pathsRaw)
      if (!paths.length) return NextResponse.json({ error: 'No se recibieron archivos.' }, { status: 400 })
      let totalBytes = 0
      archivos = []
      for (let i = 0; i < paths.length; i++) {
        const blob = await descargarStaging(supabase, `${stagingPrefix}/f${i}`)
        totalBytes += blob.size
        if (totalBytes > MAX_ZIP_BYTES) return NextResponse.json({ error: 'Los archivos son demasiado pesados en conjunto (maximo 100MB).' }, { status: 400 })
        archivos.push({ path: paths[i], buffer: Buffer.from(await blob.arrayBuffer()), contentType: contentTypeFor(paths[i]) })
      }
    }
  } catch (err) {
    console.error('Error leyendo archivos de presentacion:', err)
    return NextResponse.json({ error: 'No se pudieron leer los archivos subidos o el ZIP es invalido.' }, { status: 400 })
  } finally {
    await limpiarStaging(supabase, stagingPrefix)
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

async function limpiarStaging(supabase: Awaited<ReturnType<typeof createClient>>, prefix: string) {
  try {
    const { data } = await supabase.storage.from('presentaciones').list(prefix, { limit: 1000 })
    if (data?.length) await supabase.storage.from('presentaciones').remove(data.map(f => `${prefix}/${f.name}`))
  } catch (err) {
    console.error('No se pudo limpiar la carpeta temporal:', err)
  }
}
