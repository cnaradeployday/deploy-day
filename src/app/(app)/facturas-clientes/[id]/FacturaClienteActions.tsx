'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle } from 'lucide-react'

export default function FacturaClienteActions({ facturaId, estado }: { facturaId: string; estado: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [fechaCobro, setFechaCobro] = useState(new Date().toISOString().split('T')[0])

  async function marcarCobrada() {
    if (!confirm('Marcar como cobrada?')) return
    setLoading(true)
    await createClient().from('facturas_clientes').update({ estado: 'cobrada', fecha_cobro: fechaCobro }).eq('id', facturaId)
    router.refresh()
    setLoading(false)
  }

  async function marcarVencida() {
    setLoading(true)
    await createClient().from('facturas_clientes').update({ estado: 'vencida' }).eq('id', facturaId)
    router.refresh()
    setLoading(false)
  }

  if (estado === 'cobrada') return (
    <div className="flex items-center gap-2 text-green-600 font-medium">
      <CheckCircle size={16}/> Factura cobrada
    </div>
  )

  return (
    <div className="space-y-3">
      {estado === 'pendiente' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha de cobro</label>
            <input type="date" value={fechaCobro} onChange={e => setFechaCobro(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
          <div className="flex gap-2">
            <button onClick={marcarVencida} disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-red-200 text-red-500 rounded-xl text-sm hover:bg-red-50 disabled:opacity-50">
              <XCircle size={14}/> Marcar vencida
            </button>
            <button onClick={marcarCobrada} disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
              <CheckCircle size={14}/> Marcar cobrada
            </button>
          </div>
        </>
      )}
      {estado === 'vencida' && (
        <div className="flex gap-2">
          <button onClick={marcarCobrada} disabled={loading}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
            <CheckCircle size={14}/> Marcar cobrada igual
          </button>
        </div>
      )}
    </div>
  )
}
