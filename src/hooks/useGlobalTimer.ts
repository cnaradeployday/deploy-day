'use client'
import { useEffect, useState } from 'react'

export interface GlobalTimerState {
  taskId: string
  taskTitle: string
  seconds: number
  isRunning: boolean
  storageKey: string
}

const MAX_SECONDS = 16 * 3600

const _listeners = new Set<(t: GlobalTimerState | null) => void>()
let _current: GlobalTimerState | null = null
let _intervalId: ReturnType<typeof setInterval> | null = null

function broadcast(t: GlobalTimerState | null) {
  _current = t
  _listeners.forEach(fn => fn(t ? { ...t } : null))
}

function scan(): GlobalTimerState | null {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith('timer_')) continue
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const data = JSON.parse(raw)

      // Reject old paused-format or missing start
      if (data.isPaused || !data.start) {
        localStorage.removeItem(key)
        continue
      }

      const startDate = new Date(data.start)
      if (isNaN(startDate.getTime())) {
        localStorage.removeItem(key)
        continue
      }

      const elapsed = Math.floor((Date.now() - startDate.getTime()) / 1000)
      const accumulated = typeof data.accumulatedSeconds === 'number' ? data.accumulatedSeconds : 0
      const total = accumulated + elapsed

      // Discard stale/corrupt entries
      if (total > MAX_SECONDS) {
        localStorage.removeItem(key)
        continue
      }

      const parts = key.split('_')
      if (parts.length < 3) continue
      const taskId = parts[1]
      const taskTitle = localStorage.getItem(`task_title_${taskId}`) ?? ''

      return { taskId, taskTitle, seconds: total, isRunning: true, storageKey: key }
    } catch {
      localStorage.removeItem(key)
    }
  }
  return null
}

function tick() {
  broadcast(scan())
}

export function useGlobalTimer() {
  const [timer, setTimer] = useState<GlobalTimerState | null>(null)

  useEffect(() => {
    const initial = scan()
    setTimer(initial)
    _current = initial

    const listener = (t: GlobalTimerState | null) => setTimer(t ? { ...t } : null)
    _listeners.add(listener)

    if (!_intervalId) {
      _intervalId = setInterval(tick, 1000)
    }

    return () => {
      _listeners.delete(listener)
      if (_listeners.size === 0 && _intervalId) {
        clearInterval(_intervalId)
        _intervalId = null
      }
    }
  }, [])

  return timer
}

export function formatTimerSeconds(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}
