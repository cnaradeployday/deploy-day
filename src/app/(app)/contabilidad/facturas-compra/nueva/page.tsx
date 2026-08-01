'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Paperclip, Sparkles } from 'lucide-react'

function normalizar(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export default function NuevaFacturaCompraPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [tipos, setTipos] = useState<any[]>([])
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    cuit: '', numero_factura: '',
    fecha_factura: new Date().toISOString().split('T')[0],
    razon_social_proveedor: '', fecha_pago: '',
    monto_neto: '0', iva: '0', iibb: '0', otros_impuestos: '0',
    tipo_gasto_id: '', estado: 'pendiente', notas: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    createClient().from('tipos_gasto').select('id, numero, nombre').order('numero').then(({ data }) => setTipos(data ?? []))
  }, [])

  async function handleExtract() {
    if (!file) return
    setExtracting(true)
    setAiError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/ai/extraer-factura-compra', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al procesar el documento')
      const tipoMatch = data.tipo_gasto_sugerido
        ? tipos.find(t => normalizar(t.nombre) === normalizar(data.tipo_gasto_sugerido))
          ?? tipos.find(t => normalizar(t.nombre).includes(normalizar(data.tipo_gasto_sugerido)) || normalizar(data.tipo_gasto_sugerido).includes(normalizar(t.nombre)))
        : null
      setForm(f => ({
        ...f,
        cuit: data.cuit || f.cuit,
        numero_factura: data.numero_factura || f.numero_factura,
        fecha_factura: data.fecha_factura || f.fecha_factura,
        razon_social_proveedor: data.razon_social_proveedor || f.razon_social_proveedor,
        monto_neto: data.monto_neto ? String(data.monto_neto) : f.monto_neto,
        iva: data.iva ? String(data.iva) : f.iva,
        iibb: data.iibb ? String(data.iibb) : f.iibb,
        otros_impuestos: data.otros_impuestos ? String(data.otros_impuestos) : f.otros_impuestos,
        tipo_gasto_id: tipoMatch ? tipoMatch.id : f.tipo_gasto_id,
      }))
    } catch (e: any) {
      setAiError(e.message ?? 'Error al procesar el documento')
    } finally {
      setExtracting(false)
    }
  }

  const montoTotal = ['monto_neto', 'iva', 'iibb', 'otros_impuestos']
    .reduce((s, k) => s + (parseFloat((form as any)[k]) || 0), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()

    let archivo_path: string | null = null
    let archivo_nombre: string | null = null
    if (file) {
      const path = `${Date.now()}-${file.name}`
      const { error: upErr } = await sb.storage.from('facturas-compra').upload(path, file)
      if (upErr) { alert('Error subiendo archivo: ' + upErr.message); setLoading(false); return }
      archivo_path = path
      archivo_nombre = file.name
    }

    const { error } = await sb.from('facturas_compra').insert({
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
      created_by: user?.id,
    })
    if (!error) router.push('/contabilidad/facturas-compra')
    else { alert('Error: ' + error.message); setLoading(false) }
  }

  return (
    <div className="p-6 w-full">
      <div className="max-w-xl mx-auto">
      <Link href="/contabilidad/facturas-compra" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Volver
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Nueva factura de compra</h1>

      <div className="bg-[#E8F4FE] rounded-2xl border border-[#1B9BF0]/20 p-4 mb-4">
        <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5 mb-1">
          <Sparkles size={14} className="text-[#1B9BF0]"/> Completar con IA
        </p>
        <p className="text-xs text-gray-500 mb-3">Subí el PDF o la foto de la factura y completamos los campos automáticamente.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex-1 flex items-center gap-2 px-4 py-2.5 border border-dashed border-gray-300 bg-white rounded-xl text-sm text-gray-500 hover:bg-gray-50">
            <Paperclip size={14}/> {file ? file.name : 'Seleccionar archivo...'}
          </button>
          <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={e => { setFile(e.target.files?.[0] ?? null); setAiError(null) }}/>
          <button type="button" onClick={handleExtract} disabled={!file || extracting}
            className="shrink-0 flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
            <Sparkles size={14}/> {extracting ? 'Analizando...' : 'Completar'}
          </button>
        </div>
        {aiError && <p className="text-xs text-red-500 mt-2">{aiError}</p>}
      </div>

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
              placeholder="20-12345678-9"
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
        <div className="flex gap-3 pt-2">
          <Link href="/contabilidad/facturas-compra" className="flex-1 text-center py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</Link>
          <button type="submit" disabled={loading}
            className="flex-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
            {loading ? 'Guardando...' : 'Guardar factura'}
          </button>
        </div>
      </form>
      </div>
    </div>
  )
}
