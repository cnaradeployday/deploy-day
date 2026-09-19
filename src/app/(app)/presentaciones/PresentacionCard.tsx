'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Star, MoreVertical, ExternalLink, Link2, Pencil, RefreshCw, Copy, EyeOff, Eye, Trash2, Lock, Clock, Presentation as PresentationIcon,
} from 'lucide-react'
import { type Presentacion, ESTADO_LABEL, ESTADO_COLOR, urlPublica, badgeVisibilidad } from './types'

const BADGE_COLOR: Record<string, string> = {
  PU: 'bg-blue-50 text-blue-600',
  US: 'bg-purple-50 text-purple-600',
  PR: 'bg-gray-100 text-gray-500',
}

function BadgeVisibilidad({ p, className = '' }: { p: Presentacion; className?: string }) {
  const b = badgeVisibilidad(p)
  return <span title={b.title} className={`text-xs font-semibold px-1.5 py-0.5 rounded ${BADGE_COLOR[b.label]} ${className}`}>{b.label}</span>
}

export default function PresentacionCard({
  p, userId, puedeEscribir, vista = 'grid', onEditar, onReemplazar,
}: {
  p: Presentacion
  userId: string
  puedeEscribir: boolean
  vista?: 'grid' | 'list'
  onEditar: (p: Presentacion) => void
  onReemplazar: (p: Presentacion) => void
}) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [favorita, setFavorita] = useState(p.esFavorita)
  const [busy, setBusy] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const puedeAdministrar = puedeEscribir && (p.esMia)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function toggleFavorita() {
    const sb = createClient()
    if (favorita) {
      await sb.from('presentaciones_favoritos').delete().eq('user_id', userId).eq('presentacion_id', p.id)
    } else {
      await sb.from('presentaciones_favoritos').insert({ user_id: userId, presentacion_id: p.id })
    }
    setFavorita(!favorita)
  }

  function copiarUrl() {
    navigator.clipboard.writeText(urlPublica(p.slug))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  async function despublicarOPublicar() {
    setBusy(true)
    const nuevoEstado = p.estado === 'publicada' ? 'despublicada' : 'publicada'
    await fetch(`/api/presentaciones/${p.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado }),
    })
    setBusy(false)
    router.refresh()
  }

  async function duplicar() {
    setBusy(true)
    await fetch(`/api/presentaciones/${p.id}/duplicate`, { method: 'POST' })
    setBusy(false)
    router.refresh()
  }

  async function eliminar() {
    if (!confirm(`¿Eliminar definitivamente "${p.nombre}"? Esta accion no se puede deshacer.`)) return
    setBusy(true)
    await fetch(`/api/presentaciones/${p.id}`, { method: 'DELETE' })
    setBusy(false)
    router.refresh()
  }

  const menu = (
    <div className="absolute right-0 top-8 w-56 bg-white border border-gray-100 rounded-xl shadow-lg z-30 py-1.5 text-sm">
      {p.estado === 'publicada' && (
        <a href={urlPublica(p.slug)} target="_blank" rel="noopener" className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-gray-50 text-gray-700">
          <ExternalLink size={14}/> Abrir
        </a>
      )}
      <button onClick={copiarUrl} className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-gray-50 text-gray-700 text-left">
        <Link2 size={14}/> {copiado ? 'Copiada!' : 'Copiar URL'}
      </button>
      {puedeAdministrar && <>
        <button onClick={() => { setMenuOpen(false); onEditar(p) }} className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-gray-50 text-gray-700 text-left">
          <Pencil size={14}/> Editar
        </button>
        <button onClick={() => { setMenuOpen(false); onReemplazar(p) }} className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-gray-50 text-gray-700 text-left">
          <RefreshCw size={14}/> Reemplazar archivos
        </button>
        <button onClick={duplicar} className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-gray-50 text-gray-700 text-left">
          <Copy size={14}/> Duplicar
        </button>
        <button onClick={despublicarOPublicar} className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-gray-50 text-gray-700 text-left">
          {p.estado === 'publicada' ? <><EyeOff size={14}/> Despublicar</> : <><Eye size={14}/> Publicar</>}
        </button>
        <div className="my-1 border-t border-gray-50"/>
        <button onClick={eliminar} className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-red-50 text-red-600 text-left">
          <Trash2 size={14}/> Eliminar
        </button>
      </>}
    </div>
  )

  if (vista === 'list') {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 bg-white border border-gray-100 rounded-xl hover:border-gray-200 transition-colors ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="w-11 h-11 rounded-lg bg-gray-50 overflow-hidden shrink-0 flex items-center justify-center">
          {p.portadaUrl ? <img src={p.portadaUrl} alt="" className="w-full h-full object-cover"/> : <PresentationIcon size={16} className="text-gray-300"/>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">{p.nombre}</p>
          <p className="text-xs text-gray-400 truncate">{p.clienteNombre} · {new Date(p.updatedAt).toLocaleDateString('es-AR')}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${ESTADO_COLOR[p.estado]}`}>{ESTADO_LABEL[p.estado]}</span>
        <BadgeVisibilidad p={p} className="shrink-0"/>
        {p.tieneClave && <Lock size={12} className="text-gray-400 shrink-0"/>}
        <button onClick={toggleFavorita} className="shrink-0"><Star size={16} className={favorita ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}/></button>
        <div className="relative shrink-0" ref={menuRef}>
          <button onClick={() => setMenuOpen(o => !o)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><MoreVertical size={16}/></button>
          {menuOpen && menu}
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white border border-gray-100 rounded-2xl hover:border-gray-200 transition-colors ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="aspect-video bg-gray-50 relative flex items-center justify-center rounded-t-2xl overflow-hidden">
        {p.portadaUrl ? <img src={p.portadaUrl} alt="" className="w-full h-full object-cover"/> : <PresentationIcon size={28} className="text-gray-300"/>}
        <button onClick={toggleFavorita} className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 hover:bg-white">
          <Star size={14} className={favorita ? 'fill-amber-400 text-amber-400' : 'text-gray-400'}/>
        </button>
        <BadgeVisibilidad p={p} className="absolute top-2 left-2 shadow-sm"/>
        <span className={`absolute bottom-2 left-2 text-xs px-2 py-0.5 rounded-full ${ESTADO_COLOR[p.estado]}`}>{ESTADO_LABEL[p.estado]}</span>
      </div>
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{p.nombre}</p>
            <p className="text-xs text-gray-400 truncate">{p.clienteNombre}</p>
          </div>
          <div className="relative shrink-0" ref={menuRef}>
            <button onClick={() => setMenuOpen(o => !o)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><MoreVertical size={16}/></button>
            {menuOpen && menu}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
          <span>{new Date(p.updatedAt).toLocaleDateString('es-AR')}</span>
          {p.tieneClave && <Lock size={11}/>}
          {p.linkExpiraAt && <Clock size={11}/>}
        </div>
      </div>
    </div>
  )
}
