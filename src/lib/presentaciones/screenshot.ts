// Captura automatica de portada: renderiza la presentacion ya publicada con un
// Chromium headless y saca una foto. Best-effort: si falla (timeout, HTML raro,
// fuente que no carga, etc.) no debe romper la publicacion, solo queda sin portada.
export async function capturarPortada(url: string): Promise<Buffer | null> {
  try {
    const chromium = (await import('@sparticuz/chromium')).default
    const { chromium: playwrightChromium } = await import('playwright-core')

    const executablePath = await chromium.executablePath()
    const browser = await playwrightChromium.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    })

    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 })
      const buffer = await page.screenshot({ type: 'png' })
      return buffer
    } finally {
      await browser.close()
    }
  } catch (err) {
    console.error('No se pudo generar la portada automatica:', err)
    return null
  }
}
