'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Save, History } from 'lucide-react'

const CATS = [
  { key: 'creatividad',    label: 'Creatividad' },
  { key: 'facturacion',    label: 'Facturación' },
  { key: 'velocidad',      label: 'Velocidad' },
  { key: 'predisposicion', label: 'Predisposición' },
  { key: 'conocimiento',   label: 'Conocimiento' },
  { key: 'calidad',        label: 'Calidad' },
] as const

type Cat = typeof CATS[number]['key']

interface Review {
  user_id: string
  month: string
  creatividad: number | null
  facturacion: number | null
  velocidad: number | null
  predisposicion: number | null
  conocimiento: number | null
  calidad: number | null
  reviewed_by: string | null
}

function avg(r: Review | null): number | null {
  if (!r) return null
  const vals = [r.creatividad, r.facturacion, r.velocidad, r.predisposicion, r.conocimiento, r.calidad]
    .filter((v): v is number => v !== null)
  if (!vals.length) return null
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

function scoreInfo(s: number): { label: string; textColor: string; bgColor: string } {
  if (s >= 4) return { label: 'Excelente', textColor: 'text-green-600', bgColor: 'bg-green-50' }
  if (s >= 3) return { label: 'Muy bueno', textColor: 'text-blue-600', bgColor: 'bg-blue-50' }
  if (s >= 2) return { label: 'Bueno',     textColor: 'text-amber-600', bgColor: 'bg-amber-50' }
  return       { label: 'Regular',   textColor: 'text-red-500',   bgColor: 'bg-red-50' }
}

function NumPicker({ value, onChange, disabled }: {
  value: number | null
  onChange: (v: number) => void
  disabled?: boolean
}) {
  return (
    <div className="flex gap-0.5 justify-center">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" disabled={disabled}
          onClick={() => !disabled && onChange(n)}
          className={`w-6 h-6 rounded text-[11px] font-bold transition-all leading-none ${
            value === n
              ? 'bg-[#1B9BF0] text-white shadow-sm'
              : (value ?? 0) > n
                ? 'bg-[#dbeafe] text-[#1B9BF0]'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          } ${disabled ? 'cursor-default opacity-70' : 'cursor-pointer'}`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

export default function PerformanceClient({
  usuarios, reviewsCurrentMonth, allReviews, mes, mesActual, mesesDisponibles, currentUserId
}: {
  usuarios: { id: string; full_name: string }[]
  reviewsCurrentMonth: Review[]
  allReviews: Review[]
  mes: string
  mesActual: string
  mesesDisponibles: string[]
  currentUserId: string
}) {
  const router = useRouter()
  const isCurrentMonth = mes === mesActual

  const initScores = () => {
    const map: Record<string, Partial<Record<Cat, number | null>>> = {}
    usuarios.forEach(u => {
      const r = reviewsCurrentMonth.find(rv => rv.user_id === u.id)
      map[u.id] = {
        creatividad:    r?.creatividad    ?? null,
        facturacion:    r?.facturacion    ?? null,
        velocidad:      r?.velocidad      ?? null,
        predisposicion: r?.predisposicion ?? null,
        conocimiento:   r?.conocimiento   ?? null,
        calidad:        r?.calidad        ?? null,
      }
    })
    return map
  }

  const [scores, setScores] = useState(initScores)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved,  setSaved]  = useState<Record<string, boolean>>({})
  const [expandHistory, setExpandHistory] = useState<Record<string, boolean>>({})

  function setScore(userId: string, cat: Cat, val: number) {
    setScores(prev => ({ ...prev, [userId]: { ...prev[userId], [cat]: val } }))
  }

  async function saveUser(userId: string) {
    setSaving(prev => ({ ...prev, [userId]: true }))
    const sb = createClient()
    const data: any = { user_id: userId, month: mes, reviewed_by: currentUserId, updated_at: new Date().toISOString() }
    CATS.forEach(c => { data[c.key] = scores[userId]?.[c.key] ?? null })
    await sb.from('performance_reviews').upsert(data, { onConflict: 'user_id,month' })
    setSaving(prev => ({ ...prev, [userId]: false }))
    setSaved(prev => ({ ...prev, [userId]: true }))
    setTimeout(() => setSaved(prev => ({ ...prev, [userId]: false })), 2000)
    router.refresh()
  }

  function getHistory(userId: string) {
    return allReviews.filter(r => r.user_id === userId && r.month !== mes)
      .sort((a, b) => b.month.localeCompare(a.month))
  }

  return (
    <div>
      {/* Scale legend */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span className="text-xs text-gray-400 mr-1">Escala:</span>
        {[
          { range: '1–2', label: 'Regular',  cls: 'bg-red-50   text-red-500   border-red-100'   },
          { range: '2–3', label: 'Bueno',    cls: 'bg-amber-50 text-amber-600 border-amber-100' },
          { range: '3–4', label: 'Muy bueno',cls: 'bg-blue-50  text-blue-600  border-blue-100'  },
          { range: '4–5', label: 'Excelente',cls: 'bg-green-50 text-green-600 border-green-100' },
        ].map(s => (
          <span key={s.label} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${s.cls}`}>
            <span className="font-semibold tabular-nums">{s.range}</span>
            <span className="opacity-60">·</span>
            {s.label}
          </span>
        ))}
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {mesesDisponibles.map(m => (
          <a key={m} href={`?mes=${m}`}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all capitalize ${
              m === mes
                ? 'bg-[#1B9BF0] text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-[#1B9BF0]'
            }`}>
            {new Date(m + '-01').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
          </a>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 960 }}>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 w-44">Usuario</th>
                {CATS.map(c => (
                  <th key={c.key} className="text-center px-2 py-3 text-xs font-medium text-gray-400 w-28">
                    {c.label}
                  </th>
                ))}
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-400 w-28">Global</th>
                {isCurrentMonth && <th className="w-28"/>}
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => {
                const userScores = scores[u.id] ?? {}
                const currentReview: Review = { user_id: u.id, month: mes, reviewed_by: currentUserId, ...userScores } as any
                const globalScore = avg(currentReview)
                const history = getHistory(u.id)
                const showHist = expandHistory[u.id]
                const info = globalScore !== null ? scoreInfo(globalScore) : null

                return (
                  <>
                    <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                      {/* User */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-[#E8F4FE] flex items-center justify-center text-xs font-semibold text-[#1B9BF0] shrink-0">
                            {u.full_name[0]?.toUpperCase()}
                          </div>
                          <span className="text-sm text-gray-800 truncate max-w-[120px]">{u.full_name}</span>
                        </div>
                      </td>

                      {/* Category pickers */}
                      {CATS.map(c => (
                        <td key={c.key} className="px-2 py-3">
                          <NumPicker
                            value={userScores[c.key] ?? null}
                            onChange={v => setScore(u.id, c.key, v)}
                            disabled={!isCurrentMonth}
                          />
                        </td>
                      ))}

                      {/* Global score */}
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-center gap-0.5">
                          {info ? (
                            <>
                              <span className={`text-sm font-bold tabular-nums ${info.textColor}`}>{globalScore}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none ${info.textColor} ${info.bgColor}`}>
                                {info.label}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      {isCurrentMonth && (
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5 justify-end">
                            {history.length > 0 && (
                              <button
                                onClick={() => setExpandHistory(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                                title="Ver historial"
                                className={`p-1.5 rounded-lg transition-all ${showHist ? 'text-[#1B9BF0] bg-blue-50' : 'text-gray-400 hover:text-[#1B9BF0] hover:bg-blue-50'}`}>
                                <History size={13}/>
                              </button>
                            )}
                            <button onClick={() => saveUser(u.id)} disabled={saving[u.id]}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-all">
                              <Save size={10}/>
                              {saving[u.id] ? '...' : saved[u.id] ? '✓' : 'Guardar'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* History rows */}
                    {showHist && history.map(r => {
                      const hAvg = avg(r)
                      const hInfo = hAvg !== null ? scoreInfo(hAvg) : null
                      return (
                        <tr key={r.month} className="bg-gray-50/40 border-b border-gray-50">
                          <td className="px-4 py-2 pl-14">
                            <span className="text-xs text-gray-400 capitalize">
                              {new Date(r.month + '-01').toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })}
                            </span>
                          </td>
                          {CATS.map(c => (
                            <td key={c.key} className="px-2 py-2">
                              <div className="flex justify-center">
                                {r[c.key] !== null ? (
                                  <span className="text-xs text-gray-500 font-medium bg-gray-100 w-6 h-6 rounded flex items-center justify-center">
                                    {r[c.key]}
                                  </span>
                                ) : <span className="text-xs text-gray-300 block text-center">—</span>}
                              </div>
                            </td>
                          ))}
                          <td className="px-3 py-2">
                            <div className="flex justify-center">
                              {hInfo ? (
                                <span className={`text-xs font-bold ${hInfo.textColor}`}>{hAvg}</span>
                              ) : <span className="text-xs text-gray-300">—</span>}
                            </div>
                          </td>
                          {isCurrentMonth && <td/>}
                        </tr>
                      )
                    })}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
