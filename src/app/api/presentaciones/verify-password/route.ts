import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyPassword } from '@/lib/presentaciones/password'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const slug = formData.get('slug') as string | null
  const password = formData.get('password') as string | null
  if (!slug || !password) return NextResponse.redirect(new URL('/', request.url))

  const sb = createAdminClient()
  const { data: presentacion } = await sb.from('presentaciones').select('id, password_hash').eq('slug', slug).maybeSingle()

  const origin = new URL(request.url).origin
  if (!presentacion?.password_hash || !verifyPassword(password, presentacion.password_hash)) {
    return new NextResponse(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"/><meta http-equiv="refresh" content="1;url=/p/${slug}"/></head>
      <body style="font-family:system-ui,sans-serif;background:#0b0d12;color:#f87171;display:flex;align-items:center;justify-content:center;min-height:100vh">Contrasena incorrecta, volviendo...</body></html>`,
      { status: 401, headers: { 'content-type': 'text/html; charset=utf-8' } }
    )
  }

  const response = NextResponse.redirect(new URL(`/p/${slug}`, origin), { status: 303 })
  response.cookies.set(`pres_pw_${presentacion.id}`, presentacion.password_hash, {
    httpOnly: true, secure: true, sameSite: 'lax', path: `/p/${slug}`, maxAge: 60 * 60 * 24 * 30,
  })
  return response
}
