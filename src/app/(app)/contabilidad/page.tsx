import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileText, Users, TrendingUp, ShoppingCart, Landmark, CreditCard, ListTree, Link2 } from 'lucide-react'

export default async function ContabilidadPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const disponibles = [
    { href: '/contabilidad/subdiario-iva', label: 'Subdiario de IVA', desc: 'Débito fiscal por factura SAS', icon: FileText, color: 'bg-blue-50' },
    { href: '/contabilidad/subdiario-clientes', label: 'Subdiario de Cliente', desc: 'Importe total y estado de cobro', icon: Users, color: 'bg-amber-50' },
    { href: '/contabilidad/subdiario-ingresos', label: 'Subdiario de Ingresos', desc: 'Importe neto y estado de cobro', icon: TrendingUp, color: 'bg-green-50' },
    { href: '/contabilidad/facturas-compra', label: 'Factura de compra', desc: 'Comprobantes de proveedores', icon: ShoppingCart, color: 'bg-purple-50' },
    { href: '/contabilidad/tipos-gasto', label: 'Tipos de gasto', desc: 'Plan de cuentas para clasificar gastos', icon: ListTree, color: 'bg-pink-50' },
    { href: '/contabilidad/conciliacion-bancaria', label: 'Conciliación bancaria', desc: 'Movimientos de cuenta y clasificación', icon: Landmark, color: 'bg-cyan-50' },
    { href: '/contabilidad/extractos-bancarios', label: 'Extractos bancarios', desc: 'ABM de descripción ↔ clasificación', icon: Link2, color: 'bg-indigo-50' },
    { href: '/contabilidad/tarjeta-credito', label: 'Tarjeta de crédito', desc: 'Resumen de consumos por tarjeta', icon: CreditCard, color: 'bg-orange-50' },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Contabilidad</h1>
        <p className="text-sm text-gray-400 mt-0.5">Subdiarios, compras, conciliación bancaria y tarjeta de crédito</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {disponibles.map(({ href, label, desc, icon: Icon, color }) => (
          <Link key={href} href={href} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all">
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
              <Icon size={18} className="text-gray-700"/>
            </div>
            <p className="text-sm font-semibold text-gray-900">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
