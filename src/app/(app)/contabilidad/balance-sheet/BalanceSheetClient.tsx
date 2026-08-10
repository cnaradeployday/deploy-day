'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Scale, Pencil, Check, X, Info, Sparkles } from 'lucide-react'
import { calcularSaldosBalanceAuto, calcularResultadoYTD } from '@/lib/contabilidad/calcularSaldosAutomaticos'
import ExportExcelButton from '@/components/shared/ExportExcelButton'
import { currentMonthAR } from '@/lib/utils/date'

type Cuenta = { id: string; categoria: 'activo' | 'pasivo' | 'patrimonio_neto' | 'resultado'; subcategoria: string | null; nombre: string; orden: number; origen: 'manual' | 'auto' }

const fmt = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const mesActual = () => currentMonthAR()

export default function BalanceSheetClient({ cuentas }: { cuentas: Cuenta[] }) {
  const [periodo, setPeriodo] = useState(mesActual())
  const [saldos, setSaldos] = useState<Record<string, number>>({})
  const [resultadoEjercicio, setResultadoEjercicio] = useState(0)
  const [loadingSaldos, setLoadingSaldos] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [saving, setSaving] = useState(false)

  const activo = useMemo(() => cuentas.filter(c => c.categoria === 'activo').sort((a, b) => a.orden - b.orden), [cuentas])
  const pasivo = useMemo(() => cuentas.filter(c => c.categoria === 'pasivo').sort((a, b) => a.orden - b.orden), [cuentas])
  const patrimonio = useMemo(() => cuentas.filter(c => c.categoria === 'patrimonio_neto').sort((a, b) => a.orden - b.orden), [cuentas])
  const resultadoCuentas = useMemo(() => cuentas.filter(c => c.categoria === 'resultado'), [cuentas])

  async function cargarSaldos() {
    setLoadingSaldos(true)
    const sb = createClient()
    const periodoDate = `${periodo}-01`

    const noResultado = cuentas.filter(c => c.categoria !== 'resultado')
    const manualIds = noResultado.filter(c => c.origen === 'manual').map(c => c.id)

    const [{ data: rows }, auto, resultadoYTD] = await Promise.all([
      manualIds.length
        ? sb.from('plan_cuentas_saldos').select('cuenta_id, monto').in('cuenta_id', manualIds).eq('periodo', periodoDate)
        : Promise.resolve({ data: [] as any[] }),
      calcularSaldosBalanceAuto(sb, periodo),
      calcularResultadoYTD(sb, periodo, resultadoCuentas),
    ])

    const map: Record<string, number> = {}
    for (const r of rows ?? []) map[r.cuenta_id] = Number(r.monto)
    for (const c of noResultado) {
      if (c.origen === 'auto' && auto[c.nombre] != null) map[c.id] = auto[c.nombre]
    }
    setSaldos(map)
    setResultadoEjercicio(-1 * resultadoYTD)
    setLoadingSaldos(false)
  }

  useEffect(() => { cargarSaldos() }, [periodo, cuentas])

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
      .upsert({ cuenta_id: cuentaId, periodo: `${periodo}-01`, monto, created_by: user?.id }, { onConflict: 'cuenta_id,periodo' })
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setEditingId(null)
    cargarSaldos()
  }

  function Row({ c }: { c: Cuenta }) {
    const monto = saldos[c.id]
    return (
      <div className="grid grid-cols-[1fr_auto] px-5 py-2.5 items-center border-b border-gray-50 last:border-0 hover:bg-gray-50">
        <span className="text-sm text-gray-700 flex items-center gap-1.5">
          {c.nombre}
          {c.origen === 'auto' && <Sparkles size={11} className="text-[#1B9BF0]" aria-label="Calculado automáticamente"/>}
        </span>
        {c.origen === 'auto' ? (
          <span className="text-sm font-medium text-gray-900 text-right whitespace-nowrap">{monto != null ? fmt(monto) : '—'}</span>
        ) : editingId === c.id ? (
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
            <button onClick={() => openEdit(c.id)} className="p-1 rounded-lg text-gray-300 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
              <Pencil size={12}/>
            </button>
          </div>
        )}
      </div>
    )
  }

  const totalActivo = activo.reduce((s, c) => s + (saldos[c.id] ?? 0), 0)
  const totalPasivo = pasivo.reduce((s, c) => s + (saldos[c.id] ?? 0), 0)
  const totalPatrimonioNeto = patrimonio.reduce((s, c) => s + (saldos[c.id] ?? 0), 0) + resultadoEjercicio
  const control = totalActivo + totalPasivo + totalPatrimonioNeto
  const balanceado = Math.abs(control) < 1

  const exportData = useMemo(() => {
    const rows: { Cuenta: string; Monto: number | string }[] = []
    rows.push({ Cuenta: `Balance Sheet - ${periodo}`, Monto: '' })
    rows.push({ Cuenta: '', Monto: '' })
    rows.push({ Cuenta: 'ACTIVO', Monto: '' })
    activo.forEach(c => rows.push({ Cuenta: c.nombre, Monto: saldos[c.id] ?? '' }))
    rows.push({ Cuenta: 'Total Activo', Monto: totalActivo })
    rows.push({ Cuenta: '', Monto: '' })
    rows.push({ Cuenta: 'PASIVO', Monto: '' })
    pasivo.forEach(c => rows.push({ Cuenta: c.nombre, Monto: saldos[c.id] ?? '' }))
    rows.push({ Cuenta: 'Total Pasivo', Monto: totalPasivo })
    rows.push({ Cuenta: '', Monto: '' })
    rows.push({ Cuenta: 'PATRIMONIO NETO', Monto: '' })
    patrimonio.forEach(c => rows.push({ Cuenta: c.nombre, Monto: saldos[c.id] ?? '' }))
    rows.push({ Cuenta: 'Resultado del Ejercicio', Monto: resultadoEjercicio })
    rows.push({ Cuenta: 'Total Patrimonio Neto', Monto: totalPatrimonioNeto })
    rows.push({ Cuenta: '', Monto: '' })
    rows.push({ Cuenta: 'Control (Activo + Pasivo + Patrimonio Neto)', Monto: control })
    return rows
  }, [activo, pasivo, patrimonio, saldos, resultadoEjercicio, totalActivo, totalPasivo, totalPatrimonioNeto, control, periodo])

  return (
    <div className="p-6 w-full max-w-3xl mx-auto">
      <Link href="/contabilidad/plan-cuentas" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Plan de cuentas
      </Link>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Scale size={18} className="text-[#1B9BF0]"/> Balance Sheet
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Estado de situación patrimonial</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportExcelButton data={exportData} filename={`balance_sheet_${periodo}`}/>
          <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
      </div>

      <p className="flex items-start gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3 mb-6">
        <Info size={14} className="shrink-0 mt-0.5"/>
        Las cuentas con <Sparkles size={11} className="inline text-[#1B9BF0] mx-0.5"/> se calculan automáticamente a partir de los demás módulos de Contabilidad; el resto se carga a mano por mes ("as of"). El Resultado del Ejercicio suma el P&amp;L (auto + manual) desde enero hasta el mes seleccionado.
      </p>

      {loadingSaldos ? (
        <p className="text-sm text-gray-400 text-center py-10">Cargando...</p>
      ) : (
        <div className="space-y-6">
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-2">Activo</p>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {activo.map(c => <Row key={c.id} c={c}/>)}
              <div className="grid grid-cols-[1fr_auto] px-5 py-3 items-center bg-gray-50 font-semibold text-sm text-gray-900">
                <span>Total Activo</span><span>{fmt(totalActivo)}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900 mb-2">Pasivo</p>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {pasivo.map(c => <Row key={c.id} c={c}/>)}
              <div className="grid grid-cols-[1fr_auto] px-5 py-3 items-center bg-gray-50 font-semibold text-sm text-gray-900">
                <span>Total Pasivo</span><span>{fmt(totalPasivo)}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900 mb-2">Patrimonio Neto</p>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {patrimonio.map(c => <Row key={c.id} c={c}/>)}
              <div className="grid grid-cols-[1fr_auto] px-5 py-2.5 items-center border-b border-gray-50 hover:bg-gray-50">
                <span className="text-sm text-gray-700 flex items-center gap-1.5">Resultado del Ejercicio <Sparkles size={11} className="text-[#1B9BF0]"/></span>
                <span className="text-sm font-medium text-gray-900 text-right">{fmt(resultadoEjercicio)}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] px-5 py-3 items-center bg-gray-50 font-semibold text-sm text-gray-900">
                <span>Total Patrimonio Neto</span><span>{fmt(totalPatrimonioNeto)}</span>
              </div>
            </div>
          </div>

          <div className={'rounded-2xl border p-4 ' + (balanceado ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100')}>
            <div className="flex items-center justify-between">
              <span className={'text-sm font-medium ' + (balanceado ? 'text-green-700' : 'text-red-600')}>Control (Activo + Pasivo + Patrimonio Neto)</span>
              <span className={'text-sm font-semibold ' + (balanceado ? 'text-green-700' : 'text-red-600')}>{fmt(control)}</span>
            </div>
            {!balanceado && (
              <p className="text-xs text-red-500/80 mt-2">
                Si Activo, Pasivo y Resultado del Ejercicio ya están cargados/calculados y esto no cierra, probablemente falte cargar Capital Social (y cualquier resultado acumulado de ejercicios anteriores a este año) en Patrimonio Neto — hoy son de carga manual.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
