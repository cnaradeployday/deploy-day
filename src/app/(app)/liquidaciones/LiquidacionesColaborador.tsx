'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Upload, FileText, Clock, DollarSign } from 'lucide-react'
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
  liquidaciones: any[]
  userId: string
  profile: any
  tab: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [editBanco, setEditBanco] = useState<string | null>(null)
  const [bancoForm, setBancoForm] = useState({ banco: profile.banco ?? '', cbu: profile.cbu ?? '', cuenta_nombre: profile.cuenta_nombre ?? profile.full_name ?? '' })

  const TABS = [
    { key: 'mis-liquidaciones', label: 'Mis liquidaciones' },
  ]

  async function confirmar(id: string) {
    if (!confirm('Confirmás que las horas de este mes son correctas?')) return
    setLoading(id)
    await createClient().from('liquidaciones').update({
      estado: 'confirmado_colaborador',
      confirmado_at: new Date().toISOString()
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
      estado: 'factura_subida', factura_url: path,
      factura_nombre: file.name, factura_subida_at: new Date().toISOString()
    }).eq('id', id)
    router.refresh()
    setUploading(null)
  }

  async function guardarBanco(liqId: string) {
    const sb = createClient()
    await sb.from('users').update(bancoForm).eq('id', userId)
    setEditBanco(null)
    router.refresh()
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Mis liquidaciones</h1>
        <Link href="/mis-horas" className="text-sm text-[#1B9BF0] hover:underline">Ver mis horas →</Link>
      </div>

      {!liquidaciones.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          <Clock size={32} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">Sin liquidaciones aún</p>
          <p className="text-xs mt-1">Aparecerán cuando el admin genere tu liquidación mensual</p>
        </div>
      ) : liquidaciones.map(liq => (
        <div key={liq.id} className={'bg-white rounded-2xl border p-5 mb-4 ' + (liq.estado === 'aprobado_gerente' ? 'border-amber-200' : liq.estado === 'pagado' ? 'border-green-200' : 'border-gray-100')}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="font-semibold text-gray-900 capitalize">
                {new Date(liq.mes + '-15').toLocaleString('es-AR', { month: 'long', year: 'numeric' })}
              </p>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Clock size={13}/> {liq.total_horas}h</span>
                <span className="flex items-center gap-1"><DollarSign size={13}/> ${liq.valor_hora}/h</span>
                <span className="font-bold text-gray-900">${Number(liq.monto_total ?? 0).toLocaleString()}</span>
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

          {/* ACCIÓN SEGÚN ESTADO */}
          {liq.estado === 'borrador' && (
            <button onClick={() => confirmar(liq.id)} disabled={loading === liq.id}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1B9BF0] text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              <CheckCircle size={15}/> Confirmar horas del mes
            </button>
          )}

          {liq.estado === 'confirmado_colaborador' && (
            <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-600">
              Horas confirmadas — esperando aprobación del gerente
            </div>
          )}

          {liq.estado === 'aprobado_gerente' && (
            <div className="space-y-3">
              <div className="bg-amber-50 rounded-xl px-4 py-3 text-sm text-amber-700 font-medium">
                ¡Aprobado! Facturá por <strong>${Number(liq.monto_total ?? 0).toLocaleString()}</strong>
              </div>

              {/* Datos bancarios */}
              {editBanco === liq.id ? (
                <div className="space-y-2 border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-600 mb-2">Datos bancarios para el pago</p>
                  {[
                    { key: 'banco', label: 'Banco', placeholder: 'Banco Galicia' },
                    { key: 'cbu', label: 'CBU', placeholder: '0000000000000000000000' },
                    { key: 'cuenta_nombre', label: 'A nombre de', placeholder: profile.full_name },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-400 mb-1">{label}</label>
                      <input type="text" value={(bancoForm as any)[key]}
                        onChange={e => setBancoForm(f => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEditBanco(null)} className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600">Cancelar</button>
                    <button onClick={() => guardarBanco(liq.id)} className="flex-1 py-2 bg-[#1B9BF0] text-white rounded-xl text-sm font-semibold">Guardar</button>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-600">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-700">Datos bancarios</span>
                    <button onClick={() => setEditBanco(liq.id)} className="text-[#1B9BF0] hover:underline">Editar</button>
                  </div>
                  {profile.banco ? (
                    <div className="space-y-0.5">
                      <p>Banco: {profile.banco}</p>
                      <p>CBU: {profile.cbu}</p>
                      <p>A nombre de: {profile.cuenta_nombre}</p>
                    </div>
                  ) : (
                    <p className="text-amber-600">Completá tus datos bancarios antes de subir la factura</p>
                  )}
                </div>
              )}

              <label className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold cursor-pointer transition-all">
                <Upload size={15}/> {uploading === liq.id ? 'Subiendo...' : 'Subir factura (PDF)'}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) subirFactura(liq.id, f) }}
                  disabled={uploading === liq.id}/>
              </label>
            </div>
          )}

          {liq.estado === 'factura_subida' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-purple-600">
                <FileText size={15}/> Factura enviada: {liq.factura_nombre}
              </div>
              <p className="text-xs text-gray-400">Esperando pago del admin</p>
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
  )
}
