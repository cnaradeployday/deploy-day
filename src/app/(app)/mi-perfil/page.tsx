import { createClient } from '@/lib/supabase/server'
import MiPerfilClient from './MiPerfilClient'

export default async function MiPerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users')
    .select(`id, full_name, nickname, avatar_url, role, email,
      whatsapp_phone, whatsapp_country_code, whatsapp_enabled, whatsapp_consent, whatsapp_notification_types`)
    .eq('id', user?.id ?? '')
    .single()

  return (
    <MiPerfilClient
      userId={user?.id ?? ''}
      initialName={profile?.full_name ?? ''}
      initialNickname={profile?.nickname ?? ''}
      initialAvatarUrl={profile?.avatar_url ?? null}
      email={profile?.email ?? user?.email ?? ''}
      initialWhatsapp={{
        phone: profile?.whatsapp_phone ?? '',
        countryCode: profile?.whatsapp_country_code ?? '+54',
        enabled: profile?.whatsapp_enabled ?? false,
        consent: profile?.whatsapp_consent ?? false,
        types: profile?.whatsapp_notification_types ?? [],
      }}
    />
  )
}
