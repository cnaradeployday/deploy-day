import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const serverSupabase = await createServerClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await serverSupabase.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Solo admins pueden crear usuarios' }, { status: 403 })

    const { email, full_name, role, hourly_cost, currency, password } = await req.json()

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: newUser, error } = await adminSupabase.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name, role }
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await adminSupabase.from('users').update({
      full_name, role,
      hourly_cost: hourly_cost ? parseFloat(hourly_cost) : null,
      currency: currency ?? 'ARS'
    }).eq('id', newUser.user.id)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
