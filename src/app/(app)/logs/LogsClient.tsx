'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Activity, ChevronLeft, ChevronRight, Filter } from 'lucide-react'

const sectionColors: Record<string, string> = {
  login:      'bg-blue-50 text-blue-600',
  tareas:     'bg-amber-50 text-amber-600',
  proyectos:  'bg-purple-50 text-purple-600',
  usuarios:   'bg-green-50 text-green-600',
  horas:      'bg-teal-50 text-teal-600',
  'mis-tareas': 'bg-orange-50 text-orange-600',
  chat:       'bg-pink-50 text-pink-600',
  anuncios:   'bg-red-50 text-red-600',
}

const actionIcons: Record<string, string> = {
  crear: '➕',
  editar: '✏️',
  eliminar: '🗑️',
  login: '🔐',
  logout: '🚪',
  'cambiar estado': '🔄',
  'cambiar contraseña': '🔑',
  'subir avatar': '🖼️',
  'cargar horas': '⏱️',
  'cambiar rol': '👤',
}

function getActionIcon(action: string): string {
  const key = Object.keys(actionIcons).find(k => action.toLowerCase().includes(k))
  return key ? actionIcons[key] : '📝'
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export default function LogsClient({
  logs, total, page, perPage, filters, users, sections
}: {
  logs: any[]
  total: number
  page: number
  perPage: number
  filters: { section: string; userId: string }
  users: { id: string; full_name: string }[]
  sections: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const update = useCallback((key: string, value: string) => {
    const p = new URLSearchParams(params.toString())
    if (value) p.set(key, value); else p.delete(key)
    p.delete('page')
    router.push(pathname + '?' + p.toString())
  }, [params, pathname, router])

  const setPage = (p: number) => {
    const sp = new URLSearchParams(params.toString())
    sp.set('page', String(p))
    router.push(pathname + '?' + sp.toString())
  }

  const totalPages = Math.ceil(total / perPage)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Activity size={18} className="text-[#1B9BF0]"/> Logs de actividad
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{total.toLocaleString('es-AR')} registros</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex flex-wrap gap-3 items-center">
        <Filter size={14} className="text-gray-400"/>
        <select value={filters.section} onChange={e => update('section', e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
          <option value="">Todas las secciones</option>
          {sections.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select value={filters.userId} onChange={e => update('user', e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
          <option value="">Todos los usuarios</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
        {(filters.section || filters.userId) && (
          <button onClick={() => { update('section', ''); update('user', '') }}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5">
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {logs.length === 0 ? (
          <div className="py-16 text-center">
            <Activity size={32} className="text-gray-200 mx-auto mb-3"/>
            <p className="text-sm text-gray-400">Sin actividad registrada</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 w-36">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 w-36">Usuario</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 w-24">Sección</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Acción</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(log.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-gray-700">{log.user_name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sectionColors[log.section] ?? 'bg-gray-100 text-gray-600'}`}>
                      {log.section}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-700 flex items-center gap-1.5">
                      <span>{getActionIcon(log.action)}</span>
                      <span>{log.action}</span>
                      {log.entity_name && <span className="text-gray-400">· {log.entity_name}</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate">{log.detail ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-400">
            Mostrando {((page - 1) * perPage) + 1}–{Math.min(page * perPage, total)} de {total}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(page - 1)} disabled={page === 1}
              className="p-2 rounded-xl border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-all">
              <ChevronLeft size={14}/>
            </button>
            <span className="text-xs text-gray-600 px-2">Página {page} de {totalPages}</span>
            <button onClick={() => setPage(page + 1)} disabled={page === totalPages}
              className="p-2 rounded-xl border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-all">
              <ChevronRight size={14}/>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
