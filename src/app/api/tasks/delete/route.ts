import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role, custom_role_id').eq('id', user.id).single()
  const isSystemAdmin = ['admin', 'gerente_operaciones'].includes(profile?.role ?? '')

  let canDelete = isSystemAdmin
  if (!canDelete && profile?.custom_role_id) {
    const { data: perm } = await supabase
      .from('role_permissions').select('can_write')
      .eq('role_id', profile.custom_role_id).eq('module', 'tareas').single()
    canDelete = perm?.can_write ?? false
  }

  if (!canDelete) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const { taskId } = await req.json()
  if (!taskId) return NextResponse.json({ error: 'taskId requerido' }, { status: 400 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  await admin.from('time_entries').delete().eq('task_id', taskId)
  await admin.from('task_collaborators').delete().eq('task_id', taskId)
  await admin.from('task_comments').delete().eq('task_id', taskId)
  await admin.from('task_attachments').delete().eq('task_id', taskId)
  await admin.from('hour_requests').delete().eq('task_id', taskId)
  await admin.from('messages').update({ task_id: null }).eq('task_id', taskId)

  const { error } = await admin.from('tasks').delete().eq('id', taskId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
