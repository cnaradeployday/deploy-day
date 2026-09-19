export type Presentacion = {
  id: string
  clientId: string
  clienteNombre: string
  nombre: string
  slug: string
  descripcion: string | null
  visibilidad: 'publica' | 'privada'
  estado: 'borrador' | 'procesando' | 'publicada' | 'error' | 'despublicada'
  portadaUrl: string | null
  tieneClave: boolean
  linkExpiraAt: string | null
  esMia: boolean
  esFavorita: boolean
  tieneCompartidos: boolean
  createdAt: string
  updatedAt: string
}

// PU (publica) / US (compartida con usuarios puntuales, visibilidad=privada + shares) / PR (privada, sin compartir)
export function badgeVisibilidad(p: Pick<Presentacion, 'visibilidad' | 'tieneCompartidos'>): { label: string; title: string } {
  if (p.visibilidad === 'publica') return { label: 'PU', title: 'Publica' }
  if (p.tieneCompartidos) return { label: 'US', title: 'Compartida con usuarios especificos' }
  return { label: 'PR', title: 'Privada' }
}

export type Cliente = {
  id: string
  nombre: string
  empresa: string | null
  esFavorito: boolean
}

export const ESTADO_LABEL: Record<Presentacion['estado'], string> = {
  borrador: 'Borrador',
  procesando: 'Procesando',
  publicada: 'Publicada',
  error: 'Error',
  despublicada: 'Despublicada',
}

export const ESTADO_COLOR: Record<Presentacion['estado'], string> = {
  borrador: 'bg-gray-100 text-gray-500',
  procesando: 'bg-amber-50 text-amber-600',
  publicada: 'bg-green-50 text-green-600',
  error: 'bg-red-50 text-red-600',
  despublicada: 'bg-gray-100 text-gray-400',
}

export function urlPublica(slug: string) {
  if (typeof window === 'undefined') return `/p/${slug}`
  return `${window.location.origin}/p/${slug}`
}

const COLORES_AVATAR = ['#1B9BF0', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']
export function colorAvatar(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  return COLORES_AVATAR[Math.abs(hash) % COLORES_AVATAR.length]
}
