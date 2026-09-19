import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { contentTypeFor } from '@/lib/presentaciones/zip'

export const runtime = 'nodejs'

function paginaSimple(titulo: string, mensaje: string, status: number) {
  return new NextResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>${titulo}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <style>body{font-family:system-ui,sans-serif;background:#0b0d12;color:#e6e8eb;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}
    div{max-width:420px}h1{font-size:20px;margin-bottom:8px}p{color:#9aa1ab;font-size:14px}</style></head>
    <body><div><h1>${titulo}</h1><p>${mensaje}</p></div></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8' } }
  )
}

function paginaPassword(slug: string, error?: string) {
  return new NextResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Presentacion protegida</title>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <style>body{font-family:system-ui,sans-serif;background:#0b0d12;color:#e6e8eb;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
    form{max-width:320px;width:100%;text-align:center}h1{font-size:18px;margin-bottom:16px}
    input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid #2a2e37;background:#151821;color:#fff;font-size:14px;margin-bottom:10px}
    button{width:100%;padding:10px 12px;border-radius:8px;border:none;background:#1B9BF0;color:#fff;font-size:14px;cursor:pointer}
    p.err{color:#f87171;font-size:13px;margin:-4px 0 10px}</style></head>
    <body><form method="POST" action="/api/presentaciones/verify-password">
      <h1>Esta presentacion esta protegida</h1>
      ${error ? `<p class="err">${error}</p>` : ''}
      <input type="hidden" name="slug" value="${slug}"/>
      <input type="password" name="password" placeholder="Contrasena" autofocus required/>
      <button type="submit">Ver presentacion</button>
    </form></body></html>`,
    { status: 401, headers: { 'content-type': 'text/html; charset=utf-8' } }
  )
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string; path?: string[] }> }) {
  const { slug, path } = await params
  const sb = createAdminClient()

  const { data: presentacion } = await sb
    .from('presentaciones')
    .select('id, slug, estado, version_actual, password_hash, link_expira_at')
    .eq('slug', slug)
    .maybeSingle()

  if (!presentacion) return paginaSimple('No encontrada', 'Esta presentacion no existe.', 404)
  if (presentacion.estado === 'despublicada') return paginaSimple('No disponible', 'Esta presentacion fue despublicada.', 404)
  if (presentacion.estado !== 'publicada') return paginaSimple('No disponible', 'Esta presentacion todavia no esta publicada.', 404)
  if (presentacion.link_expira_at && new Date(presentacion.link_expira_at) < new Date()) {
    return paginaSimple('Link vencido', 'El link de esta presentacion vencio.', 410)
  }

  if (presentacion.password_hash) {
    const cookie = request.cookies.get(`pres_pw_${presentacion.id}`)?.value
    if (cookie !== presentacion.password_hash) return paginaPassword(slug)
  }

  const { data: version } = await sb
    .from('presentaciones_versiones')
    .select('storage_prefix, archivo_principal')
    .eq('presentacion_id', presentacion.id)
    .eq('numero_version', presentacion.version_actual)
    .maybeSingle()

  if (!version) return paginaSimple('No disponible', 'Esta presentacion no tiene archivos publicados.', 404)

  const relPath = path && path.length > 0 ? path.join('/') : version.archivo_principal
  const storageKey = `${version.storage_prefix}/${relPath}`

  const { data: file, error } = await sb.storage.from('presentaciones').download(storageKey)
  if (error || !file) return paginaSimple('No encontrado', 'No se encontro ese archivo dentro de la presentacion.', 404)

  const esIndice = !path || path.length === 0
  if (esIndice) {
    await sb.from('presentaciones_vistas').insert({
      presentacion_id: presentacion.id,
      referrer: request.headers.get('referer'),
      user_agent: request.headers.get('user-agent'),
    })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'content-type': contentTypeFor(relPath),
      'cache-control': esIndice ? 'no-cache' : 'public, max-age=31536000, immutable',
    },
  })
}
