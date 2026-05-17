import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PizarronClient from './PizarronClient'

export default async function PizarronPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: posts }, { data: profile }] = await Promise.all([
    supabase
      .from('tablero_posts')
      .select('id, content, image_url, created_at, author_id, author:users!tablero_posts_author_id_fkey(id, full_name, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('users')
      .select('full_name, avatar_url, role')
      .eq('id', user.id)
      .single(),
  ])

  const isAdmin = ['admin', 'gerente_operaciones'].includes(profile?.role ?? '')

  return (
    <PizarronClient
      userId={user.id}
      userName={profile?.full_name ?? ''}
      userAvatarUrl={profile?.avatar_url ?? null}
      isAdmin={isAdmin}
      initialPosts={(posts ?? []) as any[]}
    />
  )
}
