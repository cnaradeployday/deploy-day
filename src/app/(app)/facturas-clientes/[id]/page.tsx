import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import FacturaClienteActions from './FacturaClienteActions'

export default async function FacturaClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: f } = await supabase
    .from('facturas_clientes')
    .select('*, client:clients(name), project:projects(name)')
    .eq('id', id).single()
  if (!f) notFound()

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link href="/facturas-clientes" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Facturas
      </Link>
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs text-gray-400 mb-1">{(f.client as any)?.name}</p>
            <h1 className="text-2xl font-bold text-gray-900">{f.numero}</h1>
          </div>
          <span className={'text-sm px-3 py-1 rounded-full ' + (f.estado === 'cobrada' ? 'bg-green-50 text-green-600' : f.estado === 'vencida' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600')}>
            {f.estado}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[
            { label: 'Cliente', value: (f.client as any)?.name },
            { label: 'Proyecto', value: (f.project as any)?.name ?? '—' },
            { label: 'Emisión', value: new Date(f.fecha_emision).toLocaleDateString('es-AR') },
            { label: 'Vencimiento', value: new Date(f.fecha_vencimiento).toLocaleDateString('es-AR') },
            { label: 'Importe', value: '$' + Number(f.importe).toLocaleString() },
            { label: 'Cobro', value: f.fecha_cobro ? new Date(f.fecha_cobro).toLocaleDateString('es-AR') : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="border border-gray-100 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
        {f.notas && <p className="text-sm text-gray-500 mb-6 bg-gray-50 rounded-xl px-4 py-3">{f.notas}</p>}
        <FacturaClienteActions facturaId={f.id} estado={f.estado} />
      </div>
    </div>
  )
}
