export type ArchivoExtraido = { path: string; buffer: Buffer; contentType: string }

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8', js: 'application/javascript; charset=utf-8', mjs: 'application/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8', xml: 'application/xml; charset=utf-8', txt: 'text/plain; charset=utf-8',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', ico: 'image/x-icon', avif: 'image/avif',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
  pdf: 'application/pdf',
}

export function contentTypeFor(path: string) {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

function debeIgnorar(path: string) {
  const partes = path.split('/')
  const nombre = partes[partes.length - 1]
  return path.includes('__MACOSX') || nombre.startsWith('.') || nombre === ''
}

// Extrae un ZIP y devuelve sus archivos "planos". Si todo el contenido esta
// dentro de una unica carpeta raiz (comun al comprimir una carpeta desde el
// Finder/Explorador), la saca para que index.html quede en la raiz.
export async function extraerZip(buffer: Buffer): Promise<ArchivoExtraido[]> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(buffer)

  const entradas = Object.entries(zip.files).filter(([path, entry]) => !entry.dir && !debeIgnorar(path))
  if (entradas.length === 0) return []

  const primerasPartes = entradas.map(([path]) => path.split('/')[0])
  const raizComun = primerasPartes.every(p => p === primerasPartes[0]) ? primerasPartes[0] : null

  const archivos: ArchivoExtraido[] = []
  for (const [path, entry] of entradas) {
    const relPath = raizComun ? path.slice(raizComun.length + 1) : path
    if (!relPath) continue
    const content = await entry.async('nodebuffer')
    archivos.push({ path: relPath, buffer: content, contentType: contentTypeFor(relPath) })
  }
  return archivos
}

export function encontrarArchivoPrincipal(archivos: ArchivoExtraido[]) {
  return archivos.find(a => a.path.toLowerCase() === 'index.html')
    ?? archivos.find(a => a.path.toLowerCase().endsWith('/index.html'))
}
