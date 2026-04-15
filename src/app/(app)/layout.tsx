import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  return (
    <AppLayout
      userRole={profile?.role ?? 'colaborador'}
      userName={profile?.full_name ?? ''}
      userId={user.id}
    >
      {children}
    </AppLayout>
  )
}
