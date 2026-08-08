import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasModuleAccess } from '@/lib/permissions'
import { extractFromDocument } from '@/lib/anthropic/extract'

const SCHEMA = {
  type: 'object',
  properties: {
    fecha_cierre: { type: 'string', description: 'Fecha de cierre del resumen tal como figura impresa en el documento (encabezado o pie del resumen), en formato YYYY-MM-DD. Cadena vacía si no figura.' },
    movimientos: {
      type: 'array',
      description: 'Todos los consumos/movimientos individuales que aparecen en el resumen de tarjeta de crédito, en el mismo orden que en el documento.',
      items: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'Fecha del consumo en formato YYYY-MM-DD.' },
          proveedor: { type: 'string', description: 'Nombre del comercio o proveedor tal como figura en el resumen.' },
          cuota: { type: 'string', description: 'Número de cuota si el consumo está en cuotas, ej "1/6". Cadena vacía si es pago único.' },
          pesos: { type: 'number', description: 'Monto del consumo en pesos argentinos. 0 si el consumo está expresado solo en dólares.' },
          dolares: { type: 'number', description: 'Monto del consumo en dólares estadounidenses. 0 si el consumo está expresado solo en pesos.' },
          comprobante: { type: 'string', description: 'Tipo de comprobante si figura (ej: Factura A, Ticket B, Ticket no fiscal). Cadena vacía si no figura.' },
          clasificacion_sugerida: { type: 'string', description: 'Categoría de gasto sugerida en texto libre según el proveedor/concepto (ej: Combustible, Licencias, Gtos de representacion - Meals, Traslados).' },
        },
        required: ['fecha', 'proveedor', 'cuota', 'pesos', 'dolares', 'comprobante', 'clasificacion_sugerida'],
        additionalProperties: false,
      },
    },
  },
  required: ['fecha_cierre', 'movimientos'],
  additionalProperties: false,
}

const SYSTEM = `Sos un asistente contable que extrae datos de un resumen de tarjeta de crédito bancario argentino (PDF). Extraé la fecha de cierre del resumen (fecha_cierre) y la lista completa de movimientos/consumos, incluyendo TODAS las filas del período, no solo un resumen. Cada fila del resumen es un movimiento independiente. Si un consumo está en dólares, poné el monto en "dolares" y 0 en "pesos"; si está en pesos, al revés. Las fechas van en formato YYYY-MM-DD. No incluyas totales, subtotales, saldos ni líneas de intereses financieros del resumen como si fueran consumos, solo los consumos/compras individuales.`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!(await hasModuleAccess(supabase, user?.id, 'contabilidad', 'write'))) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

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
