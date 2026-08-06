// Utilidades para trabajar con columnas `date` de Postgres (sin hora/zona horaria).
//
// new Date("YYYY-MM-DD") se interpreta como medianoche UTC, y toLocaleDateString/
// toISOString la vuelven a convertir usando la zona horaria del navegador o del
// servidor. En una zona con offset negativo (Argentina, UTC-3) eso corre la fecha
// mostrada un dia para atras, y corre la fecha "de hoy" un dia para adelante a
// partir de las ~21hs. Estas funciones evitan por completo ese viaje de ida y
// vuelta por UTC.

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// Formatea una fecha "YYYY-MM-DD" como DD/MM/YYYY, sin pasar por Date.
export function formatDateAR(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

// Formatea una fecha "YYYY-MM-DD" como "1 jul", sin pasar por Date.
export function formatDateShortAR(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  if (!m || !d) return ''
  return `${parseInt(d, 10)} ${MESES_CORTOS[parseInt(m, 10) - 1] ?? ''}`
}

// Fecha de "hoy" en Argentina (UTC-3 fijo, sin horario de verano), en formato
// YYYY-MM-DD. No depende de la zona horaria del navegador ni del servidor
// (el servidor corre en UTC), asi que da el mismo resultado en ambos lados.
export function todayISO(): string {
  const arNow = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return ymd(arNow.getUTCFullYear(), arNow.getUTCMonth() + 1, arNow.getUTCDate())
}

// "YYYY-MM" del mes actual en Argentina, misma logica que todayISO().
export function currentMonthAR(): string {
  return todayISO().slice(0, 7)
}

// Arma un string YYYY-MM-DD a partir de sus partes, con padding, sin pasar por Date.
export function ymd(year: number, month1based: number, day: number): string {
  return `${year}-${String(month1based).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Suma (o resta) dias a una fecha "YYYY-MM-DD" sin pasar por UTC/toISOString.
export function addDaysISO(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const local = new Date(y, m - 1, d + days)
  return ymd(local.getFullYear(), local.getMonth() + 1, local.getDate())
}

// Cantidad de dias del mes indicado (1-12). Solo lee el campo dia de un Date
// local, no hace ninguna conversion UTC.
export function lastDayOfMonth(year: number, month1based: number): number {
  return new Date(year, month1based, 0).getDate()
}

// Primer y ultimo dia (YYYY-MM-DD) del mes "YYYY-MM".
export function monthBounds(mes: string): { primerDia: string; ultimoDia: string } {
  const [anio, mesNum] = mes.split('-').map(Number)
  return {
    primerDia: ymd(anio, mesNum, 1),
    ultimoDia: ymd(anio, mesNum, lastDayOfMonth(anio, mesNum)),
  }
}

// Formatea una fecha "YYYY-MM-DD" como "jul 26" (mes corto + año de 2 digitos).
export function formatMonthShortAR(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const [y, m] = dateStr.split('-')
  if (!y || !m) return ''
  return `${MESES_CORTOS[parseInt(m, 10) - 1] ?? ''} ${y.slice(2)}`
}

// Es dateStr anterior a "hoy" (comparacion lexicografica de YYYY-MM-DD, sin Date)?
export function isPastDate(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  return dateStr < todayISO()
}
