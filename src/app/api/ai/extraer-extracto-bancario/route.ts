import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasModuleAccess } from '@/lib/permissions'
import { extractFromDocument } from '@/lib/anthropic/extract'

const SCHEMA = {
  type: 'object',
  properties: {
    movimientos: {
      type: 'array',
      description: 'Todos los movimientos del extracto bancario, en el mismo orden que en el documento.',
      items: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'Fecha del movimiento en formato YYYY-MM-DD.' },
          descripcion: { type: 'string', description: 'Descripción o concepto del movimiento tal como figura en el extracto.' },
          credito_debito: { type: 'number', description: 'Monto del movimiento. Positivo si es un crédito/ingreso, negativo si es un débito/egreso.' },
          saldo: { type: 'number', description: 'Saldo de la cuenta luego de aplicar este movimiento, tal como figura en el extracto.' },
        },
        required: ['fecha', 'descripcion', 'credito_debito', 'saldo'],
        additionalProperties: false,
      },
    },
  },
  required: ['movimientos'],
  additionalProperties: false,
}

const SYSTEM = `Sos un asistente contable que extrae la lista completa de movimientos de un extracto bancario argentino (PDF), incluyendo TODOS los movimientos del período, no solo un resumen. Cada fila del extracto es un movimiento independiente. El monto va en "credito_debito": positivo si es un crédito/ingreso, negativo si es un débito/egreso. Las fechas van en formato YYYY-MM-DD. No incluyas encabezados, totales ni líneas informativas que no sean un movimiento concreto.`

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
