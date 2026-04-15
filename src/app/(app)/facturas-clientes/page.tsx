import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, FileText, CheckCircle, AlertCircle } from 'lucide-react'

export default async function FacturasClientesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: facturas } = await supabase
    .from('facturas_clientes')
    .select('*, client:clients(name), project:projects(name)')
    .order('fecha_vencimiento', { ascending: true })

  const pendientes = facturas?.filter(f => f.estado === 'pendiente') ?? []
  const cobradas = facturas?.filter(f => f.estado === 'cobrada') ?? []
  const vencidas = facturas?.filter(f => f.estado === 'vencida') ?? []

  const totalPendiente = pendientes.reduce((s, f) => s + f.importe, 0)

  const estadoColors: Record<string, string> = {
    pendiente: 'bg-amber-50 text-amber-600',
    cobrada: 'bg-green-50 text-green-600',
    vencida: 'bg-red-50 text-red-600',
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Facturas a clientes</h1>
          <p className="text-sm text-gray-400 mt-0.5">${totalPendiente.toLocaleString()} pendiente de cobro</p>
        </div>
        <Link href="/facturas-clientes/nueva"
          className="flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
          <Plus size={15}/> Nueva factura
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Pendientes', value: pendientes.length, amount: totalPendiente, color: 'text-amber-600' },
          { label: 'Cobradas', value: cobradas.length, amount: cobradas.reduce((s,f) => s+f.importe, 0), color: 'text-green-600' },
          { label: 'Vencidas', value: vencidas.length, amount: vencidas.reduce((s,f) => s+f.importe, 0), color: 'text-red-500' },
        ].map(({ label, value, amount, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 px-4 py-4">
            <p className="text-xs text-gray-400">{label}</p>
            <p className={'text-2xl font-bold ' + color}>{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">${amount.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {!facturas?.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          <FileText size={32} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">Sin facturas aún</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                {['Número','Cliente','Proyecto','Emisión','Vencimiento','Importe','Estado','Cobro'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facturas.map(f => (
                <tr key={f.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={'/facturas-clientes/' + f.id} className="text-sm font-medium text-[#1B9BF0] hover:underline">{f.numero}</Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{(f.client as any)?.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{(f.project as any)?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(f.fecha_emision).toLocaleDateString('es-AR')}</td>
                  <td className={'px-4 py-3 text-xs font-medium ' + (f.estado === 'pendiente' && new Date(f.fecha_vencimiento) < new Date() ? 'text-red-500' : 'text-gray-500')}>
                    {new Date(f.fecha_vencimiento).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">${Number(f.importe).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={'text-xs px-2 py-0.5 rounded-full ' + estadoColors[f.estado]}>{f.estado}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{f.fecha_cobro ? new Date(f.fecha_cobro).toLocaleDateString('es-AR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
