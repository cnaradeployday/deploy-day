'use server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function getAdmin() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// ─── Public helpers used by other server actions ─────────────────────────────

export async function createNotification(n: {
  user_id: string
  type: string
  title: string
  body?: string
  link?: string
  metadata?: Record<string, any>
  dedup_key?: string
}) {
  const admin = getAdmin()
  if (n.dedup_key) {
    await admin.from('notifications').upsert(
      { ...n, created_at: new Date().toISOString() },
      { onConflict: 'user_id,dedup_key', ignoreDuplicates: true }
    )
  } else {
    await admin.from('notifications').insert(n)
  }
}

// ─── Fetch + mark read ────────────────────────────────────────────────────────

export async function fetchNotifications(): Promise<{ data: any[]; unread: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], unread: 0 }

  const { data } = await getAdmin()
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(60)

  const unread = (data ?? []).filter(n => !n.read_at).length
  return { data: data ?? [], unread }
}

export async function markNotificationRead(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id)
}

export async function markAllNotificationsRead() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null)
}

// ─── Computed alerts (called when user opens the bell) ───────────────────────

function getWeekKey(d: Date): string {
  const onejan = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${week}`
}

function getBusinessDaysSince(last: Date, today: Date): number {
  let count = 0
  const cur = new Date(last)
  cur.setDate(cur.getDate() + 1)
  while (cur <= today) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

export async function checkComputedNotifications(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const admin = getAdmin()
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const mesActual = todayStr.slice(0, 7)
  const primerDia = `${mesActual}-01`
  const ultimoDia = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
  const userId = user.id

  async function upsert(n: Parameters<typeof createNotification>[0]) {
    if (n.dedup_key) {
      await admin.from('notifications').upsert(
        { ...n, user_id: userId, created_at: new Date().toISOString() },
        { onConflict: 'user_id,dedup_key', ignoreDuplicates: true }
      )
    } else {
      await admin.from('notifications').insert({ ...n, user_id: userId })
    }
  }

  // ── 1. Horas: asignadas vs realizadas ──────────────────────────────────────
  const [
    { data: tareasDirectas },
    { data: tareasColab },
    { data: timeEntries },
    { data: availability },
  ] = await Promise.all([
    admin.from('tasks').select('direct_hours').eq('direct_responsible_id', userId)
      .gte('due_date', primerDia).lte('due_date', ultimoDia).not('status', 'in', '(presentado)'),
    admin.from('task_collaborators').select('assigned_hours, task:tasks!inner(due_date, status)')
      .eq('user_id', userId).gte('task.due_date', primerDia).lte('task.due_date', ultimoDia)
      .not('task.status', 'in', '(presentado)'),
    admin.from('time_entries').select('hours_logged').eq('user_id', userId)
      .gte('entry_date', primerDia).lte('entry_date', ultimoDia),
    admin.from('user_availability').select('horas').eq('user_id', userId)
      .lte('desde', ultimoDia).gte('hasta', primerDia),
  ])

  const horasAsignadas = (tareasDirectas ?? []).reduce((s: number, t: any) => s + (t.direct_hours ?? 0), 0) +
    (tareasColab ?? []).reduce((s: number, c: any) => s + (c.assigned_hours ?? 0), 0)
  const horasDisponibles = (availability ?? []).reduce((s: number, a: any) => s + a.horas, 0)
  const horasRealizadas = (timeEntries ?? []).reduce((s: number, e: any) => s + e.hours_logged, 0)

  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const monthPct = today.getDate() / daysInMonth

  if (horasAsignadas > 0) {
    const pct = horasRealizadas / horasAsignadas
    for (const threshold of [0.7, 0.8, 0.9, 1.0]) {
      if (pct >= threshold) {
        await upsert({
          type: 'hours_overuse_assigned',
          title: `Usaste el ${Math.round(pct * 100)}% de tus horas asignadas`,
          body: `Llevás ${horasRealizadas.toFixed(1)}h de ${horasAsignadas.toFixed(1)}h asignadas este mes.`,
          link: '/mis-horas',
          dedup_key: `hours_assigned_${mesActual}_${Math.round(threshold * 100)}`,
        })
      }
    }
    // Alerta de ritmo: si a mitad de mes ya superás el 75% del total
    if (monthPct < 0.6 && pct >= 0.75) {
      await upsert({
        type: 'hours_overuse_assigned',
        title: 'Estás consumiendo horas más rápido de lo esperado',
        body: `A ${Math.round(monthPct * 100)}% del mes ya usaste el ${Math.round(pct * 100)}% de tus horas asignadas.`,
        link: '/mis-horas',
        dedup_key: `hours_pace_${mesActual}_${todayStr}`,
      })
    }
  }

  if (horasDisponibles > 0) {
    const pct = horasRealizadas / horasDisponibles
    for (const threshold of [0.7, 0.8, 0.9, 1.0]) {
      if (pct >= threshold) {
        await upsert({
          type: 'hours_overuse_availability',
          title: `Usaste el ${Math.round(pct * 100)}% de tu disponibilidad mensual`,
          body: `Llevás ${horasRealizadas.toFixed(1)}h de ${horasDisponibles.toFixed(1)}h disponibles este mes.`,
          link: '/mis-horas',
          dedup_key: `hours_avail_${mesActual}_${Math.round(threshold * 100)}`,
        })
      }
    }
  }

  // ── 2. Tareas próximas a vencer sin iniciar ────────────────────────────────
  const in7Days = new Date(today)
  in7Days.setDate(today.getDate() + 7)
  const in7DaysStr = in7Days.toISOString().split('T')[0]
  const weekKey = getWeekKey(today)

  const [{ data: tasksDue }, { data: collabDue }] = await Promise.all([
    admin.from('tasks').select('id, title, due_date')
      .eq('direct_responsible_id', userId).eq('status', 'creado')
      .gte('due_date', todayStr).lte('due_date', in7DaysStr),
    admin.from('task_collaborators')
      .select('task:tasks!inner(id, title, due_date, status)')
      .eq('user_id', userId).eq('task.status', 'creado')
      .gte('task.due_date', todayStr).lte('task.due_date', in7DaysStr),
  ])

  const allDueSoon = [
    ...(tasksDue ?? []),
    ...(collabDue ?? []).map((c: any) => c.task).filter(Boolean),
  ] as { id: string; title: string; due_date: string }[]

  for (const task of allDueSoon) {
    const fechaStr = new Date(task.due_date + 'T12:00:00').toLocaleDateString('es-AR')
    await upsert({
      type: 'task_due_soon',
      title: `Tarea próxima a vencer: "${task.title}"`,
      body: `Vence el ${fechaStr} y todavía está en estado "Creada". ¿Ya la estimaste?`,
      link: `/mis-tareas`,
      dedup_key: `task_due_soon_${task.id}_${weekKey}`,
    })
  }

  // ── 3. Sin cargar horas hace más de 1 día hábil ───────────────────────────
  const { data: lastEntry } = await admin
    .from('time_entries').select('entry_date').eq('user_id', userId)
    .order('entry_date', { ascending: false }).limit(1).maybeSingle()

  if (lastEntry?.entry_date) {
    const lastDate = new Date(lastEntry.entry_date + 'T12:00:00')
    const businessDays = getBusinessDaysSince(lastDate, today)
    if (businessDays >= 2) {
      await upsert({
        type: 'no_hours_logged',
        title: `Hace ${businessDays} días hábiles que no cargás horas`,
        body: `Tu último registro fue el ${lastDate.toLocaleDateString('es-AR')}. No te olvides de registrar tu tiempo.`,
        link: '/mis-horas',
        dedup_key: `no_hours_${todayStr}`,
      })
    }
  }
}
