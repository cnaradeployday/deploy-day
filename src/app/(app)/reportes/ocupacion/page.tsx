import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import OcupacionChart from './OcupacionChart'

export default async function ReporteOcupacionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (!['admin', 'gerente_operaciones'].includes(profile?.role ?? '')) redirect('/dashboard')

  const { data: entries } = await supabase
    .from('time_entries')
    .select('hours_logged, entry_date, user:users(id, full_name)')
    .order('entry_date', { ascending: true })

  const userMap: Record<string, { name: string; total: number; byMonth: Record<string, number> }> = {}
  entries?.forEach(e => {
    const uid = (e.user as any)?.id
    const name = (e.user as any)?.full_name ?? 'Desconocido'
    const month = e.entry_date.slice(0, 7)
    if (!userMap[uid]) userMap[uid] = { name, total: 0, byMonth: {} }
    userMap[uid].total += e.hours_logged
    userMap[uid].byMonth[month] = (userMap[uid].byMonth[month] ?? 0) + e.hours_logged
  })

  const months = [...new Set(entries?.map(e => e.entry_date.slice(0, 7)) ?? [])].sort().slice(-6)
  const chartData = months.map(m => {
    const row: Record<string, any> = { month: m.slice(5) + '/' + m.slice(0, 4) }
    Object.values(userMap).forEach(u => { row[u.name] = Math.round((u.byMonth[m] ?? 0) * 10) / 10 })
    return row
  })

  const users = Object.values(userMap).sort((a, b) => b.total - a.total)
  const COLORS = ['#1f2937','#6b7280','#93c5fd','#bbf7d0','#fde68a','#fca5a5','#e9d5ff','#fed7aa']

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/reportes" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Reportes
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Ocupación del equipo</h1>
      <OcupacionChart chartData={chartData} users={users} colors={COLORS} />
    </div>
  )
}
