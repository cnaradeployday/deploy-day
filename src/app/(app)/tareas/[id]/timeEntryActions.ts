'use server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function requireCanEditEntries() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autorizado')
  const { data: profile } = await supabase
    .from('users').select('role, custom_role_id').eq('id', user.id).single()

  if (['admin', 'gerente_operaciones'].includes(profile?.role ?? '')) return

  if (profile?.custom_role_id) {
    const { data: perm } = await supabase
      .from('role_permissions').select('can_read')
      .eq('role_id', profile.custom_role_id).eq('module', 'tareas').single()
    if (perm?.can_read) return
  }

  throw new Error('Sin permisos')
}

export async function updateTimeEntryAction(
  id: string,
  hours: number,
  notes: string | null,
  date: string
) {
  await requireCanEditEntries()
  const { error } = await getAdminClient()
    .from('time_entries')
    .update({ hours_logged: hours, notes, entry_date: date })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteTimeEntryAction(id: string) {
  await requireCanEditEntries()
  const { error } = await getAdminClient()
    .from('time_entries')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}
