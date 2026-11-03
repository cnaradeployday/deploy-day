'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Percent, Trash2, Printer } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { addDaysISO, currentMonthAR, todayISO } from '@/lib/utils/date'
import {
  MAX_LINEAS_LLC, fmtUSD, itemCalculado, montoLinea, numeroFactura, periodoCorto, proximoCorrelativo,
  renderFacturaLLCHtml, totalesLLC, type LineaLLC,
} from '@/lib/facturas/llc'

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white'
const labelCls = 'block text-xs font-medium text-gray-500 mb-1'

const itemVacio = (): LineaLLC => ({ tipo: 'item', descripcion: '', unidad: '1', tarifa: 'N/A', monto: 0, baseIdx: null })

function generarMeses() {
  const now = new Date()
  const out: { value: string; label: string }[] = []
  for (let i = -12; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push({ value, label: d.toLocaleString('es-AR', { month: 'long', year: 'numeric' }) })
  }
  return out
}

export default function FacturaLLCForm() {
  const router = useRouter()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const hojaRef = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(0.5)
  const meses = useMemo(generarMeses, [])

  const [clientes, setClientes] = useState<any[]>([])
  const [proyectos, setProyectos] = useState<any[]>([])
  const [numerosLLC, setNumerosLLC] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [fecha, setFecha] = useState(todayISO())
  const [vencimiento, setVencimiento] = useState(addDaysISO(todayISO(), 7))
  const [vencEditado, setVencEditado] = useState(false)
  const [mesServicio, setMesServicio] = useState(currentMonthAR())
  const [para, setPara] = useState('')
  const [bill, setBill] = useState({ nombre: '', direccion: '', idFiscalLabel: 'Ruc', idFiscal: '' })
  const [lineas, setLineas] = useState<LineaLLC[]>([itemVacio()])

  useEffect(() => {
    const sb = createClient()
    sb.from('clients').select('id, name, razon_social, direccion_facturacion, id_fiscal, id_fiscal_label').order('name').then(({ data }) => setClientes(data ?? []))
    sb.from('facturas_clientes').select('numero').eq('sociedad', 'LLC').then(({ data }) => setNumerosLLC((data ?? []).map(d => d.numero)))
  }, [])

  // Al elegir cliente aparecen sus datos de BILL TO (los que falten se completan a mano y quedan guardados en la ficha).
  useEffect(() => {
    setProjectId('')
    const c = clientes.find(x => x.id === clientId)
    if (!c) { setProyectos([]); return }
    setBill({ nombre: c.razon_social || c.name, direccion: c.direccion_facturacion ?? '', idFiscalLabel: c.id_fiscal_label || 'Ruc', idFiscal: c.id_fiscal ?? '' })
    setPara(c.name.toUpperCase())
    createClient().from('projects').select('id, name').eq('client_id', clientId).order('name').then(({ data }) => setProyectos(data ?? []))
  }, [clientId, clientes])

  // La hoja A4 (210mm ~ 794px) se escala al ancho disponible; el iframe sigue imprimiendo a tamaño real.
  useEffect(() => {
    const el = hojaRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setEscala(el.clientWidth / 793.7))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => { if (!vencEditado) setVencimiento(addDaysISO(fecha, 7)) }, [fecha, vencEditado])

  const numero = numeroFactura(fecha, proximoCorrelativo(numerosLLC))
  const periodo = periodoCorto(mesServicio)
  const { subtotal, total } = totalesLLC(lineas)

  const html = useMemo(() => renderFacturaLLCHtml(
    { numero, fecha, periodo, para, cliente: bill, lineas },
    '/factura-llc-logo.png',
  ), [numero, fecha, periodo, para, bill, lineas])

  const setLinea = (i: number, patch: Partial<LineaLLC>) => setLineas(ls => ls.map((l, j) => j === i ? { ...l, ...patch } : l))
  const quitarLinea = (i: number) => setLineas(ls => ls.filter((_, j) => j !== i).map(l => {
    if (l.tipo !== 'pct' || l.baseIdx == null) return l
    return { ...l, baseIdx: l.baseIdx === i ? null : l.baseIdx > i ? l.baseIdx - 1 : l.baseIdx }
  }))
  const agregarPct = () => setLineas(ls => {
    const ultimoItem = ls.map((l, i) => l.tipo === 'item' ? i : -1).filter(i => i >= 0).pop() ?? null
    return [...ls, { tipo: 'pct', descripcion: 'IMP', unidad: '%', tarifa: '7.5', monto: 0, baseIdx: ultimoItem }]
  })

  function imprimir() {
    iframeRef.current?.contentWindow?.focus()
    iframeRef.current?.contentWindow?.print()
  }

  async function guardar() {
    if (!clientId) { alert('Elegí un cliente'); return }
    if (!bill.nombre.trim()) { alert('Completá el nombre de BILL TO'); return }
    if (total <= 0) { alert('Cargá al menos un ítem con monto'); return }
    if (lineas.some(l => !l.descripcion.trim())) { alert('Todos los renglones necesitan descripción'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/facturas-clientes/llc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId, project_id: projectId || null, fecha, fecha_vencimiento: vencimiento,
          mes_servicio: mesServicio, periodo, para, cliente: bill, lineas,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar')
      if (!data.pdf) alert(`Factura ${data.numero} guardada, pero no se pudo generar el PDF. Podés regenerarlo desde el detalle.`)
      router.push('/facturas-clientes/' + data.id)
    } catch (e: any) {
      alert('Error: ' + e.message)
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Link href="/facturas-clientes" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-4">
        <ArrowLeft size={15}/> Volver
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-5">Factura LLC <span className="text-gray-400 font-normal">· {numero}</span></h1>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 items-start">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <div>
            <label className={labelCls}>Cliente *</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)} className={inputCls}>
              <option value="">Seleccionar cliente</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-600">BILL TO</p>
            <input className={inputCls} placeholder="Razón social" value={bill.nombre} onChange={e => setBill(b => ({ ...b, nombre: e.target.value }))}/>
            <textarea className={inputCls + ' resize-none'} rows={2} placeholder="Dirección" value={bill.direccion} onChange={e => setBill(b => ({ ...b, direccion: e.target.value }))}/>
            <div className="grid grid-cols-[90px_1fr] gap-2">
              <input className={inputCls} placeholder="Ruc" value={bill.idFiscalLabel} onChange={e => setBill(b => ({ ...b, idFiscalLabel: e.target.value }))}/>
              <input className={inputCls} placeholder="ID fiscal" value={bill.idFiscal} onChange={e => setBill(b => ({ ...b, idFiscal: e.target.value }))}/>
            </div>
            {clientId && (!bill.direccion.trim() || !bill.idFiscal.trim()) && (
              <p className="text-[11px] text-amber-600">Este cliente no tiene dirección o ID fiscal cargados. Completalos acá y quedan guardados en su ficha.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha (DATE)</label>
              <input type="date" className={inputCls} value={fecha} onChange={e => setFecha(e.target.value)}/>
            </div>
            <div>
              <label className={labelCls}>Período (PERIOD)</label>
              <select className={inputCls + ' capitalize'} value={mesServicio} onChange={e => setMesServicio(e.target.value)}>
                {meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Nº de factura (automático)</label>
              <input className={inputCls + ' bg-gray-50 text-gray-500'} value={numero} readOnly/>
            </div>
            <div>
              <label className={labelCls}>For</label>
              <input className={inputCls} value={para} onChange={e => setPara(e.target.value)}/>
            </div>
            <div>
              <label className={labelCls}>Vencimiento (no se imprime)</label>
              <input type="date" className={inputCls} value={vencimiento} onChange={e => { setVencimiento(e.target.value); setVencEditado(true) }}/>
            </div>
            {proyectos.length > 0 && (
              <div>
                <label className={labelCls}>Proyecto</label>
                <select className={inputCls} value={projectId} onChange={e => setProjectId(e.target.value)}>
                  <option value="">Sin proyecto</option>
                  {proyectos.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Ítems</p>
            <div className="space-y-2">
              {lineas.map((l, i) => (
                <div key={i} className="rounded-xl border border-gray-100 p-2.5 space-y-2">
                  <div className="grid grid-cols-[1fr_32px] gap-2">
                    <input className={inputCls} placeholder="Descripción" value={l.descripcion} onChange={e => setLinea(i, { descripcion: e.target.value })}/>
                    <button type="button" onClick={() => quitarLinea(i)} disabled={lineas.length === 1} title="Quitar renglón"
                      className="text-gray-300 hover:text-red-500 disabled:opacity-30 flex items-center justify-center"><Trash2 size={15}/></button>
                  </div>
                  {l.tipo === 'item' ? (
                    <div className="grid grid-cols-3 gap-2">
                      <input className={inputCls} placeholder="Unit" value={l.unidad} onChange={e => setLinea(i, { unidad: e.target.value })}/>
                      <input className={inputCls} placeholder="Rate" value={l.tarifa} onChange={e => setLinea(i, { tarifa: e.target.value })}/>
                      {itemCalculado(l) != null
                        ? <input className={inputCls + ' bg-gray-50 text-gray-500'} readOnly title="Unit × Rate" value={itemCalculado(l)!.toFixed(2)}/>
                        : <input className={inputCls} type="number" min="0" step="0.01" placeholder="Amount (USD)" value={l.monto || ''} onChange={e => setLinea(i, { monto: parseFloat(e.target.value) || 0 })}/>}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 items-center">
                      <div className="flex items-center gap-1"><input className={inputCls} type="number" min="0" step="0.01" value={l.tarifa} onChange={e => setLinea(i, { tarifa: e.target.value })}/><span className="text-sm text-gray-400">%</span></div>
                      <select className={inputCls} value={l.baseIdx ?? ''} onChange={e => setLinea(i, { baseIdx: e.target.value === '' ? null : Number(e.target.value) })}>
                        <option value="">Sobre…</option>
                        {lineas.map((x, j) => x.tipo === 'item' ? <option key={j} value={j}>Sobre: {x.descripcion || `ítem ${j + 1}`}</option> : null)}
                      </select>
                      <span className="text-sm font-medium text-gray-700 text-right">{fmtUSD(montoLinea(lineas, i))}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <button type="button" disabled={lineas.length >= MAX_LINEAS_LLC} onClick={() => setLineas(ls => [...ls, itemVacio()])}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"><Plus size={13}/> Ítem</button>
              <button type="button" disabled={lineas.length >= MAX_LINEAS_LLC} onClick={agregarPct}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"><Percent size={13}/> Impuesto / %</button>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl px-4 py-3 flex justify-between text-sm">
            <span className="text-gray-500">Subtotal: {fmtUSD(subtotal)}</span>
            <span className="font-semibold text-gray-900">Total: {fmtUSD(total)}</span>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={imprimir}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
              <Printer size={15}/> Imprimir / PDF
            </button>
            <button type="button" onClick={guardar} disabled={saving}
              className="flex-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
              {saving ? 'Guardando…' : 'Guardar factura'}
            </button>
          </div>
        </div>

        <div className="lg:sticky lg:top-4">
          <p className="text-xs text-gray-400 mb-2">Vista previa</p>
          <div className="bg-gray-100 rounded-2xl p-3 overflow-hidden">
            <div ref={hojaRef} style={{ width: '100%', aspectRatio: '210 / 296' }} className="relative bg-white shadow overflow-hidden">
              <iframe ref={iframeRef} title="Vista previa de la factura" srcDoc={html}
                style={{ position: 'absolute', top: 0, left: 0, width: '210mm', height: '296mm', border: 0, transformOrigin: 'top left', transform: `scale(${escala})` }}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
