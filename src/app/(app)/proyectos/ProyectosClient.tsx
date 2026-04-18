'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2, FolderKanban, ChevronUp, ChevronDown, Download } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'

const serviceLabels: Record<string, string> = {
  marketing_digital: 'Marketing digital',
  desarrollo_producto: 'Desarrollo de producto',
  desarrollo_software: 'Desarrollo de software',
  otro: 'Otro',
}

function formatDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

type SortKey = 'name' | 'cliente' | 'service_type' | 'sold_hours' | 'start_date' | 'end_date' | 'is_active'

export default function ProyectosClient({ proyectos, clientes, isAdmin, canDelete }: {
  proyectos: any[]
  clientes: any[]
  isAdmin: boolean
  canDelete: boolean
}) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filterCliente, setFilterCliente] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterActivo, setFilterActivo] = useState('')
  const [filterBusqueda, setFilterBusqueda] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    let list = [...proyectos]
    if (filterBusqueda) list = list.filter(p => p.name.toLowerCase().includes(filterBusqueda.toLowerCase()))
    if (filterCliente) list = list.filter(p => (p.client as any)?.id === filterCliente)
    if (filterTipo) list = list.filter(p => p.service_type === filterTipo)
    if (filterActivo === 'activo') list = list.filter(p => p.is_active)
    if (filterActivo === 'inactivo') list = list.filter(p => !p.is_active)
    list.sort((a, b) => {
      let av: any, bv: any
      if (sortKey === 'cliente') { av = (a.client as any)?.name ?? ''; bv = (b.client as any)?.name ?? '' }
      else if (sortKey === 'service_type') { av = serviceLabels[a.service_type] ?? ''; bv = serviceLabels[b.service_type] ?? '' }
      else { av = a[sortKey] ?? ''; bv = b[sortKey] ?? '' }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [proyectos, filterBusqueda, filterCliente, filterTipo, filterActivo, sortKey, sortDir])

  async function handleDelete(p: any) {
    if (!confirm(`¿Eliminar "${p.name}" y todas sus tareas? Esta acción no se puede deshacer.`)) return
    setDeletingId(p.id)
    const sb = createClient()
    const { data: tareas } = await sb.from('tasks').select('id').eq('project_id', p.id)
    const taskIds = (tareas ?? []).map((t: any) => t.id)
    if (taskIds.length > 0) {
      await sb.from('time_entries').delete().in('task_id', taskIds)
      await sb.from('task_collaborators').delete().in('task_id', taskIds)
      await sb.from('task_comments').delete().in('task_id', taskIds)
      await sb.from('tasks').delete().in('id', taskIds)
    }
    await sb.from('project_hour_segments').delete().eq('project_id', p.id)
    const { error } = await sb.from('projects').delete().eq('id', p.id)
    if (error) { alert('Error: ' + error.message); setDeletingId(null); return }
    router.refresh()
    setDeletingId(null)
  }

  function exportar() {
    const data = filtered.map(p => ({
      Proyecto: p.name,
      Cliente: (p.client as any)?.name ?? '—',
      'Tipo de servicio': serviceLabels[p.service_type] ?? p.service_type,
      'Horas vendidas': p.sold_hours,
      Inicio: formatDate(p.start_date),
      Fin: formatDate(p.end_date),
      Estado: p.is_active ? 'Activo' : 'Inactivo',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Proyectos')
    XLSX.writeFile(wb, 'proyectos.xlsx')
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronUp size={11} className="text-gray-300"/>
    return sortDir === 'asc' ? <ChevronUp size={11} className="text-[#1B9BF0]"/> : <ChevronDown size={11} className="text-[#1B9BF0]"/>
  }

  const hasFilters = filterBusqueda || filterCliente || filterTipo || filterActivo

  const cols = [
    { key: 'name' as SortKey,         label: 'Proyecto',          span: 'col-span-2' },
    { key: 'cliente' as SortKey,       label: 'Cliente',           span: 'col-span-2' },
    { key: 'service_type' as SortKey,  label: 'Tipo de servicio',  span: 'col-span-2' },
    { key: 'sold_hours' as SortKey,    label: 'Horas',             span: 'col-span-1 text-right' },
    { key: 'start_date' as SortKey,    label: 'Inicio',            span: 'col-span-1 text-center' },
    { key: 'end_date' as SortKey,      label: 'Fin',               span: 'col-span-1 text-center' },
    { key: 'is_active' as SortKey,     label: 'Estado',            span: 'col-span-1 text-center' },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Proyectos</h1>
          <p className="text-sm text-gray-400 mt-0.5">{filtered.length} de {proyectos.length} proyectos</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportar}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-all">
            <Download size={14}/> Excel
          </button>
          <Link href="/proyectos/nuevo"
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">
            <Plus size={15}/> Nuevo proyecto
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Buscar</label>
            <input type="text" value={filterBusqueda} onChange={e => setFilterBusqueda(e.target.value)}
              placeholder="Nombre del proyecto..."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Cliente</label>
            <select value={filterCliente} onChange={e => setFilterCliente(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Todos</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Tipo de servicio</label>
            <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Todos</option>
              {Object.entries(serviceLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Estado</label>
            <select value={filterActivo} onChange={e => setFilterActivo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
              <option value="">Todos</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
        </div>
        {hasFilters && (
          <div className="flex justify-end mt-2">
            <button onClick={() => { setFilterBusqueda(''); setFilterCliente(''); setFilterTipo(''); setFilterActivo('') }}
              className="text-xs text-gray-400 hover:text-gray-600">Limpiar filtros</button>
          </div>
        )}
      </div>

      {!filtered.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          <FolderKanban size={32} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">Sin proyectos{hasFilters ? ' para estos filtros' : ''}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 px-5 py-3 text-xs font-medium text-gray-400 bg-gray-50 border-b border-gray-100">
            {cols.map(({ key, label, span }) => (
              <button key={key} onClick={() => toggleSort(key)}
                className={span + ' flex items-center gap-1 hover:text-gray-600 transition-colors ' + (span.includes('right') ? 'justify-end' : span.includes('center') ? 'justify-center' : '')}>
                {label} <SortIcon k={key}/>
              </button>
            ))}
            <span className="col-span-1"/>
          </div>

          {/* Filas */}
          {filtered.map(p => (
            <div key={p.id} className="grid grid-cols-12 px-5 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 items-center transition-colors">
              <div className="col-span-2">
                <Link href={`/proyectos/${p.id}`} className="text-sm font-medium text-gray-900 hover:text-[#1B9BF0] transition-colors block truncate">
                  {p.name}
                </Link>
              </div>
              <span className="col-span-2 text-sm text-gray-600 truncate">{(p.client as any)?.name ?? '—'}</span>
              <span className="col-span-2 text-xs text-gray-500">{serviceLabels[p.service_type] ?? p.service_type}</span>
              <span className="col-span-1 text-sm font-semibold text-gray-900 text-right">{p.sold_hours}h</span>
              <span className="col-span-1 text-xs text-gray-500 text-center">{formatDate(p.start_date)}</span>
              <span className="col-span-1 text-xs text-gray-500 text-center">{formatDate(p.end_date)}</span>
              <div className="col-span-1 flex justify-center">
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  {p.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div className="col-span-1 flex items-center justify-end gap-1">
                {isAdmin && (
                  <Link href={`/proyectos/${p.id}/editar`}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
                    <Pencil size={13}/>
                  </Link>
                )}
                {canDelete && (
                  <button onClick={() => handleDelete(p)} disabled={deletingId === p.id}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50">
                    <Trash2 size={13}/>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
