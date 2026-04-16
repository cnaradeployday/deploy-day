'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  CheckCircle, X, Download, RefreshCw, Clock,
  Building2, Users, FileText, Upload, DollarSign, User
} from 'lucide-react'

const estadoColors: Record<string, string> = {
  borrador: 'bg-blue-50 text-blue-600',
  confirmado_colaborador: 'bg-amber-50 text-amber-600',
  aprobado_gerente: 'bg-green-50 text-green-600',
  factura_subida: 'bg-purple-50 text-purple-600',
  pagado: 'bg-green-100 text-green-700',
}
const estadoLabels: Record<string, string> = {
  borrador: 'En proceso',
  confirmado_colaborador: 'Mes cerrado',
  aprobado_gerente: 'Aprobado',
  factura_subida: 'Factura recibida',
  pagado: 'Cobrado',
}
const estadoLabelsColaborador: Record<string, string> = {
  borrador: 'En proceso',
  confirmado_colaborador: 'Confirmadas',
  aprobado_gerente: 'Aprobado — subí tu factura',
  factura_subida: 'Factura enviada',
  pagado: 'Cobrado',
}

interface Props {
  liqDelMes: any[]
  conFactura: any[]
  misLiquidaciones: any[]
  allUsers: any[]
  userRole: string
  currentUserId: string
  currentUserName: string
  currentUserProfile: any
  tab: string
  selectedMes: string
}

function nombreMes(m: string) {
  return new Date(m + '-15').toLocaleString('es-AR', { month: 'long', year: 'numeric' })
}

export default function LiquidacionesAdmin({
  liqDelMes, conFactura, misLiquidaciones, allUsers,
  userRole, currentUserId, currentUserName, currentUserProfile,
  tab, selectedMes,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [notas, setNotas] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState<string | null>(null)
  const [editBanco, setEditBanco] = useState<string | null>(null)
  const [bancoForm, setBancoForm] = useState({
    banco: currentUserProfile.banco ?? '',
    cbu: currentUserProfile.cbu ?? '',
    cuenta_nombre: currentUserProfile.cuenta_nombre ?? currentUserName,
  })

  const isAdmin = userRole === 'admin'
  const pendientes = liqDelMes.filter(l => l.estado === 'confirmado_colaborador')

  const TABS = [
    { key: 'resumen', label: 'Resumen equipo', icon: Users },
    { key: 'mis-liquidaciones', label: 'Mis liquidaciones', icon: User },
    { key: 'contractors', label: 'Servicio contractors', icon: Building2 },
  ]

  const meses: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    meses.push(d.toISOString().slice(0, 7))
  }

  function changeMes(mes: string) {
    router.push('/liquidaciones?tab=' + tab + '&mes=' + mes)
  }

  async function generarLiquidaciones() {
    setGenerating(true)
    const { error } = await createClient().rpc('generar_liquidaciones', { p_mes: selectedMes })
    setGenerating(false)
    if (error) { alert('Error: ' + error.message); return }
    router.refresh()
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

  async function descargar(url: string, nombre: string) {
    const { data } = await createClient().storage.from('facturas').download(url)
    if (!data) return
    const blobUrl = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = blobUrl; a.download = nombre; a.click()
    URL.revokeObjectURL(blobUrl)
  }

  async function confirmar(id: string) {
    if (!confirm('¿Confirmás que las horas de este mes son correctas?')) return
    setLoading(id)
    await createClient().from('liquidaciones').update({
      estado: 'confirmado_colaborador',
      confirmado_at: new Date().toISOString(),
    }).eq('id', id)
    router.refresh()
    setLoading(null)
  }

  async function subirFactura(id: string, file: File) {
    setUploading(id)
    const sb = createClient()
    const path = currentUserId + '/' + id + '/' + file.name
    const { error } = await sb.storage.from('facturas').upload(path, file, { upsert: true })
    if (error) { alert('Error: ' + error.message); setUploading(null); return }
    await sb.from('liquidaciones').update({
      estado: 'factura_subida',
      factura_url: path,
      factura_nombre: file.name,
      factura_subida_at: new Date().toISOString(),
    }).eq('id', id)
    router.refresh()
    setUploading(null)
  }

  async function guardarBanco() {
    await createClient().from('users').update(bancoForm).eq('id', currentUserId)
    setEditBanco(null)
    router.refresh()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Liquidaciones</h1>
        <div className="flex items-center gap-2">
          {tab !== 'mis-liquidaciones' && (
            <select
              value={selectedMes}
              onChange={e => changeMes(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white capitalize"
            >
              {meses.map(m => <option key={m} value={m}>{nombreMes(m)}</option>)}
            </select>
          )}
          {isAdmin && tab === 'resumen' && (
            <button
              onClick={generarLiquidaciones}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
            >
              <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
              Generar
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {TABS.map(t => (
          <Link
            key={t.key}
            href={'/liquidaciones?tab=' + t.key + '&mes=' + selectedMes}
            className={'flex-1 text-center py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ' +
              (tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
          >
            <t.icon size={14} />
            {t.label}
            {t.key === 'resumen' && pendientes.length > 0 && (
              <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{pendientes.length}</span>
            )}
            {t.key === 'contractors' && conFactura.length > 0 && (
              <span className="bg-purple-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{conFactura.length}</span>
            )}
          </Link>
        ))}
      </div>

      {tab === 'resumen' && (
        <div>
          <p className="text-sm text-gray-400 mb-4 capitalize">
            {nombreMes(selectedMes)} · {liqDelMes.length} colaborador{liqDelMes.length !== 1 ? 'es' : ''}
          </p>
          {!liqDelMes.length ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
              <Clock size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">Sin liquidaciones para este mes</p>
              <p className="text-xs mt-1">Generá las liquidaciones con el botón de arriba</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="grid grid-cols-5 px-5 py-3 text-xs font-medium text-gray-400 bg-gray-50 border-b border-gray-100">
                <span className="col-span-2">Colaborador</span>
                <span className="text-center">Mes</span>
                <span className="text-center">Total horas</span>
                <span className="text-center">Estado</span>
              </div>
              {liqDelMes.map(liq => (
                <div key={liq.id} className="border-b border-gray-50 last:border-0">
                  <div className="grid grid-cols-5 px-5 py-4 items-center">
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-gray-900">{liq.user?.full_name ?? '—'}</p>
                      <p className="text-xs text-gray-400">${liq.valor_hora}/h · ${Number(liq.monto_total ?? 0).toLocaleString()} total</p>
                    </div>
                    <p className="text-sm text-gray-600 text-center capitalize">{nombreMes(liq.mes)}</p>
                    <p className="text-sm font-semibold text-gray-900 text-center">{liq.total_horas}h</p>
                    <div className="flex justify-center">
                      <span className={'text-xs px-2.5 py-1 rounded-full ' + (estadoColors[liq.estado] ?? 'bg-gray-100 text-gray-500')}>
                        {estadoLabels[liq.estado] ?? liq.estado}
                      </span>
                    </div>
                  </div>
                  {liq.estado === 'confirmado_colaborador' && isAdmin && (
                    <div className="px-5 pb-4 space-y-2">
                      <textarea
                        value={notas[liq.id] ?? ''}
                        onChange={e => setNotas(n => ({ ...n, [liq.id]: e.target.value }))}
                        placeholder="Nota opcional para el colaborador..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] resize-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => rechazar(liq.id)} disabled={loading === liq.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-red-200 text-red-500 rounded-xl text-xs hover:bg-red-50 disabled:opacity-50">
                          <X size={13} /> Rechazar
                        </button>
                        <button onClick={() => aprobar(liq.id)} disabled={loading === liq.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#1B9BF0] text-white rounded-xl text-xs font-semibold disabled:opacity-50">
                          <CheckCircle size={13} /> Aprobar
                        </button>
                      </div>
                    </div>
                  )}
                  {liq.estado === 'aprobado_gerente' && isAdmin && (
                    <div className="px-5 pb-4">
                      <button onClick={() => marcarPagado(liq.id)} disabled={loading === liq.id}
                        className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-semibold hover:bg-green-700 disabled:opacity-50">
                        <CheckCircle size={13} /> Marcar como cobrado
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'mis-liquidaciones' && (
        <div>
          {!misLiquidaciones.length ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
              <Clock size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">Sin liquidaciones aún</p>
              <p className="text-xs mt-1">Aparecerán cuando se generen las liquidaciones mensuales</p>
            </div>
          ) : (
            misLiquidaciones.map(liq => (
              <div key={liq.id} className={'bg-white rounded-2xl border p-5 mb-4 ' +
                (liq.estado === 'aprobado_gerente' ? 'border-amber-200' : liq.estado === 'pagado' ? 'border-green-200' : 'border-gray-100')}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-semibold text-gray-900 capitalize">{nombreMes(liq.mes)}</p>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><Clock size={13} /> {liq.total_horas}h</span>
                      <span className="flex items-center gap-1"><DollarSign size={13} /> ${liq.valor_hora}/h</span>
                      <span className="font-bold text-gray-900">${Number(liq.monto_total ?? 0).toLocaleString()} monto a facturar</span>
                    </div>
                  </div>
                  <span className={'text-xs px-2.5 py-1 rounded-full ' + (estadoColors[liq.estado] ?? 'bg-gray-100 text-gray-500')}>
                    {estadoLabelsColaborador[liq.estado] ?? liq.estado}
                  </span>
                </div>
                {liq.notas_gerente && (
                  <div className="bg-amber-50 rounded-xl px-4 py-2.5 mb-4 text-sm text-amber-700">
                    <span className="font-medium">Nota: </span>{liq.notas_gerente}
                  </div>
                )}
                {liq.estado === 'borrador' && (
                  <button onClick={() => confirmar(liq.id)} disabled={loading === liq.id}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1B9BF0] text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                    <CheckCircle size={15} /> Confirmar horas del mes
                  </button>
                )}
                {liq.estado === 'confirmado_colaborador' && (
                  <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-600">
                    Horas confirmadas — esperando aprobación
                  </div>
                )}
                {liq.estado === 'aprobado_gerente' && (
                  <div className="space-y-3">
                    <div className="bg-amber-50 rounded-xl px-4 py-3 text-sm text-amber-700 font-medium">
                      ¡Aprobado! Facturá por <strong>${Number(liq.monto_total ?? 0).toLocaleString()}</strong>
                    </div>
                    {editBanco === liq.id ? (
                      <div className="space-y-2 border border-gray-200 rounded-xl p-4">
                        <p className="text-xs font-medium text-gray-600 mb-2">Datos bancarios para el pago</p>
                        {[
                          { key: 'banco', label: 'Banco', placeholder: 'Banco Galicia' },
                          { key: 'cbu', label: 'CBU', placeholder: '0000000000000000000000' },
                          { key: 'cuenta_nombre', label: 'A nombre de', placeholder: currentUserName },
                        ].map(({ key, label, placeholder }) => (
                          <div key={key}>
                            <label className="block text-xs text-gray-400 mb-1">{label}</label>
                            <input type="text" value={(bancoForm as any)[key]}
                              onChange={e => setBancoForm(f => ({ ...f, [key]: e.target.value }))}
                              placeholder={placeholder}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]" />
                          </div>
                        ))}
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => setEditBanco(null)} className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600">Cancelar</button>
                          <button onClick={guardarBanco} className="flex-1 py-2 bg-[#1B9BF0] text-white rounded-xl text-sm font-semibold">Guardar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-600">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-700">Datos bancarios</span>
                          <button onClick={() => setEditBanco(liq.id)} className="text-[#1B9BF0] hover:underline">Editar</button>
                        </div>
                        {currentUserProfile.banco ? (
                          <div className="space-y-0.5">
                            <p>Banco: {currentUserProfile.banco}</p>
                            <p>CBU: {currentUserProfile.cbu}</p>
                            <p>A nombre de: {currentUserProfile.cuenta_nombre ?? currentUserName}</p>
                          </div>
                        ) : (
                          <p className="text-amber-600">Completá tus datos bancarios antes de subir la factura</p>
                        )}
                      </div>
                    )}
                    <label className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold cursor-pointer transition-all">
                      <Upload size={15} />
                      {uploading === liq.id ? 'Subiendo...' : 'Subir factura (PDF)'}
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) subirFactura(liq.id, f) }}
                        disabled={uploading === liq.id} />
                    </label>
                  </div>
                )}
                {liq.estado === 'factura_subida' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-purple-600">
                      <FileText size={15} /> Factura enviada: {liq.factura_nombre}
                    </div>
                    <p className="text-xs text-gray-400">Esperando pago</p>
                  </div>
                )}
                {liq.estado === 'pagado' && (
                  <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                    <CheckCircle size={15} />
                    Cobrado {liq.pagado_at ? 'el ' + new Date(liq.pagado_at).toLocaleDateString('es-AR') : ''}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'contractors' && (
        <div>
          <p className="text-sm text-gray-400 mb-4">
            {conFactura.length} factura{conFactura.length !== 1 ? 's' : ''} recibida{conFactura.length !== 1 ? 's' : ''} pendiente{conFactura.length !== 1 ? 's' : ''} de pago
          </p>
          {!conFactura.length ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
              <Building2 size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">Sin facturas recibidas</p>
              <p className="text-xs mt-1">Aparecen aquí las liquidaciones con factura subida pendientes de pago</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="grid grid-cols-7 px-5 py-3 text-xs font-medium text-gray-400 bg-gray-50 border-b border-gray-100">
                <span className="col-span-2">Colaborador</span>
                <span className="text-center">Horas</span>
                <span className="text-center">Valor hora</span>
                <span className="text-center">Total</span>
                <span className="text-center">Aprobador</span>
                <span className="text-center">Acciones</span>
              </div>
              {conFactura.map(liq => {
                const u = liq.user
                const aprobador = allUsers.find((x: any) => x.id === liq.aprobado_by)
                return (
                  <div key={liq.id} className="border-b border-gray-50 last:border-0">
                    <div className="grid grid-cols-7 px-5 py-4 items-center">
                      <div className="col-span-2">
                        <p className="text-sm font-medium text-gray-900">{u?.full_name ?? '—'}</p>
                        <p className="text-xs text-gray-400 capitalize">{nombreMes(liq.mes)}</p>
                      </div>
                      <p className="text-sm text-gray-700 text-center">{liq.total_horas}h</p>
                      <p className="text-sm text-gray-700 text-center">${liq.valor_hora}</p>
                      <p className="text-sm font-bold text-gray-900 text-center">${Number(liq.monto_total ?? 0).toLocaleString()}</p>
                      <div className="text-center">
                        {aprobador ? (
                          <div>
                            <p className="text-xs font-medium text-gray-700">{aprobador.full_name}</p>
                            {liq.aprobado_at && <p className="text-xs text-gray-400">{new Date(liq.aprobado_at).toLocaleDateString('es-AR')}</p>}
                          </div>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </div>
                      <div className="flex items-center justify-center gap-1.5">
                        {liq.factura_url && (
                          <button onClick={() => descargar(liq.factura_url, liq.factura_nombre)} title="Descargar factura"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
                            <Download size={14} />
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => marcarPagado(liq.id)} disabled={loading === liq.id} title="Marcar pagado"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-all disabled:opacity-50">
                            <CheckCircle size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    {(u?.banco || u?.cbu) && (
                      <div className="px-5 pb-4">
                        <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-600 grid grid-cols-3 gap-2">
                          <div><span className="text-gray-400">Banco:</span> {u.banco ?? '—'}</div>
                          <div><span className="text-gray-400">CBU:</span> {u.cbu ?? '—'}</div>
                          <div><span className="text-gray-400">A nombre de:</span> {u.cuenta_nombre ?? '—'}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
