import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractFromDocument } from '@/lib/anthropic/extract'

const SCHEMA = {
  type: 'object',
  properties: {
    numero: { type: 'string', description: 'Número de la factura, ej: 0001-00001234. Cadena vacía si no figura.' },
    fecha_emision: { type: 'string', description: 'Fecha de emisión en formato YYYY-MM-DD.' },
    cuit_receptor: { type: 'string', description: 'CUIT del receptor/cliente de la factura (a quién se le factura), solo dígitos sin guiones. Cadena vacía si no figura.' },
    razon_social_receptor: { type: 'string', description: 'Razón social del receptor/cliente tal como figura en la factura.' },
    importe_neto: { type: 'number', description: 'Importe neto (subtotal sin IVA). 0 si no se puede determinar.' },
    importe_iva: { type: 'number', description: 'Monto de IVA discriminado. 0 si no aplica o no figura.' },
    importe_total: { type: 'number', description: 'Importe total de la factura (neto + IVA + otros). 0 si no se puede determinar.' },
  },
  required: ['numero', 'fecha_emision', 'cuit_receptor', 'razon_social_receptor', 'importe_neto', 'importe_iva', 'importe_total'],
  additionalProperties: false,
}

const SYSTEM = `Sos un asistente contable que extrae datos de facturas emitidas a clientes (facturas de venta) en Argentina, a partir de un PDF o imagen del comprobante. Prestá especial atención al CUIT del RECEPTOR (cliente al que se le factura), no al del emisor. Si un dato no figura, usá "" para texto o 0 para números — nunca inventes valores. Las fechas van en formato YYYY-MM-DD. El CUIT va sin guiones ni espacios.`

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
