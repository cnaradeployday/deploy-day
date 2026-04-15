import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import EditarUsuarioClient from './EditarUsuarioClient'

export default async function EditarUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: miembro } = await supabase.from('users').select('*').eq('id', id).single()
  if (!miembro) notFound()

  const { data: historial } = await supabase
    .from('user_rate_history')
    .select('*')
    .eq('user_id', id)
    .order('created_at', { ascending: false })

  const { data: availability } = await supabase
    .from('user_availability')
    .select('*')
    .eq('user_id', id)
    .order('desde', { ascending: true })

  return (
    <EditarUsuarioClient
      miembro={miembro}
      historial={historial ?? []}
      adminId={user?.id ?? ''}
      availability={availability ?? []}
    />
  )
}
