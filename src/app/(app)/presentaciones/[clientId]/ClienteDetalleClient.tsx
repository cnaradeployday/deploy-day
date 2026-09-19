'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, Plus, LayoutGrid, List, Star, Presentation as PresentationIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { type Presentacion, type Cliente, colorAvatar } from '../types'
import PresentacionCard from '../PresentacionCard'
import NuevaPresentacionModal from '../NuevaPresentacionModal'
import EditarPresentacionModal from '../EditarPresentacionModal'

type Orden = 'nombre_az' | 'nombre_za' | 'recientes' | 'antiguas'

export default function ClienteDetalleClient({ cliente, presentaciones, userId, puedeEscribir }: {
  cliente: Cliente; presentaciones: Presentacion[]; userId: string; puedeEscribir: boolean
}) {
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<Orden>('recientes')
  const [vista, setVista] = useState<'grid' | 'list'>('grid')
  const [favorito, setFavorito] = useState(cliente.esFavorito)
  const [modalNueva, setModalNueva] = useState(false)
  const [presentacionAEditar, setPresentacionAEditar] = useState<Presentacion | null>(null)
  const [presentacionAReemplazar, setPresentacionAReemplazar] = useState<Presentacion | null>(null)

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    let list = q ? presentaciones.filter(p => p.nombre.toLowerCase().includes(q)) : presentaciones
    return [...list].sort((a, b) => {
      if (orden === 'nombre_az') return a.nombre.localeCompare(b.nombre)
      if (orden === 'nombre_za') return b.nombre.localeCompare(a.nombre)
      if (orden === 'antiguas') return a.updatedAt.localeCompare(b.updatedAt)
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }, [presentaciones, busqueda, orden])

  async function toggleFavorito() {
    const sb = createClient()
    if (favorito) await sb.from('presentaciones_clientes_favoritos').delete().eq('user_id', userId).eq('client_id', cliente.id)
    else await sb.from('presentaciones_clientes_favoritos').insert({ user_id: userId, client_id: cliente.id })
    setFavorito(!favorito)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Link href="/presentaciones" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-4">
        <ArrowLeft size={13}/> Presentaciones
      </Link>

      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-base font-semibold" style={{ background: colorAvatar(cliente.nombre) }}>
            {cliente.nombre[0]?.toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900">{cliente.nombre}</h1>
              <button onClick={toggleFavorito}><Star size={16} className={favorito ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}/></button>
            </div>
            <p className="text-sm text-gray-400">{presentaciones.length} presentacion{presentaciones.length === 1 ? '' : 'es'}</p>
          </div>
        </div>
        {puedeEscribir && (
          <button onClick={() => setModalNueva(true)} className="flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800">
            <Plus size={15}/> Nueva presentacion
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300"/>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar presentacion..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
        </div>
        <select value={orden} onChange={e => setOrden(e.target.value as Orden)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]">
          <option value="recientes">Mas recientes</option>
          <option value="antiguas">Mas antiguas</option>
          <option value="nombre_az">Nombre A-Z</option>
          <option value="nombre_za">Nombre Z-A</option>
        </select>
        <div className="flex border border-gray-200 rounded-xl overflow-hidden">
          <button onClick={() => setVista('grid')} className={`p-2 ${vista === 'grid' ? 'bg-gray-100' : 'bg-white'}`}><LayoutGrid size={15} className="text-gray-500"/></button>
          <button onClick={() => setVista('list')} className={`p-2 ${vista === 'list' ? 'bg-gray-100' : 'bg-white'}`}><List size={15} className="text-gray-500"/></button>
        </div>
      </div>

      {!filtradas.length ? (
        <div className="text-center py-16 text-gray-400">
          <PresentationIcon size={28} className="mx-auto mb-3 opacity-30"/>
          <p className="text-sm">Este cliente todavia no tiene presentaciones.</p>
        </div>
      ) : (
        <div className={vista === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3' : 'space-y-2'}>
          {filtradas.map(p => (
            <PresentacionCard key={p.id} p={p} userId={userId} puedeEscribir={puedeEscribir} vista={vista}
              onEditar={setPresentacionAEditar} onReemplazar={setPresentacionAReemplazar}/>
          ))}
        </div>
      )}

      {modalNueva && (
        <NuevaPresentacionModal open={modalNueva} onClose={() => setModalNueva(false)} clientes={[cliente]} clienteIdFijo={cliente.id} onDone={() => {}}/>
      )}
      {presentacionAReemplazar && (
        <NuevaPresentacionModal open={true} onClose={() => setPresentacionAReemplazar(null)} clientes={[cliente]}
          presentacion={presentacionAReemplazar} onDone={() => setPresentacionAReemplazar(null)}/>
      )}
      {presentacionAEditar && (
        <EditarPresentacionModal presentacion={presentacionAEditar} onClose={() => setPresentacionAEditar(null)}/>
      )}
    </div>
  )
}
