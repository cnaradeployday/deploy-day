'use client'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export type MultiSelectOption = { value: string; label: string }

export default function MultiSelectFilter({ label, options, selected, onChange }: {
  label: string
  options: MultiSelectOption[]
  selected: string[]
  onChange: (values: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value])
  }

  return (
    <div className="relative" ref={ref}>
      <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white hover:border-gray-300 transition-all">
        <span className={selected.length ? 'text-gray-900 truncate' : 'text-gray-400'}>
          {selected.length ? `${label} (${selected.length})` : 'Todos'}
        </span>
        <ChevronDown size={14} className="text-gray-400 shrink-0"/>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-64 max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg p-2">
          <div className="flex items-center justify-between px-1 pb-2 mb-1 border-b border-gray-50">
            <button type="button" onClick={() => onChange(options.map(o => o.value))} className="text-xs text-[#1B9BF0] hover:underline">
              Seleccionar todos
            </button>
            <button type="button" onClick={() => onChange([])} className="text-xs text-gray-400 hover:text-gray-600 hover:underline">
              Deseleccionar todos
            </button>
          </div>
          {options.length === 0 ? (
            <p className="text-xs text-gray-400 px-1 py-1">Sin opciones</p>
          ) : options.map(o => (
            <label key={o.value} className="flex items-center gap-2 px-1 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)}
                className="rounded border-gray-300 text-[#1B9BF0] focus:ring-[#1B9BF0]"/>
              <span className="truncate">{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
