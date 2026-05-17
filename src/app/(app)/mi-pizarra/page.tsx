import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MiPizarraClient from './MiPizarraClient'

export default async function MiPizarraPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: postits }, { data: teammates }, { data: myProfile }] = await Promise.all([
    supabase
      .from('postits')
      .select('id, content, color, done, created_at, board_owner_id, author_id, author:users!postits_author_id_fkey(id, full_name, avatar_url)')
      .eq('board_owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('users')
      .select('id, full_name, avatar_url')
      .neq('id', user.id)
      .order('full_name'),
    supabase
      .from('users')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single(),
  ])

  return (
    <MiPizarraClient
      userId={user.id}
      userName={myProfile?.full_name ?? ''}
      initialPostits={(postits ?? []) as any[]}
      teammates={(teammates ?? []) as any[]}
    />
  )
}
