import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Award } from 'lucide-react'
import PerformanceClient from './PerformanceClient'

export default async function PerformanceEquipoPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role, custom_role_id').eq('id', user.id).single()
  const isAdmin = ['admin', 'gerente_operaciones'].includes(profile?.role ?? '')
  let canAccess = isAdmin
  if (!canAccess && profile?.custom_role_id) {
    const { data: perm } = await supabase.from('role_permissions').select('can_read')
      .eq('role_id', profile.custom_role_id).eq('module', 'performance_equipo').single()
    canAccess = perm?.can_read ?? false
  }
  if (!canAccess) redirect('/dashboard')

  const sp = await searchParams
  const mesActual = new Date().toISOString().slice(0, 7)
  const mes = sp.mes ?? mesActual

  const { data: usuarios } = await supabase
    .from('users').select('id, full_name').eq('is_active', true).order('full_name')

  // Reviews for selected month
  const { data: reviewsCurrentMonth, error: tableError } = await supabase
    .from('performance_reviews')
    .select('user_id, month, creatividad, facturacion, velocidad, predisposicion, conocimiento, calidad, reviewed_by')
    .eq('month', mes)

  if (tableError?.message?.includes('does not exist')) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Award size={18} className="text-[#1B9BF0]"/> Performance equipo
        </h1>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <p className="text-sm font-semibold text-amber-800 mb-2">Configuración requerida</p>
          <p className="text-sm text-amber-700 mb-3">Ejecutar en el SQL editor de Supabase:</p>
          <pre className="bg-amber-100 rounded-xl p-4 text-xs text-amber-900 overflow-x-auto">{`CREATE TABLE performance_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  creatividad SMALLINT CHECK (creatividad BETWEEN 1 AND 5),
  facturacion SMALLINT CHECK (facturacion BETWEEN 1 AND 5),
  velocidad SMALLINT CHECK (velocidad BETWEEN 1 AND 5),
  predisposicion SMALLINT CHECK (predisposicion BETWEEN 1 AND 5),
  conocimiento SMALLINT CHECK (conocimiento BETWEEN 1 AND 5),
  calidad SMALLINT CHECK (calidad BETWEEN 1 AND 5),
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, month)
);
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON performance_reviews FOR ALL TO authenticated USING (true) WITH CHECK (true);`}</pre>
        </div>
      </div>
    )
  }

  // All reviews for history
  const { data: allReviews } = await supabase
    .from('performance_reviews')
    .select('user_id, month, creatividad, facturacion, velocidad, predisposicion, conocimiento, calidad, reviewed_by')
    .in('user_id', (usuarios ?? []).map(u => u.id))

  // Build months available from existing reviews + current month
  const existingMonths = [...new Set((allReviews ?? []).map(r => r.month))].sort().reverse()
  const mesesDisponibles = existingMonths.includes(mesActual)
    ? existingMonths
    : [mesActual, ...existingMonths]

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Award size={18} className="text-[#1B9BF0]"/> Performance equipo
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Evaluación mensual del equipo — calificación del 1 al 5</p>
      </div>

      <PerformanceClient
        usuarios={usuarios ?? []}
        reviewsCurrentMonth={(reviewsCurrentMonth ?? []) as any}
        allReviews={(allReviews ?? []) as any}
        mes={mes}
        mesActual={mesActual}
        mesesDisponibles={mesesDisponibles as string[]}
        currentUserId={user.id}
      />
    </div>
  )
}
