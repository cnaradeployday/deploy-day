'use client'
import { useState, useRef, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, UploadCloud, FileArchive, Folder, ExternalLink, Link2, Check, RotateCcw } from 'lucide-react'
import { slugify } from '@/lib/presentaciones/slug'
import type { Cliente, Presentacion } from './types'

type Modo = 'crear' | 'reemplazar'

export default function NuevaPresentacionModal({
  open, onClose, clientes, clienteIdFijo, presentacion, onDone,
}: {
  open: boolean
  onClose: () => void
  clientes: Cliente[]
  clienteIdFijo?: string
  presentacion?: Presentacion
  onDone: () => void
}) {
  const router = useRouter()
  const modo: Modo = presentacion ? 'reemplazar' : 'crear'
  const [clientId, setClientId] = useState(clienteIdFijo ?? presentacion?.clientId ?? '')
  const [nombre, setNombre] = useState(presentacion?.nombre ?? '')
  const [visibilidad, setVisibilidad] = useState<'publica' | 'privada'>(presentacion?.visibilidad ?? 'publica')
  const [file, setFile] = useState<File | null>(null)
  const [carpeta, setCarpeta] = useState<FileList | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fase, setFase] = useState<'form' | 'subiendo' | 'procesando' | 'exito'>('form')
  const [progreso, setProgreso] = useState(0)
  const [resultado, setResultado] = useState<{ url: string; slug: string } | null>(null)
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    if (!resultado) { setQr(null); return }
    import('qrcode').then(QRCode => QRCode.toDataURL(resultado.url, { width: 160, margin: 1 })).then(setQr).catch(() => setQr(null))
  }, [resultado])
  const zipInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const clienteNombre = useMemo(() => clientes.find(c => c.id === clientId)?.nombre ?? '', [clientId, clientes])
  const slugPreview = useMemo(() => {
    if (presentacion) return presentacion.slug
    if (!clienteNombre || !nombre) return ''
    return `${slugify(clienteNombre)}-${slugify(nombre)}`
  }, [clienteNombre, nombre, presentacion])

  if (!open) return null

  function reset() {
    setFile(null); setCarpeta(null); setError(null); setFase('form'); setProgreso(0); setResultado(null)
    if (modo === 'crear') { setNombre(''); setClientId(clienteIdFijo ?? '') }
  }

  function cerrar() {
    reset()
    onClose()
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const dropped = e.dataTransfer.files
    if (dropped.length === 1 && dropped[0].name.toLowerCase().endsWith('.zip')) {
      setFile(dropped[0]); setCarpeta(null)
    } else {
      setError('Arrastra un unico archivo .zip. Para HTML con varios archivos, usa "Seleccionar carpeta".')
    }
  }

  async function publicar() {
    setError(null)
    if (modo === 'crear' && (!clientId || !nombre.trim())) { setError('Elegi un cliente y un nombre para la presentacion.'); return }
    if (!file && !carpeta) { setError('Arrastra un ZIP o seleccioná los archivos de la presentacion.'); return }

    const formData = new FormData()
    if (presentacion) formData.append('presentacion_id', presentacion.id)
    else formData.append('client_id', clientId)
    formData.append('nombre', nombre.trim())
    formData.append('visibilidad', visibilidad)

    if (file) {
      formData.append('mode', 'zip')
      formData.append('zip', file)
    } else if (carpeta) {
      formData.append('mode', 'files')
      const paths: string[] = []
      Array.from(carpeta).forEach(f => {
        paths.push((f as any).webkitRelativePath || f.name)
        formData.append('file', f)
      })
      formData.append('paths', JSON.stringify(paths))
    }

    setFase('subiendo')
    setProgreso(0)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/presentaciones/upload')
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgreso(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setFase('procesando')
        try {
          const data = JSON.parse(xhr.responseText)
          setTimeout(() => { setResultado({ url: data.url, slug: data.slug }); setFase('exito'); onDone(); router.refresh() }, 500)
        } catch {
          setError('Respuesta inesperada del servidor.'); setFase('form')
        }
      } else {
        try { setError(JSON.parse(xhr.responseText).error ?? 'Error durante la carga.') } catch { setError('Error durante la carga.') }
        setFase('form')
      }
    }
    xhr.onerror = () => { setError('Error de conexion durante la carga. Podes reintentar.'); setFase('form') }
    xhr.send(formData)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {modo === 'reemplazar' ? `Reemplazar archivos — ${presentacion?.nombre}` : 'Nueva presentacion'}
          </h2>
          <button onClick={cerrar} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
        </div>

        <div className="p-5">
          {fase === 'exito' && resultado ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                <Check size={22} className="text-green-600"/>
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-1">Presentacion publicada correctamente</p>
              <p className="text-xs text-gray-400 mb-3 break-all">{resultado.url}</p>
              {qr && <img src={qr} alt="Codigo QR de la presentacion" className="mx-auto mb-3 rounded-lg border border-gray-100" width={140} height={140}/>}
              <div className="flex items-center justify-center gap-2 mb-4">
                <button onClick={() => { navigator.clipboard.writeText(resultado.url) }}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50">
                  <Link2 size={13}/> Copiar URL
                </button>
                <a href={resultado.url} target="_blank" rel="noopener"
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50">
                  <ExternalLink size={13}/> Abrir
                </a>
              </div>
              <button onClick={cerrar} className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800">Volver</button>
            </div>
          ) : fase === 'subiendo' || fase === 'procesando' ? (
            <div className="py-6 text-center">
              <p className="text-sm text-gray-600 mb-3">{fase === 'subiendo' ? 'Subiendo presentacion...' : 'Procesando archivos...'}</p>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#1B9BF0] transition-all" style={{ width: `${fase === 'procesando' ? 100 : progreso}%` }}/>
              </div>
              <p className="text-xs text-gray-400 mt-2">{fase === 'subiendo' ? `${progreso}%` : ''}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {modo === 'crear' && (
                <>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Cliente</label>
                    <select value={clientId} onChange={e => setClientId(e.target.value)} disabled={!!clienteIdFijo}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white disabled:bg-gray-50">
                      <option value="">Elegir cliente...</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Nombre de la presentacion</label>
                    <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Video Institucional 2026"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
                  </div>
                  {slugPreview && <p className="text-xs text-gray-400">URL: <span className="text-gray-600">/p/{slugPreview}</span></p>}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Visibilidad</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setVisibilidad('publica')}
                        className={`flex-1 px-3 py-2 rounded-xl text-sm border ${visibilidad === 'publica' ? 'border-[#1B9BF0] bg-[#E8F4FE] text-[#1B9BF0]' : 'border-gray-200 text-gray-500'}`}>
                        Publica
                      </button>
                      <button type="button" onClick={() => setVisibilidad('privada')}
                        className={`flex-1 px-3 py-2 rounded-xl text-sm border ${visibilidad === 'privada' ? 'border-[#1B9BF0] bg-[#E8F4FE] text-[#1B9BF0]' : 'border-gray-200 text-gray-500'}`}>
                        Privada
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {visibilidad === 'publica' ? 'La ve cualquiera con acceso a Presentaciones en DDS.' : 'Solo la ves vos dentro de DDS (el link publico funciona igual una vez publicada).'}
                    </p>
                  </div>
                </>
              )}

              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${dragOver ? 'border-[#1B9BF0] bg-[#E8F4FE]' : 'border-gray-200'}`}
              >
                <UploadCloud size={24} className="mx-auto mb-2 text-gray-300"/>
                {file ? (
                  <p className="text-sm text-gray-700 flex items-center justify-center gap-1.5"><FileArchive size={14}/> {file.name}</p>
                ) : carpeta ? (
                  <p className="text-sm text-gray-700 flex items-center justify-center gap-1.5"><Folder size={14}/> {carpeta.length} archivos seleccionados</p>
                ) : (
                  <p className="text-sm text-gray-400">Arrastra un archivo .zip aca</p>
                )}
                <div className="flex items-center justify-center gap-2 mt-3">
                  <button type="button" onClick={() => zipInputRef.current?.click()} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Seleccionar ZIP</button>
                  <button type="button" onClick={() => folderInputRef.current?.click()} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Seleccionar carpeta</button>
                </div>
                <input ref={zipInputRef} type="file" accept=".zip" className="hidden" onChange={e => { setFile(e.target.files?.[0] ?? null); setCarpeta(null) }}/>
                <input ref={folderInputRef} type="file" className="hidden" {...{ webkitdirectory: 'true', directory: 'true' } as any} multiple onChange={e => { setCarpeta(e.target.files); setFile(null) }}/>
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <button onClick={publicar} className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 flex items-center justify-center gap-2">
                {modo === 'reemplazar' ? <><RotateCcw size={15}/> Reemplazar y publicar</> : 'Publicar presentacion'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
