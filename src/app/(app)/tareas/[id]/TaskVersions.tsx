'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createNotification } from '@/app/(app)/novedades/actions'
import { logActivity } from '@/lib/logActivity'
import { ExternalLink, Plus, Loader2, CheckCircle2, RotateCcw } from 'lucide-react'

interface VersionRow {
  id: string
  numero_version: number
  link: string
  comentario_creador: string | null
  creado_por: string
  fecha_creacion: string
  estado_revision: 'pendiente' | 'correcciones_solicitadas' | 'aprobada'
  revisado_por: string | null
  fecha_revision: string | null
  comentario_revision: string | null
  creator?: { full_name: string } | null
  reviewer?: { full_name: string } | null
}

const estadoColors: Record<string, string> = {
  pendiente: 'bg-blue-50 text-blue-600',
  correcciones_solicitadas: 'bg-amber-50 text-amber-600',
  aprobada: 'bg-green-50 text-green-600',
}
const estadoLabels: Record<string, string> = {
  pendiente: 'Pendiente de revisión',
  correcciones_solicitadas: 'Correcciones solicitadas',
  aprobada: 'Aprobada',
}

export default function TaskVersions({
  taskId, taskTitle, taskStatus, versions, currentUserId, canReview, canCreateVersion,
  responsableId, collaboratorIds,
}: {
  taskId: string
  taskTitle: string
  taskStatus: string
  versions: VersionRow[]
  currentUserId: string
  canReview: boolean
  canCreateVersion: boolean
  responsableId: string | null
  collaboratorIds: string[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [link, setLink] = useState('')
  const [comentario, setComentario] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewAction, setReviewAction] = useState<'aprobar' | 'corregir' | null>(null)

  const sorted = [...versions].sort((a, b) => b.numero_version - a.numero_version)
  const latest = sorted[0] ?? null

  function isValidLink(v: string) {
    try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:' } catch { return false }
  }

  async function guardarVersion() {
    if (!link.trim()) { setMsg({ type: 'error', text: 'Debe ingresar el link de la versión.' }); return }
    if (!isValidLink(link.trim())) { setMsg({ type: 'error', text: 'El link debe ser una URL válida (https://...).' }); return }
    setLoading(true)
    const { error } = await createClient().from('task_versions').insert({
      task_id: taskId, link: link.trim(), comentario_creador: comentario.trim() || null, creado_por: currentUserId,
    })
    if (error) { setMsg({ type: 'error', text: 'Error al guardar: ' + error.message }); setLoading(false); return }
    logActivity({ action: 'crear versión', section: 'tareas', entityId: taskId, detail: 'Nueva versión de "' + taskTitle + '"' })
    setMsg({ type: 'ok', text: 'Versión guardada correctamente.' })
    setLink(''); setComentario(''); setShowForm(false)
    router.refresh()
    setLoading(false)
  }

  async function notifyAssignees(title: string, body?: string) {
    const ids = [...(responsableId ? [responsableId] : []), ...collaboratorIds].filter(id => id !== currentUserId)
    await Promise.all(Array.from(new Set(ids)).map(uid =>
      createNotification({ user_id: uid, type: 'task_review', title, body, link: '/tareas/' + taskId }).catch(() => {})
    ))
  }

  async function submitReview(version: VersionRow) {
    if (reviewAction === 'corregir' && !reviewComment.trim()) {
      setMsg({ type: 'error', text: 'El comentario es obligatorio para solicitar correcciones.' })
      return
    }
    setLoading(true)
    const sb = createClient()
    const nextVersionStatus = reviewAction === 'aprobar' ? 'aprobada' : 'correcciones_solicitadas'
    const nextTaskStatus = reviewAction === 'aprobar' ? 'listo_para_entregar' : 'en_proceso'

    const { error: vErr } = await sb.from('task_versions').update({
      estado_revision: nextVersionStatus,
      revisado_por: currentUserId,
      fecha_revision: new Date().toISOString(),
      comentario_revision: reviewComment.trim() || null,
    }).eq('id', version.id)
    if (vErr) { setMsg({ type: 'error', text: 'Error al registrar revisión: ' + vErr.message }); setLoading(false); return }

    const { error: tErr } = await sb.from('tasks').update({ status: nextTaskStatus }).eq('id', taskId)
    if (tErr) { setMsg({ type: 'error', text: 'Error al actualizar la tarea: ' + tErr.message }); setLoading(false); return }

    logActivity({ action: 'revisar versión', section: 'tareas', entityId: taskId, detail: 'V' + String(version.numero_version).padStart(2, '0') + ' → ' + estadoLabels[nextVersionStatus] })

    await notifyAssignees(
      reviewAction === 'aprobar' ? `Versión aprobada en "${taskTitle}"` : `Se solicitaron correcciones en "${taskTitle}"`,
      reviewComment.trim() || undefined,
    )

    setReviewingId(null); setReviewComment(''); setReviewAction(null)
    router.refresh()
    setLoading(false)
  }

  const canReviewLatest = canReview && taskStatus === 'en_revision' && latest?.estado_revision === 'pendiente'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-700">Versiones</p>
        {canCreateVersion && !showForm && (
          <button onClick={() => { setShowForm(true); setMsg(null) }}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#1B9BF0] hover:text-[#0F7ACC]">
            <Plus size={13}/> Nueva versión
          </button>
        )}
      </div>

      {msg && (
        <div className={'text-xs px-3 py-2 rounded-xl mb-3 ' + (msg.type === 'ok' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600')}>
          {msg.text}
        </div>
      )}

      {showForm && (
        <div className="border border-gray-100 rounded-xl p-3 mb-4 space-y-2 bg-gray-50">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Link de la versión *</label>
            <input type="url" value={link} onChange={e => setLink(e.target.value)}
              placeholder="https://figma.com/... , https://drive.google.com/..."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Comentario (opcional)</label>
            <input type="text" value={comentario} onChange={e => setComentario(e.target.value)}
              placeholder="Ej: Primera propuesta"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setShowForm(false); setLink(''); setComentario(''); setMsg(null) }}
              className="flex-1 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-white">Cancelar</button>
            <button onClick={guardarVersion} disabled={loading}
              className="flex-1 py-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl text-xs font-semibold disabled:opacity-50">
              {loading ? 'Guardando...' : 'Guardar versión'}
            </button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-xs text-gray-400">Todavía no hay versiones cargadas.</p>
      ) : (
        <div className="space-y-3">
          {sorted.map(v => (
            <div key={v.id} className="border border-gray-100 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-900">V{String(v.numero_version).padStart(2, '0')}</span>
                <span className={'text-xs px-2 py-0.5 rounded-full ' + estadoColors[v.estado_revision]}>{estadoLabels[v.estado_revision]}</span>
              </div>
              <p className="text-xs text-gray-400">
                Creada por {v.creator?.full_name ?? '—'} · {new Date(v.fecha_creacion).toLocaleString('es-AR')}
              </p>
              {v.comentario_creador && <p className="text-xs text-gray-600 mt-1">{v.comentario_creador}</p>}
              <a href={v.link} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#1B9BF0] hover:underline mt-1.5">
                <ExternalLink size={11}/> Ver archivo
              </a>

              {v.revisado_por && (
                <div className="mt-2 pt-2 border-t border-gray-50">
                  <p className="text-xs text-gray-400">
                    Revisado por {v.reviewer?.full_name ?? '—'} · {v.fecha_revision ? new Date(v.fecha_revision).toLocaleString('es-AR') : ''}
                  </p>
                  {v.comentario_revision && <p className="text-xs text-gray-600 mt-1">{v.comentario_revision}</p>}
                </div>
              )}

              {canReviewLatest && v.id === latest?.id && (
                <div className="mt-3 pt-3 border-t border-gray-50">
                  {reviewingId !== v.id ? (
                    <div className="flex gap-2">
                      <button onClick={() => { setReviewingId(v.id); setReviewAction('corregir'); setReviewComment(''); setMsg(null) }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-amber-200 text-amber-600 hover:bg-amber-50 rounded-xl text-xs font-semibold">
                        <RotateCcw size={12}/> Solicitar correcciones
                      </button>
                      <button onClick={() => { setReviewingId(v.id); setReviewAction('aprobar'); setReviewComment(''); setMsg(null) }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-semibold">
                        <CheckCircle2 size={12}/> Aprobar versión
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} rows={2}
                        placeholder={reviewAction === 'corregir' ? 'Comentario obligatorio...' : 'Comentario (opcional)...'}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] resize-none"/>
                      <div className="flex gap-2">
                        <button onClick={() => { setReviewingId(null); setReviewAction(null); setReviewComment('') }}
                          className="flex-1 py-2 border border-gray-200 rounded-xl text-xs text-gray-600">Cancelar</button>
                        <button onClick={() => submitReview(v)} disabled={loading}
                          className={'flex-1 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50 ' + (reviewAction === 'aprobar' ? 'bg-green-500 hover:bg-green-600' : 'bg-amber-500 hover:bg-amber-600')}>
                          {loading ? 'Guardando...' : reviewAction === 'aprobar' ? 'Confirmar aprobación' : 'Confirmar correcciones'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
