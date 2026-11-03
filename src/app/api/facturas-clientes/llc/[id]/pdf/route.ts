import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { htmlAPdf, logoDataUri } from '@/lib/facturas/llcPdf'
import { renderFacturaLLCHtml, type FacturaLLC } from '@/lib/facturas/llc'

export const runtime = 'nodejs'
export const maxDuration = 60

// Devuelve el PDF guardado de la factura LLC; si todavia no existe, lo genera desde el detalle guardado y lo guarda.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const { data: f } = await supabase.from('facturas_clientes').select('numero, factura_llc, archivo_path').eq('id', id).single()
  if (!f?.factura_llc) return NextResponse.json({ error: 'Factura LLC no encontrada.' }, { status: 404 })

  let buf: Buffer | null = null
  if (f.archivo_path) {
    const { data } = await supabase.storage.from('documentos-ia').download(f.archivo_path)
    if (data) buf = Buffer.from(await data.arrayBuffer())
  }
  if (!buf) {
    buf = await htmlAPdf(renderFacturaLLCHtml(f.factura_llc as FacturaLLC, await logoDataUri()))
    const archivoPath = `facturas_llc/${f.numero}.pdf`
    const { error } = await supabase.storage.from('documentos-ia').upload(archivoPath, buf, { contentType: 'application/pdf', upsert: true })
    if (!error) await supabase.from('facturas_clientes').update({ archivo_path: archivoPath }).eq('id', id)
  }
  const nombre = (f.factura_llc as FacturaLLC).nombreArchivo || f.numero
  return new NextResponse(new Uint8Array(buf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${f.numero}.pdf"; filename*=UTF-8''${encodeURIComponent(nombre + '.pdf')}` },
  })
}
