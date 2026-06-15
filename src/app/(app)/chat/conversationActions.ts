'use server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function admin() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function fetchConversations(userId: string) {
  const db = admin()
  const { data: myRows } = await db.from('conversation_members')
    .select('conversation_id, last_read_at').eq('user_id', userId)
  if (!myRows || myRows.length === 0) return []

  const convIds = (myRows as any[]).map(r => r.conversation_id)
  const readMap = new Map((myRows as any[]).map(r => [r.conversation_id, r.last_read_at]))

  const [{ data: convData }, { data: allMembers }, { data: recentMsgs }] = await Promise.all([
    db.from('conversations').select('id, type, name, last_message_at').in('id', convIds),
    db.from('conversation_members').select('conversation_id, user_id, user:users(id, full_name, avatar_url)').in('conversation_id', convIds),
    db.from('messages').select('conversation_id, content, created_at').in('conversation_id', convIds).order('created_at', { ascending: false }).limit(convIds.length * 5),
  ])

  const membersByConv = new Map<string, any[]>()
  ;(allMembers ?? []).forEach((m: any) => {
    if (!membersByConv.has(m.conversation_id)) membersByConv.set(m.conversation_id, [])
    membersByConv.get(m.conversation_id)!.push({ user_id: m.user_id, user: m.user })
  })

  const lastMsgByConv = new Map<string, any>()
  const msgsByConv = new Map<string, any[]>()
  ;(recentMsgs ?? []).forEach((m: any) => {
    if (!lastMsgByConv.has(m.conversation_id)) lastMsgByConv.set(m.conversation_id, m)
    if (!msgsByConv.has(m.conversation_id)) msgsByConv.set(m.conversation_id, [])
    msgsByConv.get(m.conversation_id)!.push(m)
  })

  return (convData ?? []).map((c: any) => {
    const myLastRead = readMap.get(c.id) ?? '1970-01-01'
    const msgs = msgsByConv.get(c.id) ?? []
    const unread = msgs.filter((m: any) => m.created_at > myLastRead).length
    return {
      id: c.id, type: c.type, name: c.name,
      last_message_at: c.last_message_at,
      myLastRead,
      members: membersByConv.get(c.id) ?? [],
      lastMsg: lastMsgByConv.get(c.id)?.content ?? null,
      unread,
    }
  }).sort((a: any, b: any) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
}

export async function markConversationRead(conversationId: string, userId: string) {
  const db = admin()
  await db.from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId).eq('user_id', userId)
}

export async function updateConversationLastMessage(conversationId: string) {
  const db = admin()
  await db.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId)
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
