'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { type Cliente, type Presentacion, colorAvatar } from './types'

export default function ClienteCard({ cliente, presentaciones, userId }: {
  cliente: Cliente; presentaciones: Presentacion[]; userId: string
}) {
  const [favorito, setFavorito] = useState(cliente.esFavorito)
  const ultimaActualizacion = presentaciones.reduce<string | null>((max, p) => (!max || p.updatedAt > max ? p.updatedAt : max), null)
  const miniaturas = presentaciones.slice(0, 4)

  async function toggleFavorito(e: React.MouseEvent) {
    e.preventDefault()
    const sb = createClient()
    if (favorito) await sb.from('presentaciones_clientes_favoritos').delete().eq('user_id', userId).eq('client_id', cliente.id)
    else await sb.from('presentaciones_clientes_favoritos').insert({ user_id: userId, client_id: cliente.id })
    setFavorito(!favorito)
  }

  return (
    <Link href={`/presentaciones/${cliente.id}`} className="block bg-white border border-gray-100 rounded-2xl p-4 hover:border-gray-200 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-semibold shrink-0" style={{ background: colorAvatar(cliente.nombre) }}>
            {cliente.nombre[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{cliente.nombre}</p>
            <p className="text-xs text-gray-400">{presentaciones.length} presentacion{presentaciones.length === 1 ? '' : 'es'}</p>
          </div>
        </div>
        <button onClick={toggleFavorito} className="shrink-0"><Star size={16} className={favorito ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}/></button>
      </div>
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        {miniaturas.length ? miniaturas.map(p => (
          <div key={p.id} className="aspect-video rounded-lg bg-gray-50 overflow-hidden">
            {p.portadaUrl && <img src={p.portadaUrl} alt="" className="w-full h-full object-cover"/>}
          </div>
        )) : Array.from({ length: 1 }).map((_, i) => <div key={i} className="aspect-video rounded-lg bg-gray-50 col-span-4"/>)}
      </div>
      {ultimaActualizacion && (
        <p className="text-xs text-gray-400">Ultima actualizacion {new Date(ultimaActualizacion).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
      )}
    </Link>
  )
}
