'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Save, ChevronDown, ChevronUp, History } from 'lucide-react'

const CATS = [
  { key: 'creatividad',    label: 'Creatividad' },
  { key: 'facturacion',    label: '$' },
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
  const vals = [r.creatividad, r.facturacion, r.velocidad, r.predisposicion, r.conocimiento, r.calidad].filter((v): v is number => v !== null)
  if (!vals.length) return null
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

function scoreLabel(s: number): { label: string; color: string } {
  if (s >= 4) return { label: 'Excelente', color: 'text-green-600 bg-green-50' }
  if (s >= 3) return { label: 'Muy bueno', color: 'text-blue-600 bg-blue-50' }
  if (s >= 2) return { label: 'Bueno', color: 'text-amber-600 bg-amber-50' }
  return { label: 'Regular', color: 'text-red-500 bg-red-50' }
}

function StarPicker({ value, onChange, disabled }: { value: number | null; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" disabled={disabled}
          onClick={() => !disabled && onChange(n)}
          className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
            value === n ? 'bg-[#1B9BF0] text-white' :
            (value ?? 0) > n ? 'bg-[#E8F4FE] text-[#1B9BF0]' :
            'bg-gray-100 text-gray-400 hover:bg-gray-200'
          } ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
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

  // Local editable state for current month
  const initScores = () => {
    const map: Record<string, Partial<Record<Cat, number | null>>> = {}
    usuarios.forEach(u => {
      const r = reviewsCurrentMonth.find(rv => rv.user_id === u.id)
      map[u.id] = {
        creatividad: r?.creatividad ?? null,
        facturacion: r?.facturacion ?? null,
        velocidad: r?.velocidad ?? null,
        predisposicion: r?.predisposicion ?? null,
        conocimiento: r?.conocimiento ?? null,
        calidad: r?.calidad ?? null,
      }
    })
    return map
  }

  const [scores, setScores] = useState<Record<string, Partial<Record<Cat, number | null>>>>(initScores)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
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
      {/* Score legend */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span className="text-xs text-gray-400 mr-1">Escala:</span>
        {[
          { range: '1–2', label: 'Regular',   color: 'bg-red-50 text-red-500 border-red-100' },
          { range: '2–3', label: 'Bueno',      color: 'bg-amber-50 text-amber-600 border-amber-100' },
          { range: '3–4', label: 'Muy bueno',  color: 'bg-blue-50 text-blue-600 border-blue-100' },
          { range: '4–5', label: 'Excelente',  color: 'bg-green-50 text-green-600 border-green-100' },
        ].map(s => (
          <span key={s.label} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${s.color}`}>
            <span className="font-semibold">{s.range}</span>
            <span className="opacity-70">·</span>
            {s.label}
          </span>
        ))}
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {mesesDisponibles.map(m => (
          <a key={m} href={`?mes=${m}`}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${m === mes ? 'bg-[#1B9BF0] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#1B9BF0]'}`}>
            {new Date(m + '-01').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
          </a>
        ))}
      </div>

      {/* Table header */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="grid px-4 py-3 border-b border-gray-50 bg-gray-50 text-xs font-medium text-gray-400" style={{gridTemplateColumns: '200px repeat(6, 1fr) 100px 100px'}}>
          <span>Usuario</span>
          {CATS.map(c => <span key={c.key} className="text-center">{c.label}</span>)}
          <span className="text-center">Global</span>
          {isCurrentMonth && <span/>}
        </div>

        {usuarios.map(u => {
          const userScores = scores[u.id] ?? {}
          const currentReview: Review = { user_id: u.id, month: mes, reviewed_by: currentUserId, ...userScores } as any
          const globalScore = avg(currentReview)
          const history = getHistory(u.id)
          const showHist = expandHistory[u.id]

          return (
            <div key={u.id} className="border-b border-gray-50 last:border-0">
              <div className="grid items-center px-4 py-3 hover:bg-gray-50 gap-2" style={{gridTemplateColumns: '200px repeat(6, 1fr) 100px 100px'}}>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-[#E8F4FE] flex items-center justify-center text-xs font-semibold text-[#1B9BF0] shrink-0">
                    {u.full_name[0].toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-900 truncate">{u.full_name}</span>
                </div>

                {CATS.map(c => (
                  <div key={c.key} className="flex justify-center">
                    <StarPicker
                      value={userScores[c.key] ?? null}
                      onChange={v => setScore(u.id, c.key, v)}
                      disabled={!isCurrentMonth}
                    />
                  </div>
                ))}

                <div className="flex flex-col items-center gap-0.5">
                  {globalScore !== null ? (() => {
                    const { label, color } = scoreLabel(globalScore)
                    return (
                      <>
                        <span className={`text-sm font-bold tabular-nums ${color.split(' ')[0]}`}>{globalScore}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${color}`}>{label}</span>
                      </>
                    )
                  })() : <span className="text-xs text-gray-300">—</span>}
                </div>

                {isCurrentMonth && (
                  <div className="flex items-center gap-1.5 justify-end">
                    {history.length > 0 && (
                      <button onClick={() => setExpandHistory(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
                        <History size={13}/>
                      </button>
                    )}
                    <button onClick={() => saveUser(u.id)} disabled={saving[u.id]}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-all">
                      <Save size={10}/>
                      {saving[u.id] ? '...' : saved[u.id] ? '✓' : 'Guardar'}
                    </button>
                  </div>
                )}
              </div>

              {/* History rows */}
              {showHist && history.map(r => {
                const hAvg = avg(r)
                return (
                  <div key={r.month} className="grid items-center px-4 py-2 bg-gray-50/50 border-t border-gray-50 gap-2" style={{gridTemplateColumns: '200px repeat(6, 1fr) 100px 100px'}}>
                    <span className="text-xs text-gray-400 pl-9">
                      {new Date(r.month + '-01').toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })}
                    </span>
                    {CATS.map(c => (
                      <div key={c.key} className="flex justify-center">
                        {r[c.key] !== null ? (
                          <span className="text-xs text-gray-500 font-medium bg-gray-100 w-6 h-6 rounded-lg flex items-center justify-center">{r[c.key]}</span>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </div>
                    ))}
                    <div className="flex justify-center">
                      {hAvg !== null ? (
                        <span className={`text-xs font-bold ${hAvg >= 4 ? 'text-green-600' : hAvg >= 3 ? 'text-amber-600' : 'text-red-500'}`}>{hAvg}</span>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </div>
                    <div/>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
