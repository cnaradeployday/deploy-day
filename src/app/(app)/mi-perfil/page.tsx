import { createClient } from '@/lib/supabase/server'
import MiPerfilClient from './MiPerfilClient'

export default async function MiPerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, nickname, avatar_url, role, email')
    .eq('id', user?.id ?? '')
    .single()

  return (
    <MiPerfilClient
      userId={user?.id ?? ''}
      initialName={profile?.full_name ?? ''}
      initialNickname={profile?.nickname ?? ''}
      initialAvatarUrl={profile?.avatar_url ?? null}
      email={profile?.email ?? user?.email ?? ''}
    />
  )
}
