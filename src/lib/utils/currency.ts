export type Currency = 'ARS' | 'USD'

export const CURRENCIES: { value: Currency; label: string }[] = [
  { value: 'ARS', label: '$ ARS' },
  { value: 'USD', label: 'USD' },
]

export function formatMoney(amount: number, currency: Currency = 'ARS'): string {
  if (currency === 'USD') {
    return 'USD ' + amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return '$' + amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function convertToARS(amount: number, currency: Currency, cotizacion: number): number {
  if (currency === 'ARS') return amount
  return amount * cotizacion
}

export function convertToUSD(amount: number, currency: Currency, cotizacion: number): number {
  if (currency === 'USD') return amount
  if (cotizacion === 0) return 0
  return amount / cotizacion
}

// Busca, entre una lista de cotizaciones, la más cercana al mes dado (formato 'YYYY-MM')
export function findClosestCotizacion(
  mes: string,
  cotizaciones: { fecha: string; usd_ars: number }[]
): number | null {
  if (cotizaciones.length === 0) return null
  const target = new Date(`${mes}-15T00:00:00`).getTime()
  let best = cotizaciones[0]
  let bestDiff = Math.abs(new Date(best.fecha).getTime() - target)
  for (const c of cotizaciones) {
    const diff = Math.abs(new Date(c.fecha).getTime() - target)
    if (diff < bestDiff) { bestDiff = diff; best = c }
  }
  return best.usd_ars
}
