import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractFromDocument } from '@/lib/anthropic/extract'

const SCHEMA = {
  type: 'object',
  properties: {
    cuit: { type: 'string', description: 'CUIT del proveedor, solo dígitos, sin guiones ni espacios. Cadena vacía si no figura.' },
    numero_factura: { type: 'string', description: 'Número de comprobante, ej: A-00001-00001234. Cadena vacía si no figura.' },
    fecha_factura: { type: 'string', description: 'Fecha de emisión de la factura en formato YYYY-MM-DD.' },
    razon_social_proveedor: { type: 'string', description: 'Razón social del proveedor (emisor de la factura).' },
    monto_neto: { type: 'number', description: 'Monto neto (subtotal sin impuestos). 0 si no se puede determinar.' },
    iva: { type: 'number', description: 'Monto de IVA discriminado en la factura. 0 si no aplica o no figura.' },
    iibb: { type: 'number', description: 'Monto de percepción de Ingresos Brutos si figura. 0 si no aplica.' },
    otros_impuestos: { type: 'number', description: 'Otros impuestos o percepciones distintos de IVA e IIBB. 0 si no aplica.' },
    tipo_gasto_sugerido: { type: 'string', description: 'Categoría de gasto sugerida en texto libre según el proveedor y concepto de la factura (ej: Combustible, Licencias, Honorarios).' },
  },
  required: ['cuit', 'numero_factura', 'fecha_factura', 'razon_social_proveedor', 'monto_neto', 'iva', 'iibb', 'otros_impuestos', 'tipo_gasto_sugerido'],
  additionalProperties: false,
}

const SYSTEM = `Sos un asistente contable que extrae datos de facturas de compra (comprobantes de proveedores) en Argentina, a partir de un PDF o imagen del comprobante. Devolvé exactamente los campos pedidos. Si un dato no figura en el documento, usá "" para texto o 0 para números — nunca inventes valores. Las fechas van en formato YYYY-MM-DD. El CUIT va sin guiones ni espacios.`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })

  const bytes = Buffer.from(await file.arrayBuffer())
  const base64 = bytes.toString('base64')
  const mediaType = file.type || 'application/pdf'

  try {
    const data = await extractFromDocument({ base64, mediaType, systemPrompt: SYSTEM, schema: SCHEMA })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Error al procesar el documento' }, { status: 500 })
  }
}
