import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { htmlAPdf, logoDataUri } from '@/lib/facturas/llcPdf'
import { renderFacturaLLCHtml, nombreArchivoLLC, numeroFactura, proximoCorrelativo, totalesLLC, sanearLineas, type FacturaLLC } from '@/lib/facturas/llc'

export const runtime = 'nodejs'
export const maxDuration = 60

const ISO = /^\d{4}-\d{2}-\d{2}$/

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Sin permiso.' }, { status: 403 })

  const b = await request.json()
  const lineas = sanearLineas(b.lineas)
  if (!b.client_id || !ISO.test(b.fecha ?? '') || !ISO.test(b.fecha_vencimiento ?? '') || !lineas.length)
    return NextResponse.json({ error: 'Faltan datos: cliente, fechas e ítems.' }, { status: 400 })
  const nombreCliente = String(b.cliente?.nombre ?? '').trim()
  if (!nombreCliente) return NextResponse.json({ error: 'Falta el nombre en BILL TO.' }, { status: 400 })

  const { total } = totalesLLC(lineas)
  if (total <= 0) return NextResponse.json({ error: 'El total de la factura debe ser mayor a 0.' }, { status: 400 })

  // El correlativo se recalcula en el servidor para no pisar un numero emitido mientras el formulario estaba abierto.
  const { data: previas } = await supabase.from('facturas_clientes').select('numero').eq('sociedad', 'LLC')
  const numero = numeroFactura(b.fecha, proximoCorrelativo((previas ?? []).map(p => p.numero)))

  const { data: cli } = await supabase.from('clients').select('name').eq('id', b.client_id).single()

  const factura: FacturaLLC = {
    numero, fecha: b.fecha,
    nombreArchivo: nombreArchivoLLC(numero, cli?.name ?? ''),
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

  const { data: inserted, error } = await supabase.from('facturas_clientes').insert({
    client_id: b.client_id,
    project_id: b.project_id || null,
    numero,
    fecha_emision: b.fecha,
    fecha_vencimiento: b.fecha_vencimiento,
    importe: total,
    importe_neto: null,
    iva_pct: null,
    importe_iva: null,
    currency: 'USD',
    mes_servicio: b.mes_servicio || null,
    sociedad: 'LLC',
    cuit: factura.cliente.idFiscal.trim() || null,
    created_by: user.id,
    factura_llc: factura,
  }).select('id').single()
  if (error || !inserted) return NextResponse.json({ error: error?.message ?? 'No se pudo guardar la factura.' }, { status: 400 })

  // Recuerda en la ficha del cliente los datos de BILL TO para la proxima factura.
  await supabase.from('clients').update({
    direccion_facturacion: factura.cliente.direccion || null,
    id_fiscal: factura.cliente.idFiscal.trim() || null,
    id_fiscal_label: factura.cliente.idFiscalLabel.trim() || 'Ruc',
  }).eq('id', b.client_id)

  // PDF: si falla la factura igual queda registrada y se puede regenerar desde su detalle.
  let pdf = false
  try {
    const buf = await htmlAPdf(renderFacturaLLCHtml(factura, await logoDataUri()))
    const archivoPath = `facturas_llc/${numero}.pdf`
    const { error: upErr } = await supabase.storage.from('documentos-ia').upload(archivoPath, buf, { contentType: 'application/pdf', upsert: true })
    if (upErr) throw new Error(upErr.message)
    await supabase.from('facturas_clientes').update({ archivo_path: archivoPath }).eq('id', inserted.id)
    pdf = true
  } catch (e) {
    console.error('No se pudo generar/guardar el PDF de la factura LLC:', e)
  }
  return NextResponse.json({ id: inserted.id, numero, pdf })
}
