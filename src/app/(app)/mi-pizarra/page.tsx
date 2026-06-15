import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import MiPizarraClient from './MiPizarraClient'

export default async function MiPizarraPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

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

  // Fetch shares for own postits (who each postit is shared with)
  const myPostitIds = (postits ?? []).map((p: any) => p.id)
  const { data: myShares } = myPostitIds.length
    ? await admin
        .from('postit_shares')
        .select('id, postit_id, user_id, user:users!postit_shares_user_id_fkey(id, full_name, avatar_url)')
        .in('postit_id', myPostitIds)
    : { data: [] }

  // Attach shares to postits
  const sharesByPostit: Record<string, any[]> = {}
  ;(myShares ?? []).forEach((s: any) => {
    if (!sharesByPostit[s.postit_id]) sharesByPostit[s.postit_id] = []
    sharesByPostit[s.postit_id].push({ id: s.id, user_id: s.user_id, user: s.user })
  })
  const postitsWithShares = (postits ?? []).map((p: any) => ({ ...p, shares: sharesByPostit[p.id] ?? [] }))

  // Fetch postits shared with me
  const { data: sharedRows } = await admin
    .from('postit_shares')
    .select('id, postit_id, shared_by_id, created_at, postit:postits(id, content, color, done, created_at, board_owner_id, author_id, image_url, due_date, client_id, author:users!postits_author_id_fkey(id, full_name, avatar_url), client:clients(id, name)), shared_by:users!postit_shares_shared_by_id_fkey(id, full_name, avatar_url)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const sharedWithMe = (sharedRows ?? [])
    .filter((r: any) => r.postit)
    .map((r: any) => ({
      ...r.postit,
      share_id: r.id,
      is_shared_with_me: true,
      shared_by_id: r.shared_by_id,
      shared_by_name: r.shared_by?.full_name ?? '',
      shared_by_avatar: r.shared_by?.avatar_url ?? null,
      shares: [],
    }))

  // Mark unseen shares as seen
  await supabase
    .from('postit_shares')
    .update({ seen_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('seen_at', null)

  return (
    <MiPizarraClient
      userId={user.id}
      userName={myProfile?.full_name ?? ''}
      initialPostits={postitsWithShares as any[]}
      sharedWithMe={sharedWithMe as any[]}
      teammates={(teammates ?? []) as any[]}
      clients={(clients ?? []) as any[]}
    />
  )
}
