import { createClient } from '@/lib/supabase/client'

export async function logActivity({
  action,
  section,
  entityId,
  entityName,
  detail,
}: {
  action: string
  section: string
  entityId?: string
  entityName?: string
  detail?: string
}) {
  try {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return

    const { data: profile } = await sb
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single()

    await sb.from('activity_logs').insert({
      user_id: user.id,
      user_name: profile?.full_name ?? user.email ?? 'Usuario',
      action,
      section,
      entity_id: entityId ?? null,
      entity_name: entityName ?? null,
      detail: detail ?? null,
    })
  } catch {
    // Logs nunca deben romper el flujo principal
  }
}
