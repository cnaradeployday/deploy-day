import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { checkComputedNotifications, fetchNotifications, markAllNotificationsRead } from './actions'
import NovedadesClient from './NovedadesClient'

export default async function NovedadesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Run computed checks and fetch all notifications
  await checkComputedNotifications()
  const { data: notifications } = await fetchNotifications()

  // Mark all as read on page visit
  await markAllNotificationsRead()

  return <NovedadesClient initialNotifications={notifications} />
}
