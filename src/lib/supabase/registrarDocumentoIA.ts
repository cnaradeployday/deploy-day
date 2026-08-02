import type { SupabaseClient } from '@supabase/supabase-js'

export type SeccionDocumentoIA = 'facturas_compra' | 'facturas_clientes' | 'tarjeta_credito' | 'fondo_comun_inversion' | 'conciliacion_bancaria'

// Guarda en Storage el documento fuente usado en una extraccion/importacion con IA y deja un registro
// para poder auditarlo despues. No bloquea el flujo principal si falla: solo se loguea en consola.
export async function registrarDocumentoIA(sb: SupabaseClient, {
  seccion, file, cantidadRegistros, referenciaId, userId,
}: {
  seccion: SeccionDocumentoIA
  file: File
  cantidadRegistros?: number
  referenciaId?: string
  userId?: string | null
}) {
  const path = `${seccion}/${Date.now()}-${file.name}`
  const { error: upErr } = await sb.storage.from('documentos-ia').upload(path, file)
  if (upErr) { console.error('No se pudo guardar el documento de IA:', upErr.message); return }
  const { error } = await sb.from('documentos_ia_importados').insert({
    seccion,
    archivo_nombre: file.name,
    archivo_path: path,
    cantidad_registros: cantidadRegistros ?? null,
    referencia_id: referenciaId ?? null,
    created_by: userId ?? null,
  })
  if (error) console.error('No se pudo registrar el documento de IA:', error.message)
}
