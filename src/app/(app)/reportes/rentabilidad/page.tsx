import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ReportFilters from '@/components/reportes/ReportFilters'

export default async function RentabilidadPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const sp = await searchParams
  const { from, to, cliente, proyecto } = sp

  const { data: clientes } = await supabase.from('clients').select('id, name').order('name')
  const { data: proyectosAll } = await supabase.from('projects').select('id, name, client_id, sold_hours, price_per_hour, client:clients(name)').order('name')

  const proyectosFiltrados = cliente ? proyectosAll?.filter(p => p.client_id === cliente) : proyectosAll
  const proyectosTarget = proyecto ? proyectosFiltrados?.filter(p => p.id === proyecto) : proyectosFiltrados

  let entriesQuery = supabase.from('time_entries').select('hours_logged, entry_date, task:tasks(project_id), user:users(hourly_cost)')
  if (from) entriesQuery = entriesQuery.gte('entry_date', from)
  if (to) entriesQuery = entriesQuery.lte('entry_date', to)
  const { data: entries } = await entriesQuery

  const data = proyectosTarget?.map(p => {
    const revenue = (p.sold_hours ?? 0) * (p.price_per_hour ?? 0)
    const cost = entries?.filter(e => (e.task as any)?.project_id === p.id)
      .reduce((s, e) => s + e.hours_logged * ((e.user as any)?.hourly_cost ?? 0), 0) ?? 0
    const profit = revenue - cost
    const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : null
    return { name: p.name, client: (p.client as any)?.name, revenue, cost: Math.round(cost), profit: Math.round(profit), margin }
  }).sort((a, b) => b.profit - a.profit) ?? []

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0)
  const totalCost = data.reduce((s, d) => s + d.cost, 0)
  const totalProfit = totalRevenue - totalCost

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/reportes" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Reportes
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Rentabilidad</h1>
      <ReportFilters
        clientes={clientes?.map(c => ({ value: c.id, label: c.name })) ?? []}
        proyectos={proyectosFiltrados?.map(p => ({ value: p.id, label: p.name })) ?? []}
        showDateRange={true}
      />

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Ingresos', value: `$${totalRevenue.toLocaleString()}` },
          { label: 'Costos', value: `$${totalCost.toLocaleString()}` },
          { label: 'Ganancia bruta', value: `$${totalProfit.toLocaleString()}`, highlight: true },
        ].map(({ label, value, highlight }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 px-4 py-4">
            <p className="text-xs text-gray-400">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${highlight ? totalProfit >= 0 ? 'text-green-600' : 'text-red-500' : 'text-gray-900'}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-5 px-5 py-3 text-xs font-medium text-gray-400 border-b border-gray-50">
          <span className="col-span-2">Proyecto</span>
          <span>Ingresos</span><span>Costos</span><span>Margen</span>
        </div>
        {!data.length ? (
          <p className="text-sm text-gray-400 text-center py-10">Sin datos para los filtros seleccionados</p>
        ) : data.map((d, i) => (
          <div key={i} className="grid grid-cols-5 px-5 py-3.5 text-sm border-b border-gray-50 last:border-0 hover:bg-gray-50">
            <div className="col-span-2">
              <p className="font-medium text-gray-900 truncate">{d.name}</p>
              <p className="text-xs text-gray-400">{d.client}</p>
            </div>
            <span className="text-gray-700">${d.revenue.toLocaleString()}</span>
            <span className="text-gray-700">${d.cost.toLocaleString()}</span>
            <span className={`font-medium ${d.margin !== null ? d.margin >= 30 ? 'text-green-600' : d.margin >= 0 ? 'text-amber-500' : 'text-red-500' : 'text-gray-400'}`}>
              {d.margin !== null ? `${d.margin}%` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
