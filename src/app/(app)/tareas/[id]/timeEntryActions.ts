'use server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autorizado')
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!['admin', 'gerente_operaciones'].includes(profile?.role ?? '')) {
    throw new Error('Sin permisos')
  }
}

export async function updateTimeEntryAction(
  id: string,
  hours: number,
  notes: string | null,
  date: string
) {
  await requireAdmin()
  const { error } = await getAdminClient()
    .from('time_entries')
    .update({ hours_logged: hours, notes, entry_date: date })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteTimeEntryAction(id: string) {
  await requireAdmin()
  const { error } = await getAdminClient()
    .from('time_entries')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}
