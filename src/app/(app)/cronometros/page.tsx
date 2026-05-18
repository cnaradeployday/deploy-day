import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CronometrosClient from './CronometrosClient'

export default async function CronometrosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'gerente_operaciones'].includes(profile?.role ?? '')) {
    redirect('/dashboard')
  }

  return <CronometrosClient />
}
