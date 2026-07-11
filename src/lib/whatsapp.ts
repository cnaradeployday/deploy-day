import 'server-only'
import twilio from 'twilio'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdmin() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function buildMessageBody(eventType: string, vars: Record<string, any>): string {
  switch (eventType) {
    case 'revision_disponible':
      return `DDS · Nueva revisión disponible\nLa tarea "${vars.tarea}" tiene una nueva versión pendiente de revisión.\nVer tarea: ${vars.link}`
    case 'correcciones_internas':
      return `DDS · Correcciones solicitadas\nLa versión ${vars.version} de la tarea "${vars.tarea}" requiere cambios.\nRevisado por: ${vars.revisado_por}\nComentario: ${vars.comentario}\nVer tarea: ${vars.link}`
    case 'correcciones_cliente':
      return `DDS · El cliente solicitó cambios\nTarea: "${vars.tarea}"\nComentario: ${vars.comentario}\nVer tarea: ${vars.link}`
    case 'vencimiento_proximo':
      return `DDS · Tarea próxima a vencer\n"${vars.tarea}" vence el ${vars.fecha}.\nVer tarea: ${vars.link}`
    case 'incorporacion_tarea':
      return `DDS · Te asignaron una tarea\n"${vars.tarea}"${vars.vence ? ' · vence ' + vars.vence : ''}\nVer tarea: ${vars.link}`
    default:
      return `DDS · Tenés una novedad.\nVer: ${vars.link ?? ''}`
  }
}

/**
 * Procesa una fila de la cola: la manda por Twilio (WhatsApp) y actualiza su estado.
 * Nunca lanza — un fallo de Twilio queda registrado en la fila, no interrumpe al llamador.
 */
export async function sendQueuedWhatsapp(notificationId: string): Promise<void> {
  const admin = getAdmin()

  const { data: n } = await admin.from('whatsapp_notifications').select('*').eq('id', notificationId).single()
  if (!n || n.status !== 'pendiente') return

  await admin.from('whatsapp_notifications')
    .update({ status: 'procesando', attempts: n.attempts + 1 }).eq('id', notificationId)

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM
  if (!sid || !token || !from) {
    await admin.from('whatsapp_notifications')
      .update({ status: 'fallida', last_error: 'Faltan credenciales de Twilio (env vars)' }).eq('id', notificationId)
    return
  }

  try {
    const client = twilio(sid, token)
    const body = buildMessageBody(n.event_type, n.template_vars ?? {})
    const to = n.phone.startsWith('whatsapp:') ? n.phone : 'whatsapp:' + n.phone
    const message = await client.messages.create({ from, to, body })
    await admin.from('whatsapp_notifications')
      .update({ status: 'enviada', twilio_message_id: message.sid, sent_at: new Date().toISOString() })
      .eq('id', notificationId)
  } catch (err: any) {
    await admin.from('whatsapp_notifications')
      .update({ status: 'fallida', last_error: String(err?.message ?? err) })
      .eq('id', notificationId)
  }
}

/** Reintenta todas las notificaciones pendientes o falladas (con margen de reintentos). Usado por el cron y por el botón manual. */
export async function processWhatsappQueue(): Promise<{ processed: number }> {
  const admin = getAdmin()
  const { data: rows } = await admin.from('whatsapp_notifications')
    .select('id')
    .or('status.eq.pendiente,and(status.eq.fallida,attempts.lt.3)')
    .order('created_at', { ascending: true })
    .limit(50)

  for (const row of rows ?? []) {
    // Las que están "fallida" deben volver a "pendiente" antes de reintentarlas
    await admin.from('whatsapp_notifications').update({ status: 'pendiente' }).eq('id', row.id).eq('status', 'fallida')
    await sendQueuedWhatsapp(row.id)
  }
  return { processed: rows?.length ?? 0 }
}
