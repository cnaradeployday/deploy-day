import { NextRequest, NextResponse } from 'next/server'
import { processWhatsappQueue } from '@/lib/whatsapp'

// Red de seguridad: reintenta pendientes/falladas. El envío normal ya ocurre
// al encolar (enqueueWhatsapp), así que esto solo cubre casos que fallaron
// (Twilio caído, etc.) — llamado por el cron de Vercel (una vez por día en
// el plan Hobby) y disponible para disparar a mano si hace falta.
async function handle(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const result = await processWhatsappQueue()
  return NextResponse.json(result)
}

export const GET = handle
export const POST = handle
