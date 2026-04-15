'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Upload, FileText, DollarSign, Clock } from 'lucide-react'
import Link from 'next/link'

const estadoColors: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-500',
  confirmado_colaborador: 'bg-blue-50 text-blue-600',
  aprobado_gerente: 'bg-amber-50 text-amber-600',
  factura_subida: 'bg-purple-50 text-purple-600',
  pagado: 'bg-green-50 text-green-600',
}
const estadoLabels: Record<string, string> = {
  borrador: 'Realizadas',
  confirmado_colaborador: 'Confirmadas',
  aprobado_gerente: 'Aprobado — subí tu factura',
  factura_subida: 'Factura enviada',
  pagado: 'Pagado',
}

export default function LiquidacionesColaborador({ liquidaciones, userId, profile, tab }: {
  liquidaciones: any[]; userId: string; profile: any; tab: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)

  const tabs = [
    { key: 'mis-liquidaciones', label: 'Mis liquidaciones' },
    { key: 'mis-horas-liq', label: 'Mis horas' },
  ]

  async function confirmar(id: string) {
    if (!confirm('Confirmás que las horas son correctas?')) return
    setLoading(id)
    await createClient().from('liquidaciones').update({
      estado: 'confirmado_colaborador', confirmado_at: new Date().toISOString()
    }).eq('id', id)
    router.refresh()
    setLoading(null)
  }

  async function subirFactura(id: string, file: File) {
    setUploading(id)
    const sb = createClient()
    const path = userId + '/' + id + '/' + file.name
    const { error } = await sb.storage.from('facturas').upload(path, file, { upsert: true })
    if (error) { alert('Error: ' + error.message); setUploading(null); return }
    await sb.from('liquidaciones').update({
      estado: 'factura_subida',
      factura_url: path, factura_nombre: file.name,
      factura_subida_at: new Date().toISOString()
    }).eq('id', id)
    router.refresh()
    setUploading(null)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Liquidaciones</h1>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {tabs.map(t => (
          <Link key={t.key} href={'?tab=' + t.key}
            className={'flex-1 text-center py-2 rounded-lg text-sm font-medium transition-all ' + (tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            {t.label}
          </Link>
        ))}
      </div>

      {tab === 'mis-liquidaciones' && (
        <div className="space-y-4">
          {!liquidaciones.length ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
              <Clock size={32} className="mx-auto mb-3 opacity-20"/>
              <p className="text-sm">Sin liquidaciones aún</p>
            </div>
          ) : liquidaciones.map(liq => (
            <div key={liq.id} className={'bg-white rounded-2xl border p-5 ' + (liq.estado === 'aprobado_gerente' ? 'border-amber-200' : liq.estado === 'pagado' ? 'border-green-200' : 'border-gray-100')}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-semibold text-gray-900 capitalize">
                    {new Date(liq.mes + '-15').toLocaleString('es-AR', { month: 'long', year: 'numeric' })}
                  </p>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><Clock size={13}/> {liq.total_horas}h</span>
                    <span className="flex items-center gap-1"><DollarSign size={13}/> ${liq.valor_hora}/h</span>
                    <span className="font-semibold text-gray-900">${Number(liq.monto_total ?? 0).toLocaleString()}</span>
                  </div>
                </div>
                <span className={'text-xs px-2.5 py-1 rounded-full ' + (estadoColors[liq.estado] ?? 'bg-gray-100 text-gray-500')}>
                  {estadoLabels[liq.estado] ?? liq.estado}
                </span>
              </div>

              {liq.notas_gerente && (
                <div className="bg-amber-50 rounded-xl px-4 py-2.5 mb-4 text-sm text-amber-700">
                  <span className="font-medium">Nota: </span>{liq.notas_gerente}
                </div>
              )}

              {liq.estado === 'borrador' && (
                <button onClick={() => confirmar(liq.id)} disabled={loading === liq.id}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1B9BF0] text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                  <CheckCircle size={15}/> Confirmar horas
                </button>
              )}

              {liq.estado === 'aprobado_gerente' && (
                <div>
                  <p className="text-sm text-amber-700 font-medium mb-3">
                    Aprobado — Facturá por ${Number(liq.monto_total ?? 0).toLocaleString()}
                  </p>
                  <label className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold cursor-pointer">
                    <Upload size={15}/> {uploading === liq.id ? 'Subiendo...' : 'Subir factura (PDF)'}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) subirFactura(liq.id, f) }}
                      disabled={uploading === liq.id}/>
                  </label>
                </div>
              )}

              {liq.estado === 'factura_subida' && (
                <div className="flex items-center gap-2 text-sm text-purple-600">
                  <FileText size={15}/> Factura enviada — esperando pago
                </div>
              )}

              {liq.estado === 'pagado' && (
                <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                  <CheckCircle size={15}/> Pagado {liq.pagado_at ? 'el ' + new Date(liq.pagado_at).toLocaleDateString('es-AR') : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'mis-horas-liq' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-gray-400">
          <p className="text-sm mb-2">Ver detalle de horas por mes</p>
          <Link href="/mis-horas" className="text-[#1B9BF0] text-sm underline">Ir a Mis horas →</Link>
        </div>
      )}
    </div>
  )
}
