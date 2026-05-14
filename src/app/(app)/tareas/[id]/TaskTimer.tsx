'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Play, Square, Clock, AlertCircle, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface ConflictInfo {
  taskId: string
  taskTitle: string
  elapsed: number
}

function ConflictModal({ conflict, onClose }: { conflict: ConflictInfo; onClose: () => void }) {
  const h = Math.floor(conflict.elapsed / 3600)
  const m = Math.floor((conflict.elapsed % 3600) / 60)
  const s = conflict.elapsed % 60
  const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <AlertCircle size={18} className="text-amber-500"/>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Cronómetro activo</p>
            <p className="text-xs text-gray-400 mt-0.5">Ya tenés un cronómetro en curso</p>
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl px-4 py-3 mb-5">
          <p className="text-xs text-gray-400 mb-0.5">Tarea en curso</p>
          <p className="text-sm font-medium text-gray-800 truncate">{conflict.taskTitle}</p>
          <p className="text-lg font-mono font-bold text-amber-500 tabular-nums mt-1">{timeStr}</p>
        </div>
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          Debés detener el cronómetro actual antes de iniciar uno nuevo.
        </p>
        <div className="flex flex-col gap-2">
          <Link href={`/tareas/${conflict.taskId}`} onClick={onClose}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl text-sm font-semibold transition-all">
            <ExternalLink size={13}/> Ir a la tarea
          </Link>
          <button onClick={onClose}
            className="w-full py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-medium transition-all">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TaskTimer({ taskId, userId, taskTitle = '' }: {
  taskId: string
  userId: string
  taskStatus?: string
  taskTitle?: string
}) {
  const [running, setRunning] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [loading, setLoading] = useState(false)
  const [conflict, setConflict] = useState<ConflictInfo | null>(null)
  const startTimeRef = useRef<Date | null>(null)
  const accumulatedRef = useRef(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const storageKey = `timer_${taskId}_${userId}`

  function tick() {
    if (!startTimeRef.current) return
    setSeconds(accumulatedRef.current + Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000))
  }

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const { start, accumulatedSeconds } = JSON.parse(saved)
        const acc = accumulatedSeconds ?? 0
        accumulatedRef.current = acc
        const startDate = start ? new Date(start) : new Date()
        startTimeRef.current = startDate
        setSeconds(acc + Math.floor((Date.now() - startDate.getTime()) / 1000))
        setRunning(true)
        // Register in active_timer key so FloatingTimer picks it up
        localStorage.setItem(`active_timer_${userId}`, JSON.stringify({ taskId, taskTitle }))
      } catch {
        localStorage.removeItem(storageKey)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (running && startTimeRef.current) {
      intervalRef.current = setInterval(tick, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  function findOtherTimer(): { taskId: string; data: any } | null {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('timer_')) continue
      const parts = key.split('_')
      if (parts.length !== 3 || parts[2] !== userId) continue
      if (parts[1] === taskId) continue
      try {
        return { taskId: parts[1], data: JSON.parse(localStorage.getItem(key)!) }
      } catch {}
    }
    return null
  }

  async function handleStart() {
    const other = findOtherTimer()
    if (other) {
      const { data } = await createClient().from('tasks').select('title').eq('id', other.taskId).single()
      const title = data?.title ?? 'otra tarea'
      const { start, accumulatedSeconds } = other.data
      const elapsed = start
        ? (accumulatedSeconds ?? 0) + Math.floor((Date.now() - new Date(start).getTime()) / 1000)
        : (accumulatedSeconds ?? 0)
      setConflict({ taskId: other.taskId, taskTitle: title, elapsed })
      return
    }
    startTimer()
  }

  function startTimer() {
    const now = new Date()
    startTimeRef.current = now
    accumulatedRef.current = 0
    setRunning(true)
    setSeconds(0)
    localStorage.setItem(storageKey, JSON.stringify({ start: now.toISOString(), accumulatedSeconds: 0, isPaused: false }))
    localStorage.setItem(`active_timer_${userId}`, JSON.stringify({ taskId, taskTitle }))
  }

  async function stopAndSave() {
    if (loading) return
    setLoading(true)
    const hoursLogged = Math.round((seconds / 3600) * 100) / 100
    if (hoursLogged > 0) {
      const d = new Date()
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      const { error } = await createClient().from('time_entries').insert({
        task_id: taskId, user_id: userId,
        hours_logged: hoursLogged, entry_date: dateStr,
        notes: 'Registrado con cronómetro',
      })
      if (error) { alert('Error al guardar: ' + error.message); setLoading(false); return }
    }
    setRunning(false)
    setSeconds(0)
    startTimeRef.current = null
    accumulatedRef.current = 0
    localStorage.removeItem(storageKey)
    localStorage.removeItem(`active_timer_${userId}`)
    setLoading(false)
    router.refresh()
  }

  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`

  return (
    <>
      {conflict && <ConflictModal conflict={conflict} onClose={() => setConflict(null)}/>}
      {!running ? (
        <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-3">
          <Clock size={14} className="text-gray-400 shrink-0"/>
          <span className="text-xs text-gray-400 flex-1">Cronómetro</span>
          <button onClick={handleStart}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-semibold transition-all">
            <Play size={11}/> Iniciar
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <Clock size={14} className="text-green-500"/>
            <span className="text-lg font-mono font-bold text-gray-900 tabular-nums flex-1">{timeStr}</span>
            <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">Corriendo</span>
          </div>
          {seconds > 0 && (
            <p className="text-xs text-gray-400">{Math.round((seconds / 3600) * 100) / 100}h a registrar</p>
          )}
          <button onClick={stopAndSave} disabled={loading}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-all">
            <Square size={11}/> {loading ? 'Guardando...' : 'Detener y guardar'}
          </button>
        </div>
      )}
    </>
  )
}
