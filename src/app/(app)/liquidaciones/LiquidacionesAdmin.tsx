'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Download, DollarSign, Clock, RefreshCw, X } from 'lucide-react'

const estadoColors: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-500',
  confirmado_colaborador: 'bg-blue-50 text-blue-600',
  aprobado_gerente: 'bg-amber-50 text-amber-600',
  factura_subida: 'bg-purple-50 text-purple-600',
  pagado: 'bg-green-50 text-green-600',
}
const estadoLabels: Record<string, string> = {
  borrador: 'Borrador',
  confirmado_colaborador: 'Confirmado por colaborador',
  aprobado_gerente: 'Aprobado',
  factura_subida: 'Factura recibida',
  pagado: 'Pagado',
}

export default function LiquidacionesAdmin({ liquidaciones, userRole, currentUserId }: {
  liquidaciones: any[]
  userRole: string
  currentUserId: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [notas, setNotas] = useState<Record<string, string>>({})
  const [selectedMes, setSelectedMes] = useState(new Date().toISOString().slice(0, 7))
  const isAdmin = userRole === 'admin'

  const confirmadas = liquidaciones.filter(l => l.estado === 'confirmado_colaborador')
  const conFactura = liquidaciones.filter(l => l.estado === 'factura_subida')
  const resto = liquidaciones.filter(l => !['confirmado_colaborador', 'factura_subida'].includes(l.estado))

  async function generarLiquidaciones() {
    setGenerating(true)
    const sb = createClient()
    const { data, error } = await sb.rpc('generar_liquidaciones', { p_mes: selectedMes })
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
    if (!confirm('¿Marcar como pagado?')) return
    setLoading(id)
    await createClient().from('liquidaciones').update({
      estado: 'pagado',
      pagado_at: new Date().toISOString(),
      pagado_by: currentUserId,
    }).eq('id', id)
    router.refresh()
    setLoading(null)
  }

  async function descargarFactura(factura_url: string, nombre: string) {
    const sb = createClient()
    const { data } = await sb.storage.from('facturas').download(factura_url)
    if (!data) return
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url; a.download = nombre; a.click()
    URL.revokeObjectURL(url)
  }

  const LiqCard = ({ liq }: { liq: any }) => (
    <div key={liq.id} className={'bg-white rounded-2xl border p-5 ' + (liq.estado === 'confirmado_colaborador' ? 'border-blue-200' : liq.estado === 'factura_subida' ? 'border-purple-200' : 'border-gray-100')}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-gray-900">{(liq.user as any)?.full_name}</p>
          <p className="text-sm text-gray-400">{liq.mes.slice(0,4)} · {new Date(liq.mes + '-01').toLocaleString('es-AR', { month: 'long' })}</p>
        </div>
        <span className={'text-xs px-2.5 py-1 rounded-full ' + estadoColors[liq.estado]}>{estadoLabels[liq.estado]}</span>
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
        <span className="flex items-center gap-1"><Clock size={13}/> {liq.total_horas}h</span>
        <span className="flex items-center gap-1"><DollarSign size={13}/> ${liq.valor_hora}/h</span>
        <span className="font-semibold text-gray-900">${Number(liq.monto_total).toLocaleString()}</span>
      </div>

      {liq.estado === 'confirmado_colaborador' && (
        <div className="space-y-2">
          <textarea value={notas[liq.id] ?? ''} onChange={e => setNotas(n => ({ ...n, [liq.id]: e.target.value }))}
            placeholder="Nota opcional para el colaborador..."
            rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] resize-none"/>
          <div className="flex gap-2">
            <button onClick={() => rechazar(liq.id)} disabled={loading === liq.id}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-red-200 text-red-500 rounded-xl text-xs hover:bg-red-50 disabled:opacity-50">
              <X size={13}/> Rechazar
            </button>
            <button onClick={() => aprobar(liq.id)} disabled={loading === liq.id}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#1B9BF0] text-white rounded-xl text-xs font-semibold hover:bg-[#0F7ACC] disabled:opacity-50">
              <CheckCircle size={13}/> Aprobar
            </button>
          </div>
        </div>
      )}

      {liq.estado === 'factura_subida' && isAdmin && (
        <div className="flex gap-2">
          <button onClick={() => descargarFactura(liq.factura_url, liq.factura_nombre)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs hover:bg-gray-50">
            <Download size={13}/> Descargar factura
          </button>
          <button onClick={() => marcarPagado(liq.id)} disabled={loading === liq.id}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 text-white rounded-xl text-xs font-semibold hover:bg-green-700 disabled:opacity-50">
            <CheckCircle size={13}/> Marcar pagado
          </button>
        </div>
      )}

      {liq.factura_url && liq.estado !== 'factura_subida' && (
        <button onClick={() => descargarFactura(liq.factura_url, liq.factura_nombre)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
          <Download size={12}/> {liq.factura_nombre}
        </button>
      )}
    </div>
  )

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Liquidaciones</h1>
          <p className="text-sm text-gray-400 mt-0.5">{confirmadas.length} pendientes de aprobación · {conFactura.length} facturas recibidas</p>
        </div>
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

      {confirmadas.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-blue-600 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400"/> Pendientes de aprobación ({confirmadas.length})
          </h2>
          <div className="space-y-3">{confirmadas.map(l => <LiqCard key={l.id} liq={l}/>)}</div>
        </div>
      )}

      {conFactura.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-purple-600 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400"/> Facturas recibidas ({conFactura.length})
          </h2>
          <div className="space-y-3">{conFactura.map(l => <LiqCard key={l.id} liq={l}/>)}</div>
        </div>
      )}

      {resto.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 mb-3">Historial</h2>
          <div className="space-y-3">{resto.map(l => <LiqCard key={l.id} liq={l}/>)}</div>
        </div>
      )}

      {!liquidaciones.length && (
        <div className="text-center py-16 text-gray-400">
          <Clock size={32} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">Sin liquidaciones. Generá una para el mes actual.</p>
        </div>
      )}
    </div>
  )
}
