'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Paperclip, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Currency, CURRENCIES } from '@/lib/utils/currency'
import { registrarDocumentoIA } from '@/lib/supabase/registrarDocumentoIA'
import { currentMonthAR, todayISO } from '@/lib/utils/date'

const SOCIEDADES = ['SAS', 'LLC', 'MONO']
const empresaCobraToSociedad = (v: string | null | undefined) => v === 'SAS' ? 'SAS' : v === 'LLC' ? 'LLC' : 'MONO'
const soloDigitos = (s: string) => s.replace(/\D/g, '')
const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

function generarMeses() {
  const meses: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = -12; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('es-AR', { month: 'long', year: 'numeric' })
    meses.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }
  return meses
}

export default function NuevaFacturaClientePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [clientes, setClientes] = useState<any[]>([])
  const [proyectos, setProyectos] = useState<any[]>([])
  const meses = generarMeses()
  const mesActual = currentMonthAR()

  const [form, setForm] = useState({
    client_id: '', project_id: '', numero: '',
    fecha_emision: todayISO(),
    fecha_vencimiento: '', importe: '',
    currency: 'ARS' as Currency, notas: '',
    mes_servicio: mesActual,
    sociedad: '', cuit: '', iva_pct: '21', importe_neto: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const [file, setFile] = useState<File | null>(null)
  const [usedAi, setUsedAi] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [extracting, setExtracting] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [cuitFactura, setCuitFactura] = useState('')

  useEffect(() => {
    createClient().from('clients').select('id, name, cuit, empresa_cobra').order('name').then(({ data }) => setClientes(data ?? []))
  }, [])

  useEffect(() => {
    if (!form.client_id) return
    const cliente = clientes.find(c => c.id === form.client_id)
    if (!cliente) return
    setForm(f => ({ ...f, sociedad: empresaCobraToSociedad(cliente.empresa_cobra), cuit: cliente.cuit ?? '' }))
  }, [form.client_id, clientes])

  const esSAS = form.sociedad === 'SAS'
  const netoNum = parseFloat(form.importe_neto)
  const hasNeto = form.importe_neto.trim() !== '' && !isNaN(netoNum)
  const importeIva = hasNeto ? Math.round((netoNum * parseFloat(form.iva_pct || '0')) / 100 * 100) / 100 : 0
  const importeTotal = hasNeto ? Math.round((netoNum + importeIva) * 100) / 100 : parseFloat(form.importe || '0')

  useEffect(() => {
    if (!form.client_id) return
    createClient().from('projects').select('id, name').eq('client_id', form.client_id).order('name')
      .then(({ data }) => setProyectos(data ?? []))
  }, [form.client_id])

  const clienteSeleccionado = clientes.find(c => c.id === form.client_id) ?? null
  const cuitCheck = useMemo(() => {
    if (!cuitFactura || !clienteSeleccionado) return null
    if (!clienteSeleccionado.cuit) return 'sin_cuit_cliente' as const
    return soloDigitos(cuitFactura) === soloDigitos(clienteSeleccionado.cuit) ? 'match' as const : 'mismatch' as const
  }, [cuitFactura, clienteSeleccionado])

  async function handleExtract() {
    if (!file) return
    setExtracting(true)
    setAiError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/ai/extraer-factura-cliente', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al procesar el documento')
      setCuitFactura(data.cuit_receptor || '')

      // Intentar matchear el cliente automáticamente por CUIT o razón social
      let matchedClientId: string | null = null
      if (data.cuit_receptor) {
        const porCuit = clientes.find(c => c.cuit && soloDigitos(c.cuit) === soloDigitos(data.cuit_receptor))
        if (porCuit) matchedClientId = porCuit.id
      }
      if (!matchedClientId && data.razon_social_receptor) {
        const nombreNorm = normalizar(data.razon_social_receptor)
        const porNombre = clientes.find(c => normalizar(c.name) === nombreNorm || nombreNorm.includes(normalizar(c.name)) || normalizar(c.name).includes(nombreNorm))
        if (porNombre) matchedClientId = porNombre.id
      }

      setForm(f => {
        const importeNeto = data.importe_neto ? String(data.importe_neto) : f.importe_neto
        const importeTotal = data.importe_total ? String(data.importe_total) : f.importe
        const ivaPct = data.importe_neto && data.importe_iva
          ? String(Math.round((data.importe_iva / data.importe_neto) * 100 * 100) / 100)
          : f.iva_pct
        return {
          ...f,
          client_id: matchedClientId ?? f.client_id,
          numero: data.numero || f.numero,
          fecha_emision: data.fecha_emision || f.fecha_emision,
          importe_neto: importeNeto,
          importe: importeTotal,
          iva_pct: ivaPct,
        }
      })
      setUsedAi(true)
    } catch (e: any) {
      setAiError(e.message ?? 'Error al procesar el documento')
    } finally {
      setExtracting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (esSAS && (!form.cuit.trim() || !form.iva_pct.trim() || !form.importe_neto.trim())) {
      alert('Para sociedad SAS, CUIT e IVA son obligatorios')
      return
    }
    if (!hasNeto && !form.importe.trim()) {
      alert('Ingresá el importe neto o el importe total')
      return
    }
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    const { data: inserted, error } = await sb.from('facturas_clientes').insert({
      client_id: form.client_id,
      project_id: form.project_id || null,
      numero: form.numero,
      fecha_emision: form.fecha_emision,
      fecha_vencimiento: form.fecha_vencimiento,
      importe: importeTotal,
      currency: form.currency,
      notas: form.notas || null,
      mes_servicio: form.mes_servicio || null,
      created_by: user?.id,
      sociedad: form.sociedad || 'MONO',
      cuit: form.cuit.trim() || null,
      iva_pct: hasNeto && form.iva_pct.trim() ? parseFloat(form.iva_pct) : null,
      importe_neto: hasNeto ? netoNum : null,
      importe_iva: hasNeto ? importeIva : null,
    }).select('id').single()
    if (error) { alert('Error: ' + error.message); setLoading(false); return }
    if (usedAi && file) await registrarDocumentoIA(sb, { seccion: 'facturas_clientes', file, referenciaId: inserted?.id, userId: user?.id })
    router.push('/facturas-clientes')
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Link href="/facturas-clientes" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Volver
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Nueva factura</h1>

      <div className="bg-[#E8F4FE] rounded-2xl border border-[#1B9BF0]/20 p-4 mb-4">
        <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5 mb-1">
          <Sparkles size={14} className="text-[#1B9BF0]"/> Completar con IA
        </p>
        <p className="text-xs text-gray-500 mb-3">Subí el PDF o la foto de la factura y completamos los campos automáticamente.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex-1 min-w-0 flex items-center gap-2 px-4 py-2.5 border border-dashed border-gray-300 bg-white rounded-xl text-sm text-gray-500 hover:bg-gray-50">
            <Paperclip size={14} className="shrink-0"/> <span className="truncate">{file ? file.name : 'Seleccionar archivo...'}</span>
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
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Cliente *</label>
          <select value={form.client_id} onChange={e => set('client_id', e.target.value)} required
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
            <option value="">Seleccionar cliente</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {cuitCheck === 'match' && (
          <p className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
            <CheckCircle2 size={13}/> El CUIT del comprobante coincide con el cliente.
          </p>
        )}
        {cuitCheck === 'mismatch' && (
          <p className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            <AlertTriangle size={13}/> El CUIT del comprobante ({cuitFactura}) no coincide con el CUIT del cliente ({clienteSeleccionado?.cuit}).
          </p>
        )}
        {cuitCheck === 'sin_cuit_cliente' && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            <AlertTriangle size={13}/> El cliente no tiene CUIT cargado para comparar. Comprobante: {cuitFactura}.
          </p>
        )}
        {proyectos.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Proyecto</label>
            <select value={form.project_id} onChange={e => set('project_id', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Sin proyecto</option>
              {proyectos.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Mes del servicio</label>
          <select value={form.mes_servicio} onChange={e => set('mes_servicio', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white capitalize">
            <option value="">Sin especificar</option>
            {meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Número *</label>
          <input type="text" value={form.numero} onChange={e => set('numero', e.target.value)} required
            placeholder="001-00001"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Emisión *</label>
            <input type="date" value={form.fecha_emision} onChange={e => set('fecha_emision', e.target.value)} required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Vencimiento *</label>
            <input type="date" value={form.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)} required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Sociedad que factura *</label>
          <select value={form.sociedad} onChange={e => set('sociedad', e.target.value)} required
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
            <option value="">Seleccionar sociedad</option>
            {SOCIEDADES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">CUIT {esSAS && '*'}</label>
          <input type="text" value={form.cuit} onChange={e => set('cuit', e.target.value)} required={esSAS}
            placeholder="20-12345678-9"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Importe neto {esSAS && '*'}</label>
            <div className="flex gap-2">
              <select value={form.currency} onChange={e => set('currency', e.target.value)}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
                {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <input type="number" min="0" step="0.01" value={form.importe_neto} onChange={e => set('importe_neto', e.target.value)} required={esSAS}
                placeholder="0.00"
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">IVA % {esSAS && '*'}</label>
            <input type="number" min="0" step="0.01" value={form.iva_pct} onChange={e => set('iva_pct', e.target.value)} required={esSAS}
              placeholder="21"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
        </div>
        {hasNeto ? (
          <div className="bg-gray-50 rounded-xl px-4 py-3 flex justify-between text-sm">
            <span className="text-gray-500">IVA: {importeIva.toLocaleString('es-AR', { style: 'currency', currency: form.currency === 'USD' ? 'USD' : 'ARS' })}</span>
            <span className="font-semibold text-gray-900">Total: {importeTotal.toLocaleString('es-AR', { style: 'currency', currency: form.currency === 'USD' ? 'USD' : 'ARS' })}</span>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Importe *</label>
            <div className="flex gap-2">
              <select value={form.currency} onChange={e => set('currency', e.target.value)}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
                {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <input type="number" min="0" step="0.01" value={form.importe} onChange={e => set('importe', e.target.value)} required={!hasNeto}
                placeholder="0.00"
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas</label>
          <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] resize-none"/>
        </div>
        <div className="flex gap-3 pt-2">
          <Link href="/facturas-clientes" className="flex-1 text-center py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</Link>
          <button type="submit" disabled={loading}
            className="flex-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
            {loading ? 'Guardando...' : 'Guardar factura'}
          </button>
        </div>
      </form>
    </div>
  )
}
