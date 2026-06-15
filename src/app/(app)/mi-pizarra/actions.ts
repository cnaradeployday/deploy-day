'use server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/app/(app)/novedades/actions'

function getAdmin() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function togglePostitDoneAction(postitId: string, done: boolean): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const admin = getAdmin()
  const { data: postit } = await admin.from('postits').select('board_owner_id').eq('id', postitId).single()
  if (!postit) return { error: 'No encontrado' }

  if (postit.board_owner_id !== user.id) {
    const { data: share } = await admin.from('postit_shares').select('id').eq('postit_id', postitId).eq('user_id', user.id).single()
    if (!share) return { error: 'Sin permiso' }
  }

  const { error } = await admin.from('postits').update({ done }).eq('id', postitId)
  return { error: error?.message ?? null }
}

export async function sharePostitAction(postitId: string, userIds: string[]): Promise<{ error: string | null; shares: any[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado', shares: [] }

  const admin = getAdmin()

  const { data: currentShares } = await admin
    .from('postit_shares').select('id, user_id, user:users!postit_shares_user_id_fkey(id, full_name, avatar_url)')
    .eq('postit_id', postitId).eq('shared_by_id', user.id)

  const currentUserIds = (currentShares ?? []).map((s: any) => s.user_id as string)

  const toRemove = currentUserIds.filter(uid => !userIds.includes(uid))
  if (toRemove.length > 0) {
    await admin.from('postit_shares').delete().eq('postit_id', postitId).in('user_id', toRemove)
  }

  const toAdd = userIds.filter(uid => !currentUserIds.includes(uid))
  if (toAdd.length > 0) {
    await admin.from('postit_shares').insert(toAdd.map(uid => ({
      postit_id: postitId, user_id: uid, shared_by_id: user.id,
    })))
  }

  const { data: updatedShares } = await admin
    .from('postit_shares').select('id, user_id, user:users!postit_shares_user_id_fkey(id, full_name, avatar_url)')
    .eq('postit_id', postitId).eq('shared_by_id', user.id)

  // Notify newly added recipients
  await Promise.all(toAdd.map(uid => {
    const { data: sharer } = { data: null } // we already have user in scope via user.id
    return createNotification({
      user_id: uid,
      type: 'postit_shared',
      title: 'Te compartieron un post-it',
      link: '/mi-pizarra',
      dedup_key: `postit_shared_${postitId}_${uid}`,
    }).catch(() => {})
  }))

  return { error: null, shares: updatedShares ?? [] }
}

export async function sendNoteAction(boardOwnerId: string, content: string, color: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const admin = getAdmin()
  const { data: postit, error } = await admin.from('postits').insert({
    board_owner_id: boardOwnerId,
    author_id: user.id,
    content: content.trim(),
    color,
    done: false,
  }).select('id').single()

  if (error) return { error: error.message }

  // Notify recipient
  const { data: me } = await admin.from('users').select('full_name').eq('id', user.id).single()
  await createNotification({
    user_id: boardOwnerId,
    type: 'note_received',
    title: `${(me as any)?.full_name ?? 'Un compañero'} te dejó una nota en tu pizarra`,
    link: '/mi-pizarra',
    dedup_key: `note_received_${postit?.id}`,
  }).catch(() => {})

  return { error: null }
}
