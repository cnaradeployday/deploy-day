import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MisHorasClient from './MisHorasClient'

export default async function MisHorasPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const mesActual = new Date().toISOString().slice(0, 7)
  const mes = sp.mes ?? mesActual

  const { data: entries } = await supabase
    .from('time_entries')
    .select(`
      id, hours_logged, entry_date, notes,
      task:tasks(id, title, status, project:projects(name, client:clients(name)))
    `)
    .eq('user_id', user.id)
    .gte('entry_date', mes + '-01')
    .lte('entry_date', mes + '-31')
    .order('entry_date', { ascending: false })

  const { data: liquidacion } = await supabase
    .from('liquidaciones')
    .select('estado')
    .eq('user_id', user.id)
    .eq('mes', mes)
    .single()

  const estadoLiq = liquidacion?.estado ?? null

  return (
    <MisHorasClient
      entries={entries ?? []}
      mes={mes}
      mesActual={mesActual}
      estadoLiquidacion={estadoLiq}
    />
  )
}
