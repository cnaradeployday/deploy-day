export type Stage = 'contacto_inicial' | 'reunion_relevamiento' | 'cotizacion_enviada' | 'negociacion' | 'ganado' | 'perdido'

export const STAGES: { key: Stage; label: string; probability: number }[] = [
  { key: 'contacto_inicial',     label: 'Contacto inicial',       probability: 25 },
  { key: 'reunion_relevamiento', label: 'Reunión / Relevamiento', probability: 25 },
  { key: 'cotizacion_enviada',   label: 'Cotización enviada',     probability: 50 },
  { key: 'negociacion',          label: 'Negociación',            probability: 75 },
  { key: 'ganado',               label: 'Ganado',                 probability: 100 },
  { key: 'perdido',              label: 'Perdido',                probability: 0 },
]

export const OPEN_STAGES: Stage[] = ['contacto_inicial', 'reunion_relevamiento', 'cotizacion_enviada', 'negociacion']

export const STAGE_LABELS = Object.fromEntries(STAGES.map(s => [s.key, s.label])) as Record<Stage, string>
export const STAGE_PROBABILITY = Object.fromEntries(STAGES.map(s => [s.key, s.probability])) as Record<Stage, number>

// Probabilidad de cierre como categoria (en vez de un numero libre), mapeada a un valor
// representativo para poder seguir sumando/ordenando.
export type ProbabilityLevel = 'alta' | 'media' | 'baja'

export const PROBABILITY_LEVELS: { key: ProbabilityLevel; label: string; value: number; color: string }[] = [
  { key: 'alta',  label: 'Alta',  value: 75, color: 'bg-green-50 text-green-600' },
  { key: 'media', label: 'Media', value: 50, color: 'bg-amber-50 text-amber-600' },
  { key: 'baja',  label: 'Baja',  value: 25, color: 'bg-gray-100 text-gray-500' },
]

export const PROBABILITY_LABELS = Object.fromEntries(PROBABILITY_LEVELS.map(l => [l.key, l.label])) as Record<ProbabilityLevel, string>
export const PROBABILITY_COLORS = Object.fromEntries(PROBABILITY_LEVELS.map(l => [l.key, l.color])) as Record<ProbabilityLevel, string>

// Clasifica cualquier probabilidad numerica (0-100) en Alta/Media/Baja.
export function classifyProbability(value: number): ProbabilityLevel {
  if (value >= 66) return 'alta'
  if (value >= 33) return 'media'
  return 'baja'
}

export const SERVICE_LABELS: Record<string, string> = {
  marketing_digital: 'Marketing digital',
  desarrollo_producto: 'Desarrollo de producto',
  desarrollo_software: 'Desarrollo de software',
  otro: 'Otro',
}

export const SOURCES = ['Referido', 'Web', 'LinkedIn', 'Evento', 'Otro']

export type Prospect = {
  id: string
  client_id: string | null
  client: { id: string; name: string } | null
  prospect_name: string
  project_name: string
  contact_email: string | null
  contact_phone: string | null
  stage: Stage
  probability: number
  expected_close_date: string | null
  service_type: string
  source: string | null
  responsible_id: string | null
  next_action: string | null
  next_action_date: string | null
  lost_reason: string | null
  notes: string | null
  currency: 'ARS' | 'USD'
  one_shot_amount: number | null
  monthly_fee: number | null
  estimated_months: number | null
  estimated_hours: number | null
  hourly_rate_service: number | null
  quoting_hours: number | null
  quoting_hourly_rate: number | null
  won_at: string | null
  lost_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// Valor total del contrato: one-shot + (fee mensual x meses estimados), si ambos estan cargados.
export function dealTotal(p: Pick<Prospect, 'one_shot_amount' | 'monthly_fee' | 'estimated_months'>): number {
  const oneShot = p.one_shot_amount ?? 0
  const recurring = p.monthly_fee && p.estimated_months ? p.monthly_fee * p.estimated_months : 0
  return oneShot + recurring
}
