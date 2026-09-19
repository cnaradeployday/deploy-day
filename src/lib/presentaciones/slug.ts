import type { SupabaseClient } from '@supabase/supabase-js'

export function slugify(text: string): string {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// Slug permanente cliente+nombre. No cambia al actualizar/reemplazar archivos:
// solo se genera una vez, al crear la presentacion.
export async function generarSlugUnico(sb: SupabaseClient, clienteNombre: string, nombre: string) {
  const base = `${slugify(clienteNombre)}-${slugify(nombre)}`.replace(/-+/g, '-').replace(/^-+|-+$/g, '') || 'presentacion'
  let slug = base
  let i = 2
  while (true) {
    const { data } = await sb.from('presentaciones').select('id').eq('slug', slug).maybeSingle()
    if (!data) return slug
    slug = `${base}-${i}`
    i++
  }
}
