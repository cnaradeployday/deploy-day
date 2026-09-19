'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, RotateCcw, Users2, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Presentacion } from './types'

type Version = { numero_version: number; created_at: string }
type Usuario = { id: string; full_name: string; nickname: string | null }

export default function EditarPresentacionModal({ presentacion, onClose }: {
  presentacion: Presentacion
  onClose: () => void
}) {
  const router = useRouter()
  const [nombre, setNombre] = useState(presentacion.nombre)
  const [descripcion, setDescripcion] = useState(presentacion.descripcion ?? '')
  const [visibilidad, setVisibilidad] = useState(presentacion.visibilidad)
  const [protegida, setProtegida] = useState(presentacion.tieneClave)
  const [password, setPassword] = useState('')
  const [tieneVencimiento, setTieneVencimiento] = useState(!!presentacion.linkExpiraAt)
  const [vencimiento, setVencimiento] = useState(presentacion.linkExpiraAt?.slice(0, 10) ?? '')
  const [tags, setTags] = useState('')
  const [versiones, setVersiones] = useState<Version[]>([])
  const [totalVistas, setTotalVistas] = useState<number | null>(null)
  const [ultimaVista, setUltimaVista] = useState<string | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [compartidoCon, setCompartidoCon] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    supabaseCargarExtra()
    async function supabaseCargarExtra() {
      const [{ data: vers }, { count }, { data: ultima }, { data: tagsRel }, { data: users }, { data: shares }] = await Promise.all([
        sb.from('presentaciones_versiones').select('numero_version, created_at').eq('presentacion_id', presentacion.id).order('numero_version', { ascending: false }),
        sb.from('presentaciones_vistas').select('id', { count: 'exact', head: true }).eq('presentacion_id', presentacion.id),
        sb.from('presentaciones_vistas').select('visto_at').eq('presentacion_id', presentacion.id).order('visto_at', { ascending: false }).limit(1).maybeSingle(),
        sb.from('presentaciones_tags_rel').select('presentaciones_tags(nombre)').eq('presentacion_id', presentacion.id),
        sb.from('users').select('id, full_name, nickname').order('full_name'),
        sb.from('presentaciones_shares').select('user_id').eq('presentacion_id', presentacion.id),
      ])
      setVersiones(vers ?? [])
      setTotalVistas(count ?? 0)
      setUltimaVista(ultima?.visto_at ?? null)
      setTags((tagsRel ?? []).map((t: any) => t.presentaciones_tags?.nombre).filter(Boolean).join(', '))
      setUsuarios(users ?? [])
      setCompartidoCon((shares ?? []).map(s => s.user_id))
    }
  }, [presentacion.id])

  async function guardar() {
    setGuardando(true); setError(null)
    const body: Record<string, unknown> = {
      nombre, descripcion: descripcion || null, visibilidad,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    }
    if (protegida && password) body.password = password
    if (!protegida) body.password = null
    body.linkExpiraAt = tieneVencimiento && vencimiento ? new Date(vencimiento + 'T23:59:59').toISOString() : null

    const res = await fetch(`/api/presentaciones/${presentacion.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    if (!res.ok) { setError('No se pudo guardar.'); setGuardando(false); return }
    setGuardando(false)
    router.refresh()
    onClose()
  }

  async function restaurar(numero: number) {
    if (!confirm(`¿Restaurar la version ${numero}? Pasara a ser la version publicada.`)) return
    await fetch(`/api/presentaciones/${presentacion.id}/restore`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ numero_version: numero }),
    })
    router.refresh()
  }

  async function toggleCompartir(userId: string) {
    const sb = createClient()
    if (compartidoCon.includes(userId)) {
      await sb.from('presentaciones_shares').delete().eq('presentacion_id', presentacion.id).eq('user_id', userId)
      setCompartidoCon(c => c.filter(id => id !== userId))
    } else {
      await sb.from('presentaciones_shares').insert({ presentacion_id: presentacion.id, user_id: userId })
      setCompartidoCon(c => [...c, userId])
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-base font-semibold text-gray-900">Editar presentacion</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Eye size={12}/> {totalVistas ?? '—'} vistas{ultimaVista ? ` · ultima visita ${new Date(ultimaVista).toLocaleDateString('es-AR')}` : ''}
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Nombre</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Descripcion (opcional)</label>
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] resize-none"/>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Etiquetas (separadas por coma)</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="pitch, 2026, video"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Visibilidad</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setVisibilidad('publica')}
                className={`flex-1 px-3 py-2 rounded-xl text-sm border ${visibilidad === 'publica' ? 'border-[#1B9BF0] bg-[#E8F4FE] text-[#1B9BF0]' : 'border-gray-200 text-gray-500'}`}>Publica</button>
              <button type="button" onClick={() => setVisibilidad('privada')}
                className={`flex-1 px-3 py-2 rounded-xl text-sm border ${visibilidad === 'privada' ? 'border-[#1B9BF0] bg-[#E8F4FE] text-[#1B9BF0]' : 'border-gray-200 text-gray-500'}`}>Privada</button>
            </div>
          </div>

          <div className="border-t border-gray-50 pt-4 space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={protegida} onChange={e => setProtegida(e.target.checked)} className="rounded border-gray-300"/>
              Proteger el link con contrasena
            </label>
            {protegida && (
              <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder={presentacion.tieneClave ? 'Dejar en blanco para mantener la actual' : 'Nueva contrasena'}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={tieneVencimiento} onChange={e => setTieneVencimiento(e.target.checked)} className="rounded border-gray-300"/>
              El link vence en una fecha
            </label>
            {tieneVencimiento && (
              <input type="date" value={vencimiento} onChange={e => setVencimiento(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
            )}
          </div>

          {visibilidad === 'privada' && (
            <div className="border-t border-gray-50 pt-4">
              <p className="text-xs text-gray-400 mb-2 flex items-center gap-1.5"><Users2 size={12}/> Compartir internamente con</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {usuarios.map(u => (
                  <label key={u.id} className="flex items-center gap-2 text-sm text-gray-700 px-1 py-1">
                    <input type="checkbox" checked={compartidoCon.includes(u.id)} onChange={() => toggleCompartir(u.id)} className="rounded border-gray-300"/>
                    {u.nickname || u.full_name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {versiones.length > 1 && (
            <div className="border-t border-gray-50 pt-4">
              <p className="text-xs text-gray-400 mb-2">Historial de versiones</p>
              <div className="space-y-1.5">
                {versiones.map(v => (
                  <div key={v.numero_version} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Version {v.numero_version} · {new Date(v.created_at).toLocaleDateString('es-AR')}</span>
                    <button onClick={() => restaurar(v.numero_version)} className="flex items-center gap-1 text-xs text-[#1B9BF0] hover:underline">
                      <RotateCcw size={12}/> Restaurar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
          <button onClick={guardar} disabled={guardando} className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
