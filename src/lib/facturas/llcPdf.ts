import { readFile } from 'fs/promises'
import path from 'path'

export async function logoDataUri() {
  const buf = await readFile(path.join(process.cwd(), 'public', 'factura-llc-logo.png'))
  return 'data:image/png;base64,' + buf.toString('base64')
}

// Renderiza el HTML de la factura LLC a PDF con Chromium headless (mismo mecanismo que la captura
// de portadas de Presentaciones). Corre solo en el servidor.
export async function htmlAPdf(html: string): Promise<Buffer> {
  const chromium = (await import('@sparticuz/chromium')).default
  const { chromium: playwrightChromium } = await import('playwright-core')
  const browser = await playwrightChromium.launch({
    args: chromium.args,
    executablePath: process.env.CHROMIUM_PATH || await chromium.executablePath(),
    headless: true,
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
  } finally {
    await browser.close()
  }
}
