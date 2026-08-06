import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MiPizarraClient from './MiPizarraClient'

export default async function MiPizarraPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('role, custom_role_id').eq('id', user.id).single()

  const isAdmin = ['admin', 'gerente_operaciones'].includes(profile?.role ?? '')
  let canAccess = isAdmin
  if (!canAccess && profile?.custom_role_id) {
    const { data: perm } = await supabase
      .from('role_permissions').select('can_read')
      .eq('role_id', profile.custom_role_id).eq('module', 'mi_pizarra').single()
    canAccess = perm?.can_read ?? false
  }
  if (!canAccess) redirect('/dashboard')

  const [{ data: postits }, { data: teammates }, { data: myProfile }, { data: clients }] = await Promise.all([
    supabase
      .from('postits')
      .select('id, content, color, done, created_at, board_owner_id, author_id, image_url, due_date, client_id, author:users!postits_author_id_fkey(id, full_name, avatar_url), client:clients(id, name)')
      .eq('board_owner_id', user.id)
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('users')
      .select('id, full_name, avatar_url')
      .neq('id', user.id)
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('users')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single(),
    supabase
      .from('clients')
      .select('id, name')
      .order('name'),
  ])

  return (
    <MiPizarraClient
      userId={user.id}
      userName={myProfile?.full_name ?? ''}
      initialPostits={(postits ?? []) as any[]}
      teammates={(teammates ?? []) as any[]}
      clients={(clients ?? []) as any[]}
    />
  )
}
