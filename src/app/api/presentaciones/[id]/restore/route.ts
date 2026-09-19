import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// Restaurar una version anterior es solo mover el puntero version_actual: los
// archivos de cada version quedan guardados en Storage para siempre bajo su
// propio prefijo (nunca se pisan), asi que no hay nada que volver a subir.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const { numero_version } = await request.json()
  const { data: version } = await supabase.from('presentaciones_versiones')
    .select('numero_version').eq('presentacion_id', id).eq('numero_version', numero_version).maybeSingle()
  if (!version) return NextResponse.json({ error: 'Esa version no existe.' }, { status: 404 })

  const { error } = await supabase.from('presentaciones')
    .update({ estado: 'publicada', version_actual: numero_version }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
