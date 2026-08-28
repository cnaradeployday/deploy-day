import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CrmClient from './CrmClient'

export default async function CrmPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('users').select('role, custom_role_id').eq('id', user.id).single()

  const isGerente = ['admin', 'gerente_operaciones'].includes(profile?.role ?? '')
  let canRead = isGerente
  let canWrite = isGerente
  if (profile?.custom_role_id) {
    const { data: perm } = await supabase
      .from('role_permissions').select('can_read, can_write')
      .eq('role_id', profile.custom_role_id).eq('module', 'crm').single()
    if (!canRead) canRead = perm?.can_read ?? false
    if (!canWrite) canWrite = perm?.can_write ?? false
  }
  if (!canRead) redirect('/dashboard')

  const { data: prospects } = await supabase
    .from('prospects')
    .select('*, client:clients(id, name)')
    .order('created_at', { ascending: false })

  const { data: clientes } = await supabase.from('clients').select('id, name').order('name')
  const { data: usuarios } = await supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name')

  return (
    <CrmClient
      prospects={prospects ?? []}
      clientes={clientes ?? []}
      usuarios={usuarios ?? []}
      canWrite={canWrite}
      currentUserId={user.id}
    />
  )
}
