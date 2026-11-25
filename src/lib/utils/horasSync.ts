// Avisa entre pestañas cuando cambian las horas cargadas (cronómetro, carga manual, edición), para que las
// pantallas abiertas se refresquen y no muestren horas viejas. BroadcastChannel no llega a la pestaña que envía.
const CANAL = 'time-entries'

export function avisarHorasCambiaron() {
  try {
    const bc = new BroadcastChannel(CANAL)
    bc.postMessage('changed')
    bc.close()
  } catch {}
}

export function escucharHorasCambiaron(cb: () => void): () => void {
  try {
    const bc = new BroadcastChannel(CANAL)
    bc.onmessage = () => cb()
    return () => bc.close()
  } catch {
    return () => {}
  }
}
