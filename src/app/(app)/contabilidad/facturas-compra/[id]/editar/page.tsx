'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Paperclip, X } from 'lucide-react'

export default function EditarFacturaCompraPage() {
  const router = useRouter()
  const { id } = useParams()
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [tipos, setTipos] = useState<any[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [archivoActual, setArchivoActual] = useState<{ path: string; nombre: string } | null>(null)
  const [removerArchivo, setRemoverArchivo] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    cuit: '', numero_factura: '', fecha_factura: '', razon_social_proveedor: '', fecha_pago: '',
    monto_neto: '0', iva: '0', iibb: '0', otros_impuestos: '0', tipo_gasto_id: '',
    estado: 'pendiente', notas: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    const sb = createClient()
    sb.from('tipos_gasto').select('id, numero, nombre').order('numero').then(({ data }) => setTipos(data ?? []))
    sb.from('facturas_compra').select('*').eq('id', id).single().then(({ data: f }) => {
      if (!f) return
      setForm({
        cuit: f.cuit ?? '', numero_factura: f.numero_factura ?? '',
        fecha_factura: f.fecha_factura ?? '', razon_social_proveedor: f.razon_social_proveedor ?? '',
        fecha_pago: f.fecha_pago ?? '',
        monto_neto: String(f.monto_neto ?? 0), iva: String(f.iva ?? 0),
        iibb: String(f.iibb ?? 0), otros_impuestos: String(f.otros_impuestos ?? 0),
        tipo_gasto_id: f.tipo_gasto_id ?? '',
        estado: f.estado ?? 'pendiente', notas: f.notas ?? '',
      })
      if (f.archivo_path) setArchivoActual({ path: f.archivo_path, nombre: f.archivo_nombre ?? f.archivo_path })
      setLoadingData(false)
    })
  }, [id])

  const montoTotal = ['monto_neto', 'iva', 'iibb', 'otros_impuestos']
    .reduce((s, k) => s + (parseFloat((form as any)[k]) || 0), 0)

  async function handleDownload() {
    if (!archivoActual) return
    const sb = createClient()
    const { data } = await sb.storage.from('facturas-compra').createSignedUrl(archivoActual.path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const sb = createClient()

    let archivo_path = archivoActual?.path ?? null
    let archivo_nombre = archivoActual?.nombre ?? null

    if (removerArchivo && archivoActual) {
      await sb.storage.from('facturas-compra').remove([archivoActual.path])
      archivo_path = null
      archivo_nombre = null
    }
    if (file) {
      if (archivoActual) await sb.storage.from('facturas-compra').remove([archivoActual.path])
      const path = `${Date.now()}-${file.name}`
      const { error: upErr } = await sb.storage.from('facturas-compra').upload(path, file)
      if (upErr) { alert('Error subiendo archivo: ' + upErr.message); setLoading(false); return }
      archivo_path = path
      archivo_nombre = file.name
    }

    const { error } = await sb.from('facturas_compra').update({
      cuit: form.cuit,
      numero_factura: form.numero_factura,
      fecha_factura: form.fecha_factura,
      razon_social_proveedor: form.razon_social_proveedor,
      fecha_pago: form.fecha_pago || null,
      monto_neto: parseFloat(form.monto_neto) || 0,
      iva: parseFloat(form.iva) || 0,
      iibb: parseFloat(form.iibb) || 0,
      otros_impuestos: parseFloat(form.otros_impuestos) || 0,
      tipo_gasto_id: form.tipo_gasto_id || null,
      estado: form.estado,
      notas: form.notas || null,
      archivo_path, archivo_nombre,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (!error) router.push('/contabilidad/facturas-compra')
    else { alert('Error: ' + error.message); setLoading(false) }
  }

  if (loadingData) return <div className="p-6 text-sm text-gray-400">Cargando...</div>

  return (
    <div className="p-6 w-full">
      <div className="max-w-xl mx-auto">
      <Link href="/contabilidad/facturas-compra" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Volver
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Editar factura de compra</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Razón social del proveedor *</label>
          <input type="text" value={form.razon_social_proveedor} onChange={e => set('razon_social_proveedor', e.target.value)} required
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">CUIT</label>
            <input type="text" value={form.cuit} onChange={e => set('cuit', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Número de factura *</label>
            <input type="text" value={form.numero_factura} onChange={e => set('numero_factura', e.target.value)} required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha de factura *</label>
            <input type="date" value={form.fecha_factura} onChange={e => set('fecha_factura', e.target.value)} required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha de pago</label>
            <input type="date" value={form.fecha_pago} onChange={e => set('fecha_pago', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado</label>
          <select value={form.estado} onChange={e => set('estado', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
            <option value="pendiente">Pendiente de pago</option>
            <option value="pagado">Pagado</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de gasto</label>
          <select value={form.tipo_gasto_id} onChange={e => set('tipo_gasto_id', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
            <option value="">Sin especificar</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.numero} - {t.nombre}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Monto neto</label>
            <input type="number" min="0" step="0.01" value={form.monto_neto} onChange={e => set('monto_neto', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">IVA</label>
            <input type="number" min="0" step="0.01" value={form.iva} onChange={e => set('iva', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">IIBB</label>
            <input type="number" min="0" step="0.01" value={form.iibb} onChange={e => set('iibb', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Otros impuestos</label>
            <input type="number" min="0" step="0.01" value={form.otros_impuestos} onChange={e => set('otros_impuestos', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl px-4 py-3 flex justify-between text-sm">
          <span className="text-gray-500">Monto total</span>
          <span className="font-semibold text-gray-900">{montoTotal.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</span>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas</label>
          <input type="text" value={form.notas} onChange={e => set('notas', e.target.value)}
            placeholder="Ej: Servicios Enero 2026, Panel pared..."
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Adjunto</label>
          {archivoActual && !removerArchivo && !file && (
            <div className="flex items-center justify-between px-4 py-2.5 border border-gray-200 rounded-xl text-sm mb-2">
              <button type="button" onClick={handleDownload} className="flex items-center gap-2 text-[#1B9BF0] hover:underline truncate">
                <Paperclip size={14}/> {archivoActual.nombre}
              </button>
              <button type="button" onClick={() => setRemoverArchivo(true)} className="text-gray-400 hover:text-red-500">
                <X size={14}/>
              </button>
            </div>
          )}
          <button type="button" onClick={() => fileRef.current?.click()}
            className="w-full flex items-center gap-2 px-4 py-2.5 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:bg-gray-50">
            <Paperclip size={14}/> {file ? file.name : 'Reemplazar archivo...'}
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)}/>
        </div>
        <div className="flex gap-3 pt-2">
          <Link href="/contabilidad/facturas-compra" className="flex-1 text-center py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</Link>
          <button type="submit" disabled={loading}
            className="flex-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
      </div>
    </div>
  )
}
