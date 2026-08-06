import type { SupabaseClient } from '@supabase/supabase-js'

export async function hasModuleAccess(
  supabase: SupabaseClient,
  userId: string | undefined,
  module: string,
  level: 'read' | 'write' = 'read'
): Promise<boolean> {
  if (!userId) return false
  const { data: profile } = await supabase.from('users').select('role, custom_role_id').eq('id', userId).single()
  if (profile?.role === 'admin') return true
  if (!profile?.custom_role_id) return false
  const { data: perm } = await supabase
    .from('role_permissions')
    .select('can_read, can_write')
    .eq('role_id', profile.custom_role_id)
    .eq('module', module)
    .maybeSingle()
  if (!perm) return false
  return level === 'write' ? !!perm.can_write : !!perm.can_read
}
