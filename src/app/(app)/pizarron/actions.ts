'use server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/app/(app)/novedades/actions'
import { revalidatePath } from 'next/cache'

function getAdmin() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function createPizarronPostAction(
  content: string | null,
  imageUrl: string | null,
  color: string
): Promise<{ data: any; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autorizado' }

  const admin = getAdmin()
  const { data: post, error } = await admin.from('tablero_posts').insert({
    author_id: user.id, content, image_url: imageUrl,
  }).select('id, content, image_url, created_at, author_id, author:users!tablero_posts_author_id_fkey(id, full_name, avatar_url)').single()

  if (error) return { data: null, error: error.message }

  // Notify all active users except the author
  const { data: me } = await admin.from('users').select('full_name').eq('id', user.id).single()
  const { data: allUsers } = await admin.from('users').select('id').eq('is_active', true).neq('id', user.id)

  await Promise.all((allUsers ?? []).map((u: any) =>
    createNotification({
      user_id: u.id,
      type: 'pizarron_new_post',
      title: `${(me as any)?.full_name ?? 'Un compañero'} publicó algo en el Pizarrón`,
      body: content ? content.slice(0, 80) + (content.length > 80 ? '...' : '') : undefined,
      link: '/pizarron',
      dedup_key: `pizarron_${post.id}_${u.id}`,
    }).catch(() => {})
  ))

  revalidatePath('/pizarron')
  return { data: post, error: null }
}
