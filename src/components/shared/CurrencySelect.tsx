'use client'
import { CURRENCIES, Currency } from '@/lib/utils/currency'

export default function CurrencySelect({ value, onChange, className = '' }: {
  value: Currency
  onChange: (v: Currency) => void
  className?: string
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as Currency)}
      className={'px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white ' + className}>
      {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
    </select>
  )
}
