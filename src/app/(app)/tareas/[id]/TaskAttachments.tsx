'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Paperclip, Upload, Trash2, Download, FileText, Image, File, Loader2 } from 'lucide-react'

interface Attachment {
  id: string
  file_name: string
  file_path: string
  file_size: number | null
  file_type: string | null
  category: string
  user_name: string | null
  created_at: string
  user_id: string
}

function FileIcon({ type }: { type: string | null }) {
  if (!type) return <File size={14} className="text-gray-400"/>
  if (type.startsWith('image/')) return <Image size={14} className="text-blue-400"/>
  if (type.includes('pdf')) return <FileText size={14} className="text-red-400"/>
  return <File size={14} className="text-gray-400"/>
}

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function TaskAttachments({
  taskId, userId, userName, canUpload, initialAttachments = []
}: {
  taskId: string
  userId: string
  userName: string
  canUpload: boolean
  initialAttachments?: Attachment[]
}) {
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const briefRef = useRef<HTMLInputElement>(null)
  const entregaRef = useRef<HTMLInputElement>(null)

  async function handleUpload(files: FileList | null, category: 'brief' | 'entrega') {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)
    const sb = createClient()

    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) {
        setError('El archivo ' + file.name + ' supera 20MB')
        continue
      }
      const ext = file.name.split('.').pop()
      const path = `${taskId}/${category}/${Date.now()}-${file.name}`

      const { error: upErr } = await sb.storage.from('task-files').upload(path, file)
      if (upErr) { setError('Error subiendo ' + file.name + ': ' + upErr.message); continue }

      const { data, error: dbErr } = await sb.from('task_attachments').insert({
        task_id: taskId,
        user_id: userId,
        user_name: userName,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        file_type: file.type,
        category,
      }).select().single()

      if (dbErr) { setError('Error registrando archivo: ' + dbErr.message); continue }
      if (data) setAttachments(prev => [...prev, data])
    }
    setUploading(false)
  }

  async function handleDelete(att: Attachment) {
    if (att.user_id !== userId) return
    setDeletingId(att.id)
    const sb = createClient()
    await sb.storage.from('task-files').remove([att.file_path])
    await sb.from('task_attachments').delete().eq('id', att.id)
    setAttachments(prev => prev.filter(a => a.id !== att.id))
    setDeletingId(null)
  }

  async function handleDownload(att: Attachment) {
    const sb = createClient()
    const { data } = await sb.storage.from('task-files').createSignedUrl(att.file_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const briefs   = attachments.filter(a => a.category === 'brief')
  const entregas = attachments.filter(a => a.category === 'entrega')

  const AttachmentList = ({ items, category }: { items: Attachment[]; category: string }) => (
    <div className="space-y-1.5">
      {items.map(att => (
        <div key={att.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl group">
          <FileIcon type={att.file_type}/>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700 truncate">{att.file_name}</p>
            <p className="text-[10px] text-gray-400">
              {att.user_name} · {formatSize(att.file_size)} · {new Date(att.created_at).toLocaleDateString('es-AR')}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => handleDownload(att)} title="Descargar"
              className="p-1 rounded-lg text-gray-400 hover:text-[#1B9BF0] hover:bg-blue-50 transition-all">
              <Download size={12}/>
            </button>
            {att.user_id === userId && (
              <button onClick={() => handleDelete(att)} disabled={deletingId === att.id} title="Eliminar"
                className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40">
                {deletingId === att.id ? <Loader2 size={12} className="animate-spin"/> : <Trash2 size={12}/>}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Paperclip size={14} className="text-gray-400"/>
        <p className="text-sm font-medium text-gray-700">Archivos</p>
        {attachments.length > 0 && (
          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{attachments.length}</span>
        )}
      </div>

      {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

      {/* Brief / Referencias */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Brief / Referencias</p>
          {canUpload && (
            <>
              <button onClick={() => briefRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1 text-xs text-[#1B9BF0] hover:underline disabled:opacity-50">
                <Upload size={11}/> Subir
              </button>
              <input ref={briefRef} type="file" multiple className="hidden"
                onChange={e => handleUpload(e.target.files, 'brief')}/>
            </>
          )}
        </div>
        {briefs.length === 0
          ? <p className="text-xs text-gray-300 px-1">Sin archivos de brief</p>
          : <AttachmentList items={briefs} category="brief"/>
        }
      </div>

      <div className="border-t border-gray-50"/>

      {/* Entregas */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Entregas</p>
          {canUpload && (
            <>
              <button onClick={() => entregaRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1 text-xs text-[#1B9BF0] hover:underline disabled:opacity-50">
                {uploading ? <><Loader2 size={11} className="animate-spin"/> Subiendo...</> : <><Upload size={11}/> Subir</>}
              </button>
              <input ref={entregaRef} type="file" multiple className="hidden"
                onChange={e => handleUpload(e.target.files, 'entrega')}/>
            </>
          )}
        </div>
        {entregas.length === 0
          ? <p className="text-xs text-gray-300 px-1">Sin entregas aún</p>
          : <AttachmentList items={entregas} category="entrega"/>
        }
      </div>
    </div>
  )
}
