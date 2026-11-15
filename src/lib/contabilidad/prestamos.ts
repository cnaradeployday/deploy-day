import type { SupabaseClient } from '@supabase/supabase-js'

// Intereses de préstamos: se devengan solos mes a mes a partir de las condiciones del préstamo
// (monto × tasa anual ÷ 12). Los meses cargados a mano en prestamo_devengamientos tienen prioridad
// (sirven para corregir un monto puntual), y los demás meses se calculan sin necesidad de cargarlos.

export type PrestamoBase = { id: string; fecha_inicio: string; fecha_fin: string; monto: number | string; tasa_interes_anual: number | string }
export type DevengamientoReal = { id: string; prestamo_id: string; mes: string; monto: number | string }
export type DevengamientoMes = { id: string | null; prestamo_id: string; mes: string; monto: number; automatico: boolean }

const pad = (n: number) => String(n).padStart(2, '0')

// Cuota mensual de interés, redondeada al peso (igual que los meses que se venían cargando a mano).
export function interesMensualPrestamo(p: Pick<PrestamoBase, 'monto' | 'tasa_interes_anual'>): number {
  return Math.round(Number(p.monto) * Number(p.tasa_interes_anual) / 100 / 12)
}

// Meses ("YYYY-MM-01") en los que el préstamo devenga intereses: `plazo` meses empezando el mes siguiente
// al inicio (si arranca el día 1, ese mismo mes). Ej.: 30/01/2026 → 30/01/2027 devenga feb-26 … ene-27.
export function mesesDevengoPrestamo(p: Pick<PrestamoBase, 'fecha_inicio' | 'fecha_fin'>): string[] {
  const [yi, mi, di] = p.fecha_inicio.split('-').map(Number)
  const [yf, mf] = p.fecha_fin.split('-').map(Number)
  const plazo = (yf - yi) * 12 + (mf - mi)
  let y = yi, m = di === 1 ? mi : mi + 1
  const out: string[] = []
  for (let i = 0; i < plazo; i++) {
    if (m > 12) { m = 1; y++ }
    out.push(`${y}-${pad(m)}-01`)
    m++
  }
  return out
}

// Combina lo cargado a mano con lo calculado, hasta `hastaMes` ("YYYY-MM") inclusive.
export function combinarDevengamientos(prestamos: PrestamoBase[], reales: DevengamientoReal[], hastaMes: string): DevengamientoMes[] {
  const hasta = `${hastaMes}-01`
  const out: DevengamientoMes[] = []
  for (const p of prestamos) {
    const propios = new Map(reales.filter(r => r.prestamo_id === p.id).map(r => [r.mes.slice(0, 10), r]))
    const cuota = interesMensualPrestamo(p)
    const usados = new Set<string>()
    for (const mes of mesesDevengoPrestamo(p)) {
      if (mes > hasta) continue
      const real = propios.get(mes)
      usados.add(mes)
      out.push(real
        ? { id: real.id, prestamo_id: p.id, mes, monto: Number(real.monto), automatico: false }
        : { id: null, prestamo_id: p.id, mes, monto: cuota, automatico: true })
    }
    // Meses cargados a mano fuera de la vigencia: se respetan tal cual.
    for (const [mes, real] of propios) {
      if (usados.has(mes) || mes > hasta) continue
      out.push({ id: real.id, prestamo_id: p.id, mes, monto: Number(real.monto), automatico: false })
    }
  }
  return out.sort((a, b) => a.mes.localeCompare(b.mes))
}

export async function devengamientosPrestamosHasta(sb: SupabaseClient, hastaMes: string): Promise<DevengamientoMes[]> {
  const [{ data: prestamos }, { data: reales }] = await Promise.all([
    sb.from('prestamos').select('id, fecha_inicio, fecha_fin, monto, tasa_interes_anual'),
    sb.from('prestamo_devengamientos').select('id, prestamo_id, mes, monto'),
  ])
  return combinarDevengamientos(prestamos ?? [], reales ?? [], hastaMes)
}
