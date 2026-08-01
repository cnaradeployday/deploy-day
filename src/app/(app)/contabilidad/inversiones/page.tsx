import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, PiggyBank, LineChart } from 'lucide-react'

export default async function InversionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const disponibles = [
    { href: '/contabilidad/inversiones/plazo-fijo', label: 'Plazo fijo', desc: 'Próximamente', icon: PiggyBank, color: 'bg-emerald-50' },
    { href: '/contabilidad/inversiones/fondo-comun', label: 'Fondo Común de Inversión', desc: 'Suscripciones, rescates y TC de cierre mensual', icon: LineChart, color: 'bg-sky-50' },
  ]

  return (
    <div className="p-6 w-full">
      <Link href="/contabilidad" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Contabilidad
      </Link>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Inversiones</h1>
        <p className="text-sm text-gray-400 mt-0.5">Plazo fijo y Fondo Común de Inversión</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
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
