'use client'
import { useGlobalTimer, formatTimerSeconds } from '@/hooks/useGlobalTimer'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Timer, Square } from 'lucide-react'
import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function ActiveTimerWidget({ userId }: { userId: string }) {
  const timer = useGlobalTimer()
  const router = useRouter()
  const [stopping, setStopping] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Update browser tab title
  useEffect(() => {
    if (!mounted) return
    if (timer?.isRunning) {
      document.title = `⏱ ${formatTimerSeconds(timer.seconds)} · Deploy Day`
    } else if (timer && !timer.isRunning) {
      document.title = `⏸ ${formatTimerSeconds(timer.seconds)} · Deploy Day`
    } else {
      document.title = 'Deploy Day'
    }
  }, [timer?.seconds, timer?.isRunning, mounted])

  async function stopAndSave() {
    if (!timer || stopping) return
    setStopping(true)
    const hoursLogged = Math.round((timer.seconds / 3600) * 100) / 100
    if (hoursLogged > 0) {
      await createClient().from('time_entries').insert({
        task_id: timer.taskId,
        user_id: userId,
        hours_logged: hoursLogged,
        entry_date: new Date().toISOString().split('T')[0],
        notes: 'Registrado con cronómetro',
      })
    }
    localStorage.removeItem(timer.storageKey)
    localStorage.removeItem(`task_title_${timer.taskId}`)
    router.refresh()
    setStopping(false)
  }

  if (!mounted || !timer) return null

  return (
    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-2.5 py-1.5 text-green-800 text-xs font-medium shrink-0">
      <Timer size={12} className={timer.isRunning ? 'text-green-600 animate-pulse' : 'text-amber-500'} />
      <Link href={`/tareas/${timer.taskId}`} className="hover:underline max-w-[120px] truncate hidden sm:block">
        {timer.taskTitle || 'Tarea'}
      </Link>
      <span className="font-mono tabular-nums">{formatTimerSeconds(timer.seconds)}</span>
      <button
        onClick={stopAndSave}
        disabled={stopping}
        title="Detener y guardar"
        className="flex items-center gap-1 ml-1 px-2 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-all"
      >
        <Square size={9} />
        {stopping ? '...' : 'Detener'}
      </button>
    </div>
  )
}
