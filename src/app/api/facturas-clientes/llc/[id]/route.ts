import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { htmlAPdf, logoDataUri } from '@/lib/facturas/llcPdf'
import { renderFacturaLLCHtml, nombreArchivoLLC, sanearLineas, totalesLLC, type FacturaLLC } from '@/lib/facturas/llc'

export const runtime = 'nodejs'
export const maxDuration = 60

const ISO = /^\d{4}-\d{2}-\d{2}$/

// Modifica una factura LLC ya emitida: mantiene su numero y regenera el PDF guardado.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Sin permiso.' }, { status: 403 })

  const { data: actual } = await supabase.from('facturas_clientes')
    .select('numero, client_id, factura_llc, client:clients(name)').eq('id', id).single()
  if (!actual?.factura_llc) return NextResponse.json({ error: 'Factura LLC no encontrada.' }, { status: 404 })

  const b = await request.json()
  const lineas = sanearLineas(b.lineas)
  if (!ISO.test(b.fecha ?? '') || !ISO.test(b.fecha_vencimiento ?? '') || !lineas.length)
    return NextResponse.json({ error: 'Faltan datos: fechas e ítems.' }, { status: 400 })
  const nombreCliente = String(b.cliente?.nombre ?? '').trim()
  if (!nombreCliente) return NextResponse.json({ error: 'Falta el nombre en BILL TO.' }, { status: 400 })
  const { total } = totalesLLC(lineas)
  if (total <= 0) return NextResponse.json({ error: 'El total de la factura debe ser mayor a 0.' }, { status: 400 })

  const numero = actual.numero
  const factura: FacturaLLC = {
    numero, fecha: b.fecha,
    nombreArchivo: nombreArchivoLLC(numero, (actual.client as { name?: string } | null)?.name ?? ''),
    periodo: String(b.periodo ?? '').toUpperCase(),
    para: String(b.para ?? ''),
    cliente: {
      nombre: nombreCliente,
      direccion: String(b.cliente?.direccion ?? ''),
      idFiscalLabel: String(b.cliente?.idFiscalLabel ?? 'Ruc'),
      idFiscal: String(b.cliente?.idFiscal ?? ''),
    },
    lineas,
  }

  const { error } = await supabase.from('facturas_clientes').update({
    project_id: b.project_id || null,
    fecha_emision: b.fecha,
    fecha_vencimiento: b.fecha_vencimiento,
    importe: total,
    importe_neto: null,
    iva_pct: null,
    importe_iva: null,
    mes_servicio: b.mes_servicio || null,
    cuit: factura.cliente.idFiscal.trim() || null,
    factura_llc: factura,
  }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await supabase.from('clients').update({
    direccion_facturacion: factura.cliente.direccion || null,
    id_fiscal: factura.cliente.idFiscal.trim() || null,
    id_fiscal_label: factura.cliente.idFiscalLabel.trim() || 'Ruc',
  }).eq('id', actual.client_id)

  let pdf = false
  try {
    const buf = await htmlAPdf(renderFacturaLLCHtml(factura, await logoDataUri()))
    const archivoPath = `facturas_llc/${numero}.pdf`
    const { error: upErr } = await supabase.storage.from('documentos-ia').upload(archivoPath, buf, { contentType: 'application/pdf', upsert: true })
    if (upErr) throw new Error(upErr.message)
    await supabase.from('facturas_clientes').update({ archivo_path: archivoPath }).eq('id', id)
    pdf = true
  } catch (e) {
    console.error('No se pudo regenerar el PDF de la factura LLC:', e)
  }
  return NextResponse.json({ id, numero, pdf })
}
