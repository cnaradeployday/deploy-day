'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, TrendingUp, Pencil, Check, X, Info, Sparkles } from 'lucide-react'
import { calcularSaldosResultadoAutoRango } from '@/lib/contabilidad/calcularSaldosAutomaticos'

type Cuenta = { id: string; categoria: 'resultado'; subcategoria: string | null; nombre: string; orden: number; origen: 'manual' | 'auto' }

const fmt = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const mesActual = () => new Date().toISOString().slice(0, 7)
const SUBCATEGORIA_ORDEN = ['Ventas', 'Gastos operativos', 'Otros resultados']

export default function EstadoResultadosClient({ cuentas }: { cuentas: Cuenta[] }) {
  const [periodoDesde, setPeriodoDesde] = useState(mesActual())
  const [periodoHasta, setPeriodoHasta] = useState(mesActual())
  const esUnMes = periodoDesde === periodoHasta
  const [saldos, setSaldos] = useState<Record<string, number>>({})
  const [loadingSaldos, setLoadingSaldos] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [saving, setSaving] = useState(false)

  const grupos = useMemo(() => {
    const porSub = new Map<string, Cuenta[]>()
    for (const c of cuentas) {
      const key = c.subcategoria ?? 'Otros'
      if (!porSub.has(key)) porSub.set(key, [])
      porSub.get(key)!.push(c)
    }
    return [...porSub.entries()]
      .map(([subcategoria, items]) => ({ subcategoria, items: items.sort((a, b) => a.orden - b.orden) }))
      .sort((a, b) => {
        const ia = SUBCATEGORIA_ORDEN.indexOf(a.subcategoria), ib = SUBCATEGORIA_ORDEN.indexOf(b.subcategoria)
        if (ia === -1 && ib === -1) return a.subcategoria.localeCompare(b.subcategoria)
        if (ia === -1) return 1
        if (ib === -1) return -1
        return ia - ib
      })
  }, [cuentas])

  async function cargarSaldos() {
    if (periodoHasta < periodoDesde) return
    setLoadingSaldos(true)
    const sb = createClient()
    const manualIds = cuentas.filter(c => c.origen === 'manual').map(c => c.id)
    const cuentasAuto = cuentas.filter(c => c.origen === 'auto')

    const [{ data: rows }, auto] = await Promise.all([
      manualIds.length
        ? sb.from('plan_cuentas_saldos').select('cuenta_id, monto').in('cuenta_id', manualIds)
            .gte('periodo', `${periodoDesde}-01`).lte('periodo', `${periodoHasta}-01`)
        : Promise.resolve({ data: [] as any[] }),
      calcularSaldosResultadoAutoRango(sb, periodoDesde, periodoHasta, cuentasAuto),
    ])
    const map: Record<string, number> = {}
    for (const r of rows ?? []) map[r.cuenta_id] = (map[r.cuenta_id] ?? 0) + Number(r.monto)
    for (const c of cuentasAuto) {
      if (auto[c.nombre] != null) map[c.id] = auto[c.nombre]
    }
    setSaldos(map)
    setLoadingSaldos(false)
  }

  useEffect(() => { cargarSaldos() }, [periodoDesde, periodoHasta, cuentas])

  function openEdit(cuentaId: string) {
    setEditingId(cuentaId)
    setEditingValue(saldos[cuentaId] != null ? String(saldos[cuentaId]) : '')
  }

  async function handleSave(cuentaId: string) {
    const monto = parseFloat(editingValue)
    if (isNaN(monto)) { setEditingId(null); return }
    setSaving(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    const { error } = await sb.from('plan_cuentas_saldos')
      .upsert({ cuenta_id: cuentaId, periodo: `${periodoDesde}-01`, monto, created_by: user?.id }, { onConflict: 'cuenta_id,periodo' })
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setEditingId(null)
    cargarSaldos()
  }

  const ventas = grupos.find(g => g.subcategoria === 'Ventas')?.items.reduce((s, c) => s + (saldos[c.id] ?? 0), 0) ?? 0
  const resultado = cuentas.reduce((s, c) => s + (saldos[c.id] ?? 0), 0)
  const margen = ventas ? (resultado / ventas) * 100 : null

  return (
    <div className="p-6 w-full max-w-3xl mx-auto">
      <Link href="/contabilidad/plan-cuentas" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Plan de cuentas
      </Link>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp size={18} className="text-[#1B9BF0]"/> P&amp;L
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Estado de resultados</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={periodoDesde} onChange={e => setPeriodoDesde(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          <span className="text-sm text-gray-400">a</span>
          <input type="month" value={periodoHasta} onChange={e => setPeriodoHasta(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
      </div>

      {periodoHasta < periodoDesde ? (
        <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3 mb-6">El mes "hasta" no puede ser anterior al mes "desde".</p>
      ) : (
        <p className="flex items-start gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3 mb-6">
          <Info size={14} className="shrink-0 mt-0.5"/>
          Las cuentas con <Sparkles size={11} className="inline text-[#1B9BF0] mx-0.5"/> se calculan automáticamente a partir de Facturas de clientes, Facturas de compra, Tarjeta de crédito, Conciliación bancaria, Préstamos y Fondo Común de Inversión, sumadas en el rango seleccionado. El resto se carga a mano{!esUnMes && ' y solo se puede editar seleccionando un único mes'}.
        </p>
      )}

      {loadingSaldos ? (
        <p className="text-sm text-gray-400 text-center py-10">Cargando...</p>
      ) : (
        <div className="space-y-6">
          {grupos.map(g => {
            const subtotal = g.items.reduce((s, c) => s + (saldos[c.id] ?? 0), 0)
            return (
              <div key={g.subcategoria}>
                <p className="text-sm font-semibold text-gray-900 mb-2">{g.subcategoria}</p>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  {g.items.map(c => {
                    const monto = saldos[c.id]
                    const editable = c.origen === 'manual' && esUnMes
                    return (
                      <div key={c.id} className="grid grid-cols-[1fr_auto] px-5 py-2.5 items-center border-b border-gray-50 last:border-0 hover:bg-gray-50">
                        <span className="text-sm text-gray-700 flex items-center gap-1.5">
                          {c.nombre}
                          {c.origen === 'auto' && <Sparkles size={11} className="text-[#1B9BF0]" aria-label="Calculado automáticamente"/>}
                        </span>
                        {editingId === c.id ? (
                          <div className="flex items-center gap-1.5 justify-end">
                            <input type="number" step="0.01" autoFocus value={editingValue} onChange={e => setEditingValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSave(c.id); if (e.key === 'Escape') setEditingId(null) }}
                              className="w-32 px-2 py-1 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
                            <button onClick={() => handleSave(c.id)} disabled={saving} className="p-1 rounded-lg text-gray-300 hover:text-green-600 hover:bg-green-50 transition-all"><Check size={13}/></button>
                            <button onClick={() => setEditingId(null)} className="p-1 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-all"><X size={13}/></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{monto != null ? fmt(monto) : '—'}</span>
                            {editable && (
                              <button onClick={() => openEdit(c.id)} className="p-1 rounded-lg text-gray-300 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
                                <Pencil size={12}/>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <div className="grid grid-cols-[1fr_auto] px-5 py-3 items-center bg-gray-50 font-semibold text-sm text-gray-900">
                    <span>Subtotal {g.subcategoria}</span><span>{fmt(subtotal)}</span>
                  </div>
                </div>
              </div>
            )
          })}

          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Resultado GAN - (PERD)</p>
              {margen != null && <p className="text-xs text-gray-400 mt-0.5">Margen: {margen.toFixed(0)}%</p>}
            </div>
            <span className={'text-lg font-bold ' + (resultado >= 0 ? 'text-green-600' : 'text-red-500')}>{fmt(resultado)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
