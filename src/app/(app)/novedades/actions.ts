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
    const { data: existing } = await admin.from('notifications')
      .select('id').eq('user_id', n.user_id).eq('dedup_key', n.dedup_key).maybeSingle()
    if (existing) return
  }
  await admin.from('notifications').insert(n)
}

// Tipos válidos de evento de WhatsApp — deben coincidir con las opciones que
// el usuario elige en Mi perfil (whatsapp_notification_types).
export type WhatsappEventType =
  | 'revision_disponible'
  | 'correcciones_internas'
  | 'correcciones_cliente'
  | 'vencimiento_proximo'
  | 'incorporacion_tarea'

// Encola un WhatsApp — no lo envía. El envío real (Twilio) lo hace un proceso
// aparte que lee esta cola, así un error de WhatsApp nunca bloquea la operación
// de DDS que lo disparó.
export async function enqueueWhatsapp(n: {
  user_id: string
  task_id?: string | null
  event_type: WhatsappEventType
  template_name: string
  template_vars: Record<string, any>
  dedup_key?: string
}) {
  const admin = getAdmin()
  const { data: user } = await admin.from('users')
    .select('whatsapp_phone, whatsapp_country_code, whatsapp_enabled, whatsapp_consent, whatsapp_notification_types, is_active')
    .eq('id', n.user_id).single()

  if (!user || !user.is_active) return
  if (!user.whatsapp_enabled || !user.whatsapp_consent) return
  if (!user.whatsapp_phone || !user.whatsapp_country_code) return
  if (!(user.whatsapp_notification_types ?? []).includes(n.event_type)) return

  if (n.dedup_key) {
    const { data: existing } = await admin.from('whatsapp_notifications')
      .select('id').eq('dedup_key', n.dedup_key).maybeSingle()
    if (existing) return
  }

  await admin.from('whatsapp_notifications').insert({
    user_id: n.user_id,
    task_id: n.task_id ?? null,
    phone: user.whatsapp_country_code + user.whatsapp_phone,
    event_type: n.event_type,
    template_name: n.template_name,
    template_vars: n.template_vars,
    dedup_key: n.dedup_key ?? null,
  })
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
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(60)

  return { data: data ?? [], unread: (data ?? []).length }
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

export async function dismissStaleHoursNotifs(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const todayStr = new Date().toISOString().split('T')[0]
  const { data: todayEntry } = await getAdmin()
    .from('time_entries').select('id').eq('user_id', user.id).eq('entry_date', todayStr).limit(1).maybeSingle()
  if (!todayEntry) return
  // User logged hours today → mark stale no_hours_logged notifications as read
  await getAdmin().from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('type', 'no_hours_logged')
    .is('read_at', null)
}

export async function markTaskDone(taskId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }
  const admin = getAdmin()
  const { data: task } = await admin.from('tasks').select('requires_review').eq('id', taskId).single()
  if (task?.requires_review) {
    // Las tareas con control de revisión no tienen un estado "terminado" único — deben avanzar desde el detalle de la tarea.
    return { error: 'Esta tarea usa control de revisión. Avanzá su estado desde el detalle de la tarea.' }
  }
  const { error } = await admin.from('tasks').update({ status: 'terminado' }).eq('id', taskId)
  if (error) return { error: error.message }
  return { ok: true }
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

async function runComputedChecksForUser(userId: string): Promise<void> {
  const admin = getAdmin()
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const mesActual = todayStr.slice(0, 7)
  const primerDia = `${mesActual}-01`
  const ultimoDia = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]

  async function upsert(n: Omit<Parameters<typeof createNotification>[0], 'user_id'>) {
    if (n.dedup_key) {
      const { data: existing } = await admin.from('notifications')
        .select('id').eq('user_id', userId).eq('dedup_key', n.dedup_key).maybeSingle()
      if (existing) return
    }
    await admin.from('notifications').insert({ ...n, user_id: userId })
  }

  // ── 1. Horas: asignadas vs realizadas ──────────────────────────────────────
  const [
    { data: tareasDirectas },
    { data: tareasColab },
    { data: timeEntries },
    { data: availability },
  ] = await Promise.all([
    admin.from('tasks').select('direct_hours').eq('direct_responsible_id', userId)
      .gte('due_date', primerDia).lte('due_date', ultimoDia).not('status', 'in', '(presentado,finalizado)'),
    admin.from('task_collaborators').select('assigned_hours, task:tasks!inner(due_date, status)')
      .eq('user_id', userId).gte('task.due_date', primerDia).lte('task.due_date', ultimoDia)
      .not('task.status', 'in', '(presentado,finalizado)'),
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

  // ── 2. Tareas próximas a vencer (no terminadas) ───────────────────────────
  const in7Days = new Date(today)
  in7Days.setDate(today.getDate() + 7)
  const in7DaysStr = in7Days.toISOString().split('T')[0]
  const weekKey = getWeekKey(today)

  const notStartedStatuses = ['creado', 'estimado']

  const [{ data: tasksDue }, { data: collabDue }, { data: tasksOverdue }, { data: collabOverdue }] = await Promise.all([
    admin.from('tasks').select('id, title, due_date, status, project:projects(name, client:clients(name))')
      .eq('direct_responsible_id', userId)
      .in('status', notStartedStatuses)
      .gte('due_date', todayStr).lte('due_date', in7DaysStr),
    admin.from('task_collaborators')
      .select('task:tasks!inner(id, title, due_date, status, project:projects(name, client:clients(name)))')
      .eq('user_id', userId)
      .in('task.status', notStartedStatuses)
      .gte('task.due_date', todayStr).lte('task.due_date', in7DaysStr),
    admin.from('tasks').select('id, title, due_date, status, project:projects(name, client:clients(name))')
      .eq('direct_responsible_id', userId)
      .not('status', 'in', '(terminado,presentado,finalizado)')
      .lt('due_date', todayStr),
    admin.from('task_collaborators')
      .select('task:tasks!inner(id, title, due_date, status, project:projects(name, client:clients(name)))')
      .eq('user_id', userId)
      .not('task.status', 'in', '(terminado,presentado,finalizado)')
      .lt('task.due_date', todayStr),
  ])

  const allDueSoon = [
    ...(tasksDue ?? []),
    ...(collabDue ?? []).map((c: any) => c.task).filter(Boolean),
  ] as { id: string; title: string; due_date: string; status: string; project?: { name: string; client?: { name: string } } }[]

  for (const task of allDueSoon) {
    const fechaStr = new Date(task.due_date + 'T12:00:00').toLocaleDateString('es-AR')
    const statusLabel = task.status === 'creado' ? 'Creada' : 'Iniciada'
    await upsert({
      type: 'task_due_soon',
      title: `Tarea próxima a vencer: "${task.title}"`,
      body: `Vence el ${fechaStr} y está en estado "${statusLabel}". Asegurate de avanzar.`,
      link: `/mis-tareas`,
      dedup_key: `task_due_soon_${task.id}_${weekKey}`,
      metadata: { client_name: task.project?.client?.name ?? null, project_name: task.project?.name ?? null },
    })
    await enqueueWhatsapp({
      user_id: userId, task_id: task.id, event_type: 'vencimiento_proximo',
      template_name: 'vencimiento_proximo',
      template_vars: {
        tarea: task.title, fecha: fechaStr,
        cliente: task.project?.client?.name ?? '', link: 'https://dds.deployday.com/tareas/' + task.id,
      },
      dedup_key: `wa_task_due_soon_${task.id}_${weekKey}`,
    }).catch(() => {})
  }

  const allOverdue = [
    ...(tasksOverdue ?? []),
    ...(collabOverdue ?? []).map((c: any) => c.task).filter(Boolean),
  ] as { id: string; title: string; due_date: string; project?: { name: string; client?: { name: string } } }[]

  for (const task of allOverdue) {
    const fechaStr = new Date(task.due_date + 'T12:00:00').toLocaleDateString('es-AR')
    await upsert({
      type: 'task_due_soon',
      title: `Tarea vencida: "${task.title}"`,
      body: `Venció el ${fechaStr} y todavía no está terminada.`,
      link: `/mis-tareas`,
      dedup_key: `task_overdue_${task.id}_${weekKey}`,
      metadata: { client_name: task.project?.client?.name ?? null, project_name: task.project?.name ?? null },
    })
  }

  // ── 3. Sin cargar horas hace más de 1 día hábil ───────────────────────────
  const { data: lastEntry } = await admin
    .from('time_entries').select('entry_date').eq('user_id', userId)
    .order('entry_date', { ascending: false }).limit(1).maybeSingle()

  if (!lastEntry) {
    // Nunca cargó horas
    await upsert({
      type: 'no_hours_logged',
      title: 'Todavía no cargaste ninguna hora',
      body: 'Registrá tu tiempo en "Mis horas" para que quede reflejado en los reportes.',
      link: '/mis-horas',
      dedup_key: `no_hours_ever_${mesActual}`,
    })
  } else if (lastEntry.entry_date) {
    const lastDate = new Date(lastEntry.entry_date + 'T12:00:00')
    const businessDays = getBusinessDaysSince(lastDate, today)
    if (businessDays >= 1) {
      await upsert({
        type: 'no_hours_logged',
        title: businessDays === 1
          ? 'Ayer no cargaste horas'
          : `Hace ${businessDays} días hábiles que no cargás horas`,
        body: `Tu último registro fue el ${lastDate.toLocaleDateString('es-AR')}. No te olvides de registrar tu tiempo.`,
        link: '/mis-horas',
        dedup_key: `no_hours_${todayStr}`,
      })
    }
  }

  // ── 4. Resumen mensual de horas (siempre se genera, una vez por mes) ───────
  const horasLabel = horasRealizadas === 0
    ? 'Todavía no registraste horas este mes.'
    : `Llevás ${horasRealizadas.toFixed(1)}h registradas este mes.`

  const disponiblesLabel = horasDisponibles > 0
    ? ` Disponibilidad: ${horasDisponibles.toFixed(1)}h.`
    : ''

  await upsert({
    type: 'no_hours_logged',
    title: horasRealizadas === 0
      ? 'Sin horas registradas este mes'
      : `Resumen de horas — ${mesActual}`,
    body: horasLabel + disponiblesLabel,
    link: '/mis-horas',
    dedup_key: `monthly_summary_${mesActual}`,
  })
}

export async function checkComputedNotifications(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await runComputedChecksForUser(user.id)
}

export async function checkAllUsersComputedNotifications(): Promise<void> {
  const admin = getAdmin()
  const { data: users } = await admin.from('users').select('id')
  if (!users) return
  await Promise.all(users.map((u: { id: string }) => runComputedChecksForUser(u.id)))
}
