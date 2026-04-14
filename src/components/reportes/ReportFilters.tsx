'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Filter, X } from 'lucide-react'

interface FilterOption { value: string; label: string }

interface ReportFiltersProps {
  clientes?: FilterOption[]
  proyectos?: FilterOption[]
  colaboradores?: FilterOption[]
  showDateRange?: boolean
}

export default function ReportFilters({ clientes, proyectos, colaboradores, showDateRange = true }: ReportFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const get = (key: string) => params.get(key) ?? ''

  const update = useCallback((key: string, value: string) => {
    const p = new URLSearchParams(params.toString())
    if (value) p.set(key, value)
    else p.delete(key)
    router.push(`${pathname}?${p.toString()}`)
  }, [params, pathname, router])

  const clear = () => router.push(pathname)

  const hasFilters = ['from', 'to', 'cliente', 'proyecto', 'colaborador'].some(k => params.get(k))

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Filter size={14} className="text-[#1B9BF0]" /> Filtros
        </div>
        {hasFilters && (
          <button onClick={clear} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
            <X size={12}/> Limpiar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {showDateRange && (
          <>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Desde</label>
              <input type="date" value={get('from')} onChange={e => update('from', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Hasta</label>
              <input type="date" value={get('to')} onChange={e => update('to', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] focus:border-transparent" />
            </div>
          </>
        )}

        {clientes && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Cliente</label>
            <select value={get('cliente')} onChange={e => update('cliente', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Todos</option>
              {clientes.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        )}

        {proyectos && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Proyecto</label>
            <select value={get('proyecto')} onChange={e => update('proyecto', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Todos</option>
              {proyectos.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        )}

        {colaboradores && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Colaborador</label>
            <select value={get('colaborador')} onChange={e => update('colaborador', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Todos</option>
              {colaboradores.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {hasFilters && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-50">
          {get('from') && <Chip label={`Desde: ${get('from')}`} onRemove={() => update('from', '')} />}
          {get('to') && <Chip label={`Hasta: ${get('to')}`} onRemove={() => update('to', '')} />}
          {get('cliente') && clientes && <Chip label={`Cliente: ${clientes.find(c => c.value === get('cliente'))?.label}`} onRemove={() => update('cliente', '')} />}
          {get('proyecto') && proyectos && <Chip label={`Proyecto: ${proyectos.find(p => p.value === get('proyecto'))?.label}`} onRemove={() => update('proyecto', '')} />}
          {get('colaborador') && colaboradores && <Chip label={`Colaborador: ${colaboradores.find(u => u.value === get('colaborador'))?.label}`} onRemove={() => update('colaborador', '')} />}
        </div>
      )}
    </div>
  )
}

function Chip({ label, onRemove }: { label?: string; onRemove: () => void }) {
  if (!label) return null
  return (
    <span className="flex items-center gap-1.5 bg-[#E8F4FE] text-[#1B9BF0] text-xs px-2.5 py-1 rounded-full">
      {label}
      <button onClick={onRemove}><X size={11}/></button>
    </span>
  )
}
