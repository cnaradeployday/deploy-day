import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 })

  // Step 1: raw task_collaborators for this user
  const { data: rawColabs, error: e1 } = await supabase
    .from('task_collaborators')
    .select('task_id, assigned_hours')
    .eq('user_id', user.id)

  // Step 2: inner join approach
  const { data: innerJoin, error: e2 } = await supabase
    .from('tasks')
    .select('id, title, status, project_id, project:projects(id, name, client:clients(id, name)), task_collaborators!inner(assigned_hours, user_id)')
    .eq('task_collaborators.user_id', user.id)
    .limit(10)

  return NextResponse.json({
    userId: user.id,
    rawColabs: { data: rawColabs, error: e1 },
    innerJoin: { data: innerJoin, error: e2 },
  })
}
