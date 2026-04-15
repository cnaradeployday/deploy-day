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
