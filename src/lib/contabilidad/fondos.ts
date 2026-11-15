import { lastDayOfMonth, ymd } from '@/lib/utils/date'

// Fondos comunes de inversión en los que invierte la sociedad. Cada uno tiene su propio valor de cuota,
// así que cuotas, valuación e intereses se calculan por separado.
export const FONDOS_FCI = ['Fima Premium', 'Fima Ahorro Pesos'] as const
export type FondoFci = typeof FONDOS_FCI[number]

// Sugiere el fondo al importar un resumen, por el valor de la cuota (Premium ≈ $570–675, Ahorro Pesos ≈ $83–86).
export function fondoSugeridoPorTc(tc: number): FondoFci {
  return tc > 0 && tc < 300 ? 'Fima Ahorro Pesos' : 'Fima Premium'
}

// TC vigente de un fondo: el más reciente entre el último cierre mensual cargado (vale al último día de ese mes)
// y el último movimiento. Si empatan, gana el cierre cargado a mano.
export function tcMasReciente(
  cierre: { mes: string; tc_fondo: number | string } | null | undefined,
  movimiento: { fecha: string; tc_fondo: number | string } | null | undefined,
): { tc: number; fecha: string } | null {
  let cierreFecha: string | null = null
  if (cierre) {
    const [y, m] = cierre.mes.split('-').map(Number)
    cierreFecha = ymd(y, m, lastDayOfMonth(y, m))
  }
  if (cierre && cierreFecha && (!movimiento || cierreFecha >= movimiento.fecha)) return { tc: Number(cierre.tc_fondo), fecha: cierreFecha }
  if (movimiento) return { tc: Number(movimiento.tc_fondo), fecha: movimiento.fecha }
  return null
}
