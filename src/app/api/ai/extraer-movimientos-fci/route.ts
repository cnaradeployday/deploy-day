import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasModuleAccess } from '@/lib/permissions'
import { extractFromDocument } from '@/lib/anthropic/extract'

const SCHEMA = {
  type: 'object',
  properties: {
    movimientos: {
      type: 'array',
      description: 'Todos los movimientos de suscripción/rescate de cuotapartes que aparecen en el resumen del Fondo Común de Inversión, en el mismo orden que en el documento.',
      items: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'Fecha del movimiento en formato YYYY-MM-DD.' },
          operacion: { type: 'string', enum: ['SUSCRIPCION', 'RESCATE'], description: 'SUSCRIPCION si se compraron/aportaron cuotapartes, RESCATE si se rescataron/retiraron.' },
          cantidad_cuotas: { type: 'number', description: 'Cantidad de cuotapartes de la operación. 0 si no se puede determinar.' },
          tc_fondo: { type: 'number', description: 'Valor de la cuotaparte del fondo en el momento de la operación. 0 si no figura.' },
          monto: { type: 'number', description: 'Monto en pesos de la operación (cantidad_cuotas × tc_fondo). 0 si no se puede determinar.' },
        },
        required: ['fecha', 'operacion', 'cantidad_cuotas', 'tc_fondo', 'monto'],
        additionalProperties: false,
      },
    },
  },
  required: ['movimientos'],
  additionalProperties: false,
}

const SYSTEM = `Sos un asistente contable que extrae la lista completa de movimientos de suscripción y rescate de cuotapartes de un resumen de Fondo Común de Inversión (FCI) argentino, incluyendo TODOS los movimientos del período, no solo un resumen. Cada fila del resumen es un movimiento independiente. Las fechas van en formato YYYY-MM-DD. No incluyas saldos, totales ni líneas informativas que no sean una operación de suscripción o rescate.`

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
