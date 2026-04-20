import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogsClient from './LogsClient'

export default async function LogsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('role, custom_role_id').eq('id', user.id).single()

  const isAdmin = profile?.role === 'admin'
  let canAccess = isAdmin
  if (!canAccess && profile?.custom_role_id) {
    const { data: perm } = await supabase
      .from('role_permissions').select('can_read')
      .eq('role_id', profile.custom_role_id).eq('module', 'logs').single()
    canAccess = perm?.can_read ?? false
  }
  if (!canAccess) redirect('/dashboard')

  const sp = await searchParams
  const section = sp.section ?? ''
  const userId = sp.user ?? ''
  const page = parseInt(sp.page ?? '1')
  const perPage = 50

  let query = supabase
    .from('activity_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1)

  if (section) query = query.eq('section', section)
  if (userId) query = query.eq('user_id', userId)

  const { data: logs, count } = await query

  const { data: users } = await supabase
    .from('users').select('id, full_name').order('full_name')

  const sections = [
    'login', 'tareas', 'proyectos', 'usuarios', 'horas', 'mis-tareas', 'chat', 'anuncios'
  ]

  return (
    <LogsClient
      logs={logs ?? []}
      total={count ?? 0}
      page={page}
      perPage={perPage}
      filters={{ section, userId }}
      users={users ?? []}
      sections={sections}
    />
  )
}
