import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, PiggyBank } from 'lucide-react'

export default async function PlazoFijoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <div className="p-6 w-full">
      <Link href="/contabilidad/inversiones" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Inversiones
      </Link>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <PiggyBank size={18} className="text-[#1B9BF0]"/> Plazo fijo
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Próximamente</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
        <PiggyBank size={32} className="mx-auto mb-3 opacity-20"/>
        <p className="text-sm">Todavía no hay nada cargado en esta sección</p>
      </div>
    </div>
  )
}
