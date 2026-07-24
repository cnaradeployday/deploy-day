'use client'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'

export interface SearchableSelectOption {
  id: string
  label: string
  sublabel?: string
}

interface Props {
  options: SearchableSelectOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
}

export default function SearchableSelect({
  options, value, onChange, placeholder = 'Seleccionar...',
  searchPlaceholder = 'Escribí para buscar...', disabled, className,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.id === value)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? options.filter(o => (o.label + ' ' + (o.sublabel ?? '')).toLowerCase().includes(q))
    : options

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <div
        onClick={() => !disabled && setOpen(o => !o)}
        className={`w-full px-4 py-2.5 border rounded-xl text-sm flex items-center justify-between gap-2 transition-all ${
          disabled ? 'bg-gray-50 text-gray-300 cursor-not-allowed' : 'bg-white cursor-pointer'
        } ${open ? 'border-[#1B9BF0] ring-2 ring-[#1B9BF0]' : 'border-gray-200'}`}
      >
        <span className={`truncate ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {selected && !disabled && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(''); setQuery('') }}
              className="text-gray-300 hover:text-red-400"
            >
              <X size={13} />
            </button>
          )}
          <ChevronDown size={14} className="text-gray-400" />
        </div>
      </div>
      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full px-4 py-2.5 text-sm border-b border-gray-100 focus:outline-none"
          />
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-400">Sin resultados</div>
            )}
            {filtered.map(o => (
              <div
                key={o.id}
                onClick={() => { onChange(o.id); setOpen(false); setQuery('') }}
                className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-gray-50 ${
                  o.id === value ? 'bg-blue-50 text-[#1B9BF0]' : 'text-gray-700'
                }`}
              >
                {o.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
