'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { CheckCircle, X, Download, RefreshCw, Clock, Building2 } from 'lucide-react'

const estadoColors: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-500',
  confirmado_colaborador: 'bg-blue-50 text-blue-600',
  aprobado_gerente: 'bg-amber-50 text-amber-600',
  factura_subida: 'bg-purple-50 text-purple-600',
  pagado: 'bg-green-50 text-green-600',
}
const estadoLabels: Record<string, string> = {
  borrador: 'En proceso',
  confirmado_colaborador: 'Mes cerrado',
  aprobado_gerente: 'Aprobado',
  factura_subida: 'Factura recibida',
  pagado: 'Pagado',
}

export default function LiquidacionesAdmin({ liquidaciones, allUsers, userRole, currentUserId, tab }: {
  liquidaciones: any[]
  allUsers: any[]
  userRole: string
  currentUserId: string
  tab: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [notas, setNotas] = useState<Record<string, string>>({})
  const [selectedMes, setSelectedMes] = useState(new Date().toISOString().slice(0, 7))
  const isAdmin = userRole === 'admin'

  const TABS = [
    { key: 'resumen', label: 'Resumen equipo' },
    { key: 'contractors', label: 'Servicio contractors' },
  ]

  async function generarLiquidaciones() {
    setGenerating(true)
    const { data, error } = await createClient().rpc('generar_liquidaciones', { p_mes: selectedMes })
    if (error) alert('Error: ' + error.message)
    else alert('Generadas ' + data + ' liquidaciones para ' + selectedMes)
    router.refresh()
    setGenerating(false)
  }

  async function aprobar(id: string) {
    setLoading(id)
    await createClient().from('liquidaciones').update({
      estado: 'aprobado_gerente',
      aprobado_by: currentUserId,
      aprobado_at: new Date().toISOString(),
      notas_gerente: notas[id] ?? null,
    }).eq('id', id)
    router.refresh()
    setLoading(null)
  }

  async function rechazar(id: string) {
    const motivo = prompt('Motivo del rechazo:')
    if (!motivo) return
    setLoading(id)
    await createClient().from('liquidaciones').update({
      estado: 'borrador',
      notas_gerente: 'Rechazado: ' + motivo,
    }).eq('id', id)
    router.refresh()
    setLoading(null)
  }

  async function marcarPagado(id: string) {
    if (!confirm('Marcar como pagado?')) return
    setLoading(id)
    await createClient().from('liquidaciones').update({
      estado: 'pagado',
      pagado_at: new Date().toISOString(),
      pagado_by: currentUserId,
    }).eq('id', id)
    router.refresh()
    setLoading(null)
  }

  async function descargarFactura(url: string, nombre: string) {
    const { data } = await createClient().storage.from('facturas').download(url)
    if (!data) return
    const blobUrl = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = blobUrl; a.download = nombre; a.click()
    URL.revokeObjectURL(blobUrl)
  }

  const liqDelMes = liquidaciones.filter(l => l.mes === selectedMes)
  const pendientesAprobacion = liqDelMes.filter(l => l.estado === 'confirmado_colaborador')
  const conFactura = liquidaciones.filter(l => l.estado === 'factura_subida')

  const nombreMes = (m: string) => new Date(m + '-15').toLocaleString('es-AR', { month: 'long', year: 'numeric' })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Liquidaciones</h1>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <input type="month" value={selectedMes} onChange={e => setSelectedMes(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
            <button onClick={generarLiquidaciones} disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50">
              <RefreshCw size={14} className={generating ? 'animate-spin' : ''}/> Generar
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {TABS.map(t => (
          <Link key={t.key} href={'?tab=' + t.key}
            className={'flex-1 text-center py-2 rounded-lg text-sm font-medium transition-all ' + (tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            {t.label}
            {t.key === 'resumen' && pendientesAprobacion.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{pendientesAprobacion.length}</span>
            )}
            {t.key === 'contractors' && conFactura.length > 0 && (
              <span className="ml-2 bg-purple-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{conFactura.length}</span>
            )}
          </Link>
        ))}
      </div>

      {/* RESUMEN EQUIPO */}
      {tab === 'resumen' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-700 capitalize">{nombreMes(selectedMes)}</p>
          </div>

          {!liqDelMes.length ? (
            <div className="text-center py-12 text-gray-400">
              <Clock size={28} className="mx-auto mb-2 opacity-20"/>
              <p className="text-sm">Sin liquidaciones para este mes. Generá una arriba.</p>
            </div>
          ) : liqDelMes.map(liq => (
            <div key={liq.id} className="border-b border-gray-50 last:border-0 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium text-gray-900">{(liq.user as any)?.full_name}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <span>{liq.total_horas}h</span>
                    <span>${liq.valor_hora}/h</span>
                    <span className="font-semibold text-gray-900">${Number(liq.monto_total ?? 0).toLocaleString()}</span>
                  </div>
                </div>
                <span className={'text-xs px-2.5 py-1 rounded-full ' + (estadoColors[liq.estado] ?? 'bg-gray-100 text-gray-500')}>
                  {estadoLabels[liq.estado] ?? liq.estado}
                </span>
              </div>

              {liq.estado === 'confirmado_colaborador' && (
                <div className="space-y-2">
                  <textarea value={notas[liq.id] ?? ''} onChange={e => setNotas(n => ({ ...n, [liq.id]: e.target.value }))}
                    placeholder="Nota para el colaborador (opcional)" rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] resize-none"/>
                  <div className="flex gap-2">
                    <button onClick={() => rechazar(liq.id)} disabled={loading === liq.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-red-200 text-red-500 rounded-xl text-xs hover:bg-red-50 disabled:opacity-50">
                      <X size={13}/> Rechazar
                    </button>
                    <button onClick={() => aprobar(liq.id)} disabled={loading === liq.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#1B9BF0] text-white rounded-xl text-xs font-semibold disabled:opacity-50">
                      <CheckCircle size={13}/> Aprobar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* SERVICIO CONTRACTORS */}
      {tab === 'contractors' && (
        <div>
          <p className="text-sm text-gray-400 mb-4">Facturas recibidas pendientes de pago</p>
          {!conFactura.length ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
              <Building2 size={32} className="mx-auto mb-3 opacity-20"/>
              <p className="text-sm">Sin facturas recibidas</p>
            </div>
          ) : conFactura.map(liq => {
            const u = liq.user as any
            return (
              <div key={liq.id} className="bg-white rounded-2xl border border-purple-100 p-5 mb-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-semibold text-gray-900">{u?.full_name}</p>
                    <p className="text-xs text-gray-400 capitalize mt-0.5">{nombreMes(liq.mes)}</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-600">Factura recibida</span>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Nombre', value: u?.full_name },
                    { label: 'Horas', value: liq.total_horas + 'h' },
                    { label: 'Valor hora', value: '$' + liq.valor_hora },
                    { label: 'Total', value: '$' + Number(liq.monto_total ?? 0).toLocaleString() },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-xl px-3 py-2.5">
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
                    </div>
                  ))}
                </div>

                {liq.aprobado_at && (
                  <p className="text-xs text-gray-400 mb-3">
                    Aprobado el {new Date(liq.aprobado_at).toLocaleDateString('es-AR')}
                    {liq.aprobado_by && ' por ' + (allUsers.find((u: any) => u.id === liq.aprobado_by)?.full_name ?? '')}
                  </p>
                )}

                {(u?.banco || u?.cbu) && (
                  <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 text-xs text-gray-600 space-y-1">
                    <p className="font-medium text-gray-700 mb-1">Datos bancarios</p>
                    {u?.banco && <p><span className="text-gray-400">Banco:</span> {u.banco}</p>}
                    {u?.cbu && <p><span className="text-gray-400">CBU:</span> {u.cbu}</p>}
                    {u?.cuenta_nombre && <p><span className="text-gray-400">A nombre de:</span> {u.cuenta_nombre}</p>}
                  </div>
                )}

                <div className="flex gap-2">
                  {liq.factura_url && (
                    <button onClick={() => descargarFactura(liq.factura_url, liq.factura_nombre)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
                      <Download size={14}/> Descargar factura
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => marcarPagado(liq.id)} disabled={loading === liq.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                      <CheckCircle size={14}/> Marcar pagado
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
