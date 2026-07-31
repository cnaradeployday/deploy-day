'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Pencil, Trash2, ChevronUp, ChevronDown, ShoppingCart, Paperclip } from 'lucide-react'
import ExportExcelButton from '@/components/shared/ExportExcelButton'

type FacturaCompra = {
  id: string
  cuit: string
  numero_factura: string
  fecha_factura: string
  razon_social_proveedor: string
  fecha_pago: string | null
  monto_neto: number
  iva: number
  iibb: number
  otros_impuestos: number
  monto_total: number
  archivo_nombre: string | null
  archivo_path: string | null
  tipo_gasto: { numero: string; nombre: string } | null
}

type SortKey = 'fecha_factura' | 'numero_factura' | 'razon_social_proveedor' | 'monto_total'

export default function FacturasCompraClient({ facturas }: { facturas: FacturaCompra[] }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('fecha_factura')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }
  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronUp size={11} className="opacity-20"/>
    return sortDir === 'asc' ? <ChevronUp size={11}/> : <ChevronDown size={11}/>
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return facturas
    return facturas.filter(f =>
      f.numero_factura.toLowerCase().includes(term) ||
      f.cuit.toLowerCase().includes(term) ||
      f.razon_social_proveedor.toLowerCase().includes(term) ||
      (f.tipo_gasto?.nombre ?? '').toLowerCase().includes(term)
    )
  }, [facturas, q])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const va = a[sortKey], vb = b[sortKey]
    const cmp = typeof va === 'number' ? va - (vb as number) : String(va ?? '').localeCompare(String(vb ?? ''))
    return sortDir === 'asc' ? cmp : -cmp
  }), [filtered, sortKey, sortDir])

  const total = sorted.reduce((s, f) => s + Number(f.monto_total ?? 0), 0)

  async function handleDownload(f: FacturaCompra) {
    if (!f.archivo_path) return
    const sb = createClient()
    const { data } = await sb.storage.from('facturas-compra').createSignedUrl(f.archivo_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleDelete(f: FacturaCompra) {
    setDeletingId(f.id)
    const sb = createClient()
    if (f.archivo_path) await sb.storage.from('facturas-compra').remove([f.archivo_path])
    const { error } = await sb.from('facturas_compra').delete().eq('id', f.id)
    setDeletingId(null)
    if (error) { alert('Error: ' + error.message); return }
    setConfirmId(null)
    router.refresh()
  }

  const exportData = sorted.map(f => ({
    'Fecha factura': new Date(f.fecha_factura).toLocaleDateString('es-AR'),
    'Número': f.numero_factura,
    'CUIT': f.cuit,
    'Razón social proveedor': f.razon_social_proveedor,
    'Fecha de pago': f.fecha_pago ? new Date(f.fecha_pago).toLocaleDateString('es-AR') : '',
    'Monto neto': Number(f.monto_neto),
    'IVA': Number(f.iva),
    'IIBB': Number(f.iibb),
    'Otros impuestos': Number(f.otros_impuestos),
    'Monto total': Number(f.monto_total),
    'Tipo de gasto': f.tipo_gasto ? f.tipo_gasto.numero + ' - ' + f.tipo_gasto.nombre : '',
  }))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {confirmId && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <p className="font-semibold text-gray-900 mb-1">¿Eliminar factura de compra?</p>
            <p className="text-sm text-gray-400 mb-4">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmId(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={() => handleDelete(facturas.find(f => f.id === confirmId)!)} disabled={deletingId === confirmId}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                {deletingId === confirmId ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Link href="/contabilidad" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Contabilidad
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <ShoppingCart size={18} className="text-[#1B9BF0]"/> Facturas de compra
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Comprobantes de proveedores</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportExcelButton data={exportData} filename="facturas_compra"/>
          <Link href="/contabilidad/facturas-compra/nueva"
            className="flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
            <Plus size={15}/> Nueva factura
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex flex-wrap gap-3 items-center">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por número, CUIT, proveedor o tipo de gasto..."
          className="flex-1 min-w-[240px] px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        <span className="text-xs text-gray-400">{sorted.length} factura{sorted.length !== 1 ? 's' : ''} · Total {total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</span>
      </div>

      {!sorted.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          <ShoppingCart size={32} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">Sin facturas de compra</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                {([
                  { key: 'fecha_factura', label: 'Fecha' },
                  { key: 'numero_factura', label: 'Número' },
                  { key: 'razon_social_proveedor', label: 'Proveedor' },
                ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
                  <th key={key} onClick={() => toggleSort(key)}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap cursor-pointer hover:text-gray-600 select-none">
                    <div className="flex items-center gap-1">{label}<SortIcon k={key}/></div>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">CUIT</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap">Tipo de gasto</th>
                <th onClick={() => toggleSort('monto_total')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap cursor-pointer hover:text-gray-600 select-none">
                  <div className="flex items-center gap-1">Monto total<SortIcon k="monto_total"/></div>
                </th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody>
              {sorted.map(f => (
                <tr key={f.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(f.fecha_factura).toLocaleDateString('es-AR')}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{f.numero_factura}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{f.razon_social_proveedor}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{f.cuit}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{f.tipo_gasto ? f.tipo_gasto.numero + ' - ' + f.tipo_gasto.nombre : '—'}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                    {Number(f.monto_total).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {f.archivo_path && (
                      <button onClick={() => handleDownload(f)} title="Ver adjunto"
                        className="p-1.5 rounded-lg text-gray-300 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
                        <Paperclip size={13}/>
                      </button>
                    )}
                    <Link href={'/contabilidad/facturas-compra/' + f.id + '/editar'}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all inline-flex">
                      <Pencil size={13}/>
                    </Link>
                    <button onClick={() => setConfirmId(f.id)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all">
                      <Trash2 size={13}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
