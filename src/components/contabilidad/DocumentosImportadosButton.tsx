'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FolderOpen, X, Download, FileText } from 'lucide-react'

export type DocumentoImportado = {
  id: string
  archivo_nombre: string
  archivo_path: string
  cantidad_registros: number | null
  created_at: string
}

export default function DocumentosImportadosButton({ documentos }: { documentos: DocumentoImportado[] }) {
  const [open, setOpen] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  async function handleDownload(doc: DocumentoImportado) {
    setDownloadingId(doc.id)
    const { data, error } = await createClient().storage.from('documentos-ia').createSignedUrl(doc.archivo_path, 60)
    setDownloadingId(null)
    if (error || !data) { alert('Error al generar el link de descarga: ' + (error?.message ?? '')); return }
    window.open(data.signedUrl, '_blank')
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-xl text-sm font-semibold transition-all">
        <FolderOpen size={15}/> Documentos importados{documentos.length > 0 ? ` (${documentos.length})` : ''}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-gray-900 flex items-center gap-1.5"><FolderOpen size={15} className="text-[#1B9BF0]"/> Documentos importados</p>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>
            {!documentos.length ? (
              <p className="text-sm text-gray-400 text-center py-6">Todavía no se importó ningún documento con IA en esta sección.</p>
            ) : (
              <div className="space-y-1">
                {documentos.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText size={16} className="text-gray-300 shrink-0"/>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 truncate">{doc.archivo_nombre}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(doc.created_at).toLocaleDateString('es-AR')}
                          {doc.cantidad_registros != null ? ` · ${doc.cantidad_registros} registro${doc.cantidad_registros !== 1 ? 's' : ''}` : ''}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => handleDownload(doc)} disabled={downloadingId === doc.id}
                      className="shrink-0 flex items-center gap-1.5 text-xs text-[#1B9BF0] hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50">
                      <Download size={13}/> {downloadingId === doc.id ? 'Generando...' : 'Descargar'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
