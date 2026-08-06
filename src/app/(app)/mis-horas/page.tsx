import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MisHorasClient from './MisHorasClient'
import { currentMonthAR, monthBounds } from '@/lib/utils/date'

export default async function MisHorasPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const mesActual = currentMonthAR()
  const mes = sp.mes ?? mesActual
  const filterTarea = sp.tarea ?? ''
  const filterCliente = sp.cliente ?? ''

  const { primerDia: desde, ultimoDia: hasta } = monthBounds(mes)

  const { data: entries } = await supabase
    .from('time_entries')
    .select('id, hours_logged, entry_date, notes, task:tasks(id, title, status, project:projects(name, client:clients(name)))')
    .eq('user_id', user.id)
    .gte('entry_date', desde)
    .lte('entry_date', hasta)
    .order('entry_date', { ascending: false })

  const { data: liquidacion } = await supabase
    .from('liquidaciones')
    .select('estado')
    .eq('user_id', user.id)
    .eq('mes', mes)
    .maybeSingle()

  return (
    <MisHorasClient
      entries={entries ?? []}
      mes={mes}
      mesActual={mesActual}
      estadoLiquidacion={liquidacion?.estado ?? null}
      filterTarea={filterTarea}
      filterCliente={filterCliente}
    />
  )
}
