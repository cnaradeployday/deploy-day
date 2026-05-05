'use client'
import { createClient } from '@/lib/supabase/client'

const CHANNEL_NAME = 'deployday-active-timers'

export interface ActiveTimerEntry {
  userId: string
  fullName: string
  taskId: string
  taskTitle: string
  startedAt: string
}

// Singleton — one channel shared across TaskTimer and ActiveTimersClient
const _s = {
  channel: null as any,
  initializing: false,
  syncListeners: new Set<() => void>(),
}

async function ensureChannel(userId: string): Promise<any> {
  if (_s.channel) return _s.channel
  // Prevent double-init
  if (_s.initializing) {
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 100))
      if (_s.channel) return _s.channel
    }
    return _s.channel
  }
  _s.initializing = true

  const sb = createClient()
  const ch = sb.channel(CHANNEL_NAME, { config: { presence: { key: userId } } })

  // ALL listeners must be added BEFORE subscribe()
  ch.on('presence', { event: 'sync' }, () => _s.syncListeners.forEach(fn => fn()))
  ch.on('presence', { event: 'join' }, () => _s.syncListeners.forEach(fn => fn()))
  ch.on('presence', { event: 'leave' }, () => _s.syncListeners.forEach(fn => fn()))

  await new Promise<void>(res => {
    ch.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        _s.channel = ch
        _s.initializing = false
        res()
      }
    })
  })

  return _s.channel
}

export async function trackTimerActive(
  userId: string,
  fullName: string,
  taskId: string,
  taskTitle: string,
) {
  const ch = await ensureChannel(userId)
  if (!ch) return
  await ch.track({
    has_timer: true,
    full_name: fullName,
    task_id: taskId,
    task_title: taskTitle,
    started_at: new Date().toISOString(),
  })
}

export async function trackTimerInactive(userId: string, fullName: string) {
  const ch = await ensureChannel(userId)
  if (!ch) return
  await ch.track({ has_timer: false, full_name: fullName })
}

export function getActiveTimers(): ActiveTimerEntry[] {
  if (!_s.channel) return []
  const state = _s.channel.presenceState()
  const result: ActiveTimerEntry[] = []
  for (const [uid, presences] of Object.entries(state)) {
    const p = (presences as any[])[0]
    if (!p?.has_timer) continue
    result.push({
      userId: uid,
      fullName: p.full_name ?? 'Usuario',
      taskId: p.task_id ?? '',
      taskTitle: p.task_title ?? '',
      startedAt: p.started_at ?? new Date().toISOString(),
    })
  }
  return result
}

export function subscribeToChanges(userId: string, fn: () => void): () => void {
  _s.syncListeners.add(fn)
  ensureChannel(userId) // init channel if not yet done
  return () => _s.syncListeners.delete(fn)
}
