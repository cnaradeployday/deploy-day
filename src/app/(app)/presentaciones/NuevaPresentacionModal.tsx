'use client'
import { useState, useRef, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, UploadCloud, FileArchive, Folder, FileCode, ExternalLink, Link2, Check, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { slugify } from '@/lib/presentaciones/slug'
import type { Cliente, Presentacion } from './types'

type Modo = 'crear' | 'reemplazar'
type ModoVisibilidad = 'publica' | 'privada' | 'usuarios'
type Usuario = { id: string; full_name: string; nickname: string | null }

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
  const [modoVisibilidad, setModoVisibilidad] = useState<ModoVisibilidad>(presentacion?.visibilidad ?? 'publica')
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [usuariosSeleccionados, setUsuariosSeleccionados] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [htmlFile, setHtmlFile] = useState<File | null>(null)
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

  useEffect(() => {
    if (modoVisibilidad !== 'usuarios' || usuarios.length) return
    createClient().from('users').select('id, full_name, nickname').order('full_name').then(({ data }) => setUsuarios(data ?? []))
  }, [modoVisibilidad, usuarios.length])
  const zipInputRef = useRef<HTMLInputElement>(null)
  const htmlInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const clienteNombre = useMemo(() => clientes.find(c => c.id === clientId)?.nombre ?? '', [clientId, clientes])
  const slugPreview = useMemo(() => {
    if (presentacion) return presentacion.slug
    if (!clienteNombre || !nombre) return ''
    return `${slugify(clienteNombre)}-${slugify(nombre)}`
  }, [clienteNombre, nombre, presentacion])

  if (!open) return null

  function reset() {
    setFile(null); setHtmlFile(null); setCarpeta(null); setError(null); setFase('form'); setProgreso(0); setResultado(null)
    if (modo === 'crear') { setNombre(''); setClientId(clienteIdFijo ?? ''); setModoVisibilidad('publica'); setUsuariosSeleccionados([]) }
  }

  function cerrar() {
    reset()
    onClose()
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const dropped = e.dataTransfer.files
    const nombreArchivo = dropped[0]?.name.toLowerCase() ?? ''
    if (dropped.length === 1 && nombreArchivo.endsWith('.zip')) {
      setFile(dropped[0]); setHtmlFile(null); setCarpeta(null)
    } else if (dropped.length === 1 && (nombreArchivo.endsWith('.html') || nombreArchivo.endsWith('.htm'))) {
      setHtmlFile(dropped[0]); setFile(null); setCarpeta(null)
    } else {
      setError('Arrastra un unico archivo .zip o .html. Para una presentacion con varios archivos sueltos (css, imagenes), usa "Seleccionar carpeta".')
    }
  }

  async function publicar() {
    setError(null)
    if (modo === 'crear' && (!clientId || !nombre.trim())) { setError('Elegi un cliente y un nombre para la presentacion.'); return }
    if (modo === 'crear' && modoVisibilidad === 'usuarios' && usuariosSeleccionados.length === 0) { setError('Elegi al menos un usuario para compartirla.'); return }
    if (!file && !htmlFile && !carpeta) { setError('Arrastra un ZIP, un HTML, o seleccioná los archivos de la presentacion.'); return }

    const visibilidad = modoVisibilidad === 'publica' ? 'publica' : 'privada'
    const formData = new FormData()
    if (presentacion) formData.append('presentacion_id', presentacion.id)
    else formData.append('client_id', clientId)
    formData.append('nombre', nombre.trim())
    formData.append('visibilidad', visibilidad)

    if (file) {
      formData.append('mode', 'zip')
      formData.append('zip', file)
    } else if (htmlFile) {
      formData.append('mode', 'files')
      formData.append('file', htmlFile)
      formData.append('paths', JSON.stringify(['index.html']))
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
          const compartir = modo === 'crear' && modoVisibilidad === 'usuarios' && usuariosSeleccionados.length
            ? createClient().from('presentaciones_shares').insert(usuariosSeleccionados.map(userId => ({ presentacion_id: data.id, user_id: userId })))
            : Promise.resolve()
          compartir.then(() => {
            setTimeout(() => { setResultado({ url: data.url, slug: data.slug }); setFase('exito'); onDone(); router.refresh() }, 500)
          })
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
                      <button type="button" onClick={() => setModoVisibilidad('publica')}
                        className={`flex-1 px-3 py-2 rounded-xl text-sm border ${modoVisibilidad === 'publica' ? 'border-[#1B9BF0] bg-[#E8F4FE] text-[#1B9BF0]' : 'border-gray-200 text-gray-500'}`}>
                        Publica
                      </button>
                      <button type="button" onClick={() => setModoVisibilidad('privada')}
                        className={`flex-1 px-3 py-2 rounded-xl text-sm border ${modoVisibilidad === 'privada' ? 'border-[#1B9BF0] bg-[#E8F4FE] text-[#1B9BF0]' : 'border-gray-200 text-gray-500'}`}>
                        Privada
                      </button>
                      <button type="button" onClick={() => setModoVisibilidad('usuarios')}
                        className={`flex-1 px-3 py-2 rounded-xl text-sm border ${modoVisibilidad === 'usuarios' ? 'border-[#1B9BF0] bg-[#E8F4FE] text-[#1B9BF0]' : 'border-gray-200 text-gray-500'}`}>
                        Usuarios
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {modoVisibilidad === 'publica' && 'La ve cualquiera con acceso a Presentaciones en DDS.'}
                      {modoVisibilidad === 'privada' && 'Solo la ves vos dentro de DDS (el link publico funciona igual una vez publicada).'}
                      {modoVisibilidad === 'usuarios' && 'Solo la ven vos y los usuarios que elijas (el link publico funciona igual una vez publicada).'}
                    </p>
                    {modoVisibilidad === 'usuarios' && (
                      <div className="mt-2 border border-gray-200 rounded-xl p-2 max-h-32 overflow-y-auto">
                        {usuarios.length === 0 ? (
                          <p className="text-xs text-gray-400 px-1 py-1">Cargando usuarios...</p>
                        ) : usuarios.map(u => (
                          <label key={u.id} className="flex items-center gap-2 text-sm text-gray-700 px-1 py-1">
                            <input type="checkbox" checked={usuariosSeleccionados.includes(u.id)}
                              onChange={() => setUsuariosSeleccionados(s => s.includes(u.id) ? s.filter(id => id !== u.id) : [...s, u.id])}
                              className="rounded border-gray-300"/>
                            {u.nickname || u.full_name}
                          </label>
                        ))}
                      </div>
                    )}
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
                ) : htmlFile ? (
                  <p className="text-sm text-gray-700 flex items-center justify-center gap-1.5"><FileCode size={14}/> {htmlFile.name}</p>
                ) : carpeta ? (
                  <p className="text-sm text-gray-700 flex items-center justify-center gap-1.5"><Folder size={14}/> {carpeta.length} archivos seleccionados</p>
                ) : (
                  <p className="text-sm text-gray-400">Arrastra un archivo .zip o .html aca</p>
                )}
                <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                  <button type="button" onClick={() => zipInputRef.current?.click()} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Seleccionar ZIP</button>
                  <button type="button" onClick={() => htmlInputRef.current?.click()} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Seleccionar HTML</button>
                  <button type="button" onClick={() => folderInputRef.current?.click()} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Seleccionar carpeta</button>
                </div>
                <p className="text-xs text-gray-400 mt-2">Un HTML suelto sirve si es autocontenido (CSS/JS/imagenes inline). Si depende de otros archivos, usa ZIP o carpeta.</p>
                <input ref={zipInputRef} type="file" accept=".zip" className="hidden" onChange={e => { setFile(e.target.files?.[0] ?? null); setHtmlFile(null); setCarpeta(null) }}/>
                <input ref={htmlInputRef} type="file" accept=".html,.htm" className="hidden" onChange={e => { setHtmlFile(e.target.files?.[0] ?? null); setFile(null); setCarpeta(null) }}/>
                <input ref={folderInputRef} type="file" className="hidden" {...{ webkitdirectory: 'true', directory: 'true' } as any} multiple onChange={e => { setCarpeta(e.target.files); setFile(null); setHtmlFile(null) }}/>
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
