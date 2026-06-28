import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 })

  // Step 1: anon - read own task_collaborators
  const { data: misColabs, error: e1 } = await supabase
    .from('task_collaborators')
    .select('task_id, assigned_hours')
    .eq('user_id', user.id)

  const colabTaskIds = (misColabs ?? []).map((c: any) => c.task_id).filter(Boolean)

  // Step 2: admin - read tasks by IDs
  const adminSupabase = createAdminClient()
  const keyPreview = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').slice(0, 30) + '...'

  let colabTasksData = null
  let e2 = null
  if (colabTaskIds.length) {
    const result = await adminSupabase
      .from('tasks')
      .select('id, title, status, due_date')
      .in('id', colabTaskIds)
    colabTasksData = result.data
    e2 = result.error
  }

  return NextResponse.json({
    userId: user.id,
    step1_count: misColabs?.length ?? 0,
    step1_error: e1?.message ?? null,
    colabTaskIds,
    keyPreview,
    step2_count: colabTasksData?.length ?? null,
    step2_error: e2?.message ?? null,
    step2_data: colabTasksData,
  })
}
