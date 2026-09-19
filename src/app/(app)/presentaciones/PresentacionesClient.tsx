'use client'
import { useState, useMemo } from 'react'
import { Search, Plus, LayoutGrid, List, Presentation as PresentationIcon } from 'lucide-react'
import { type Presentacion, type Cliente } from './types'
import ClienteCard from './ClienteCard'
import PresentacionCard from './PresentacionCard'
import NuevaPresentacionModal from './NuevaPresentacionModal'
import EditarPresentacionModal from './EditarPresentacionModal'

type Tab = 'clientes' | 'recientes' | 'favoritas' | 'todas'
type Orden = 'nombre_az' | 'nombre_za' | 'recientes' | 'antiguas'

export default function PresentacionesClient({ presentaciones, clientes, userId, puedeEscribir }: {
  presentaciones: Presentacion[]; clientes: Cliente[]; userId: string; puedeEscribir: boolean
}) {
  const [tab, setTab] = useState<Tab>('clientes')
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<Orden>('recientes')
  const [vista, setVista] = useState<'grid' | 'list'>('grid')
  const [modalNueva, setModalNueva] = useState(false)
  const [presentacionAEditar, setPresentacionAEditar] = useState<Presentacion | null>(null)
  const [presentacionAReemplazar, setPresentacionAReemplazar] = useState<Presentacion | null>(null)

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    let list = presentaciones
    if (q) list = list.filter(p => p.nombre.toLowerCase().includes(q) || p.clienteNombre.toLowerCase().includes(q))
    const sorted = [...list].sort((a, b) => {
      if (orden === 'nombre_az') return a.nombre.localeCompare(b.nombre)
      if (orden === 'nombre_za') return b.nombre.localeCompare(a.nombre)
      if (orden === 'antiguas') return a.updatedAt.localeCompare(b.updatedAt)
      return b.updatedAt.localeCompare(a.updatedAt)
    })
    return sorted
  }, [presentaciones, busqueda, orden])

  const clientesConPresentaciones = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const base = q ? clientes.filter(c => c.nombre.toLowerCase().includes(q)) : clientes
    return base
      .map(c => ({ cliente: c, presentaciones: filtradas.filter(p => p.clientId === c.id) }))
      .filter(g => g.presentaciones.length > 0 || (q && g.cliente.nombre.toLowerCase().includes(q)))
  }, [clientes, filtradas, busqueda])

  const recientes = filtradas.slice(0, 24)
  const favoritas = filtradas.filter(p => p.esFavorita)
  const clientesFavoritos = clientes.filter(c => c.esFavorito)

  function abrirEditar(p: Presentacion) { setPresentacionAEditar(p) }
  function abrirReemplazar(p: Presentacion) { setPresentacionAReemplazar(p) }

  function GridDePresentaciones({ lista }: { lista: Presentacion[] }) {
    if (!lista.length) return (
      <div className="text-center py-16 text-gray-400">
        <PresentationIcon size={28} className="mx-auto mb-3 opacity-30"/>
        <p className="text-sm">No hay presentaciones aca todavia.</p>
      </div>
    )
    return (
      <div className={vista === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3' : 'space-y-2'}>
        {lista.map(p => (
          <PresentacionCard key={p.id} p={p} userId={userId} puedeEscribir={puedeEscribir} vista={vista}
            onEditar={abrirEditar} onReemplazar={abrirReemplazar}/>
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <p className="text-xs font-medium text-gray-400 mb-1">PRESENTACIONES</p>
          <h1 className="text-xl font-semibold text-gray-900">Presentaciones de Clientes</h1>
          <p className="text-sm text-gray-400 mt-0.5">Gestiona y comparti presentaciones, propuestas y materiales con tu equipo y tus clientes.</p>
        </div>
        {puedeEscribir && (
          <button onClick={() => setModalNueva(true)} className="flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 shrink-0">
            <Plus size={15}/> Nueva presentacion
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4 border-b border-gray-100">
        {([['clientes', 'Clientes'], ['recientes', 'Recientes'], ['favoritas', 'Favoritas'], ['todas', 'Todas']] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-2.5 text-sm border-b-2 -mb-px ${tab === k ? 'border-[#1B9BF0] text-[#1B9BF0] font-medium' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300"/>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por cliente o presentacion..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        {tab !== 'clientes' && (
          <select value={orden} onChange={e => setOrden(e.target.value as Orden)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]">
            <option value="recientes">Mas recientes</option>
            <option value="antiguas">Mas antiguas</option>
            <option value="nombre_az">Nombre A-Z</option>
            <option value="nombre_za">Nombre Z-A</option>
          </select>
        )}
        <div className="flex border border-gray-200 rounded-xl overflow-hidden">
          <button onClick={() => setVista('grid')} className={`p-2 ${vista === 'grid' ? 'bg-gray-100' : 'bg-white'}`}><LayoutGrid size={15} className="text-gray-500"/></button>
          <button onClick={() => setVista('list')} className={`p-2 ${vista === 'list' ? 'bg-gray-100' : 'bg-white'}`}><List size={15} className="text-gray-500"/></button>
        </div>
      </div>

      {tab === 'clientes' && (
        clientesConPresentaciones.length ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {clientesConPresentaciones.map(({ cliente, presentaciones: ps }) => (
              <ClienteCard key={cliente.id} cliente={cliente} presentaciones={ps} userId={userId}/>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <PresentationIcon size={28} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm">No hay clientes con presentaciones todavia.</p>
          </div>
        )
      )}

      {tab === 'recientes' && <GridDePresentaciones lista={recientes}/>}

      {tab === 'favoritas' && (
        <div className="space-y-6">
          {clientesFavoritos.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-2">CLIENTES FAVORITOS</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {clientesFavoritos.map(c => (
                  <ClienteCard key={c.id} cliente={c} presentaciones={presentaciones.filter(p => p.clientId === c.id)} userId={userId}/>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-gray-400 mb-2">PRESENTACIONES FAVORITAS</p>
            <GridDePresentaciones lista={favoritas}/>
          </div>
        </div>
      )}

      {tab === 'todas' && <GridDePresentaciones lista={filtradas}/>}

      {modalNueva && (
        <NuevaPresentacionModal open={modalNueva} onClose={() => setModalNueva(false)} clientes={clientes} onDone={() => {}}/>
      )}
      {presentacionAReemplazar && (
        <NuevaPresentacionModal open={true} onClose={() => setPresentacionAReemplazar(null)} clientes={clientes}
          presentacion={presentacionAReemplazar} onDone={() => setPresentacionAReemplazar(null)}/>
      )}
      {presentacionAEditar && (
        <EditarPresentacionModal presentacion={presentacionAEditar} onClose={() => setPresentacionAEditar(null)}/>
      )}
    </div>
  )
}
