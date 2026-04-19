import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewsClient from './NewsClient'

export default async function NewsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users')
    .select('role, custom_role_id')
    .eq('id', user?.id ?? '')
    .single()

  const isAdmin = ['admin', 'gerente_operaciones'].includes(profile?.role ?? '')
  let canManageNews = isAdmin

  if (!canManageNews && profile?.custom_role_id) {
    const { data: perm } = await supabase
      .from('role_permissions')
      .select('can_read')
      .eq('role_id', profile.custom_role_id)
      .eq('module', 'news')
      .single()
    canManageNews = perm?.can_read ?? false
  }

  if (!canManageNews) redirect('/dashboard')

  const { data: allUsers } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name')

  const { data: newsList } = await supabase
    .from('news')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <NewsClient
      newsList={newsList ?? []}
      allUsers={allUsers ?? []}
      currentUserId={user?.id ?? ''}
    />
  )
}
