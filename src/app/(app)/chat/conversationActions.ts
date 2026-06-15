'use server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function admin() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function findOrCreateDM(myId: string, targetId: string): Promise<{ id: string } | { error: string }> {
  const db = admin()
  // Find existing direct conversation between the two users
  const { data: myRows } = await db.from('conversation_members').select('conversation_id').eq('user_id', myId)
  const myIds = (myRows ?? []).map((r: any) => r.conversation_id)

  if (myIds.length > 0) {
    const { data: shared } = await db.from('conversation_members')
      .select('conversation_id').eq('user_id', targetId).in('conversation_id', myIds)
    for (const row of (shared ?? []) as any[]) {
      const { data: conv } = await db.from('conversations').select('type').eq('id', row.conversation_id).single()
      if ((conv as any)?.type === 'direct') return { id: row.conversation_id }
    }
  }

  // Create new DM
  const { data: newConv, error } = await db.from('conversations')
    .insert({ type: 'direct', created_by: myId }).select('id').single()
  if (error || !newConv) return { error: error?.message ?? 'Error creando conversación' }

  await db.from('conversation_members').insert([
    { conversation_id: (newConv as any).id, user_id: myId },
    { conversation_id: (newConv as any).id, user_id: targetId },
  ])
  return { id: (newConv as any).id }
}

export async function createGroupConversation(
  name: string, memberIds: string[], createdBy: string
): Promise<{ id: string } | { error: string }> {
  const db = admin()
  const { data: newConv, error } = await db.from('conversations')
    .insert({ type: 'group', name, created_by: createdBy }).select('id').single()
  if (error || !newConv) return { error: error?.message ?? 'Error creando grupo' }

  const allMembers = [...new Set([createdBy, ...memberIds])]
  await db.from('conversation_members').insert(
    allMembers.map(uid => ({ conversation_id: (newConv as any).id, user_id: uid }))
  )
  return { id: (newConv as any).id }
}
