// Factura emitida por DEPLOY DAY LLC (plantilla "Service invoice"). Logica compartida entre
// la vista previa del formulario, el guardado y el PDF, asi lo que se ve es lo que se imprime.

export type LineaLLC = {
  tipo: 'item' | 'pct'
  descripcion: string
  unidad: string        // item: cantidad (ej. "1"); pct: "%"
  tarifa: string        // item: texto libre (ej. "N/A" o "150"); pct: porcentaje (ej. "7.5")
  monto: number         // solo item
  baseIdx: number | null // solo pct: indice de la linea "item" sobre la que se calcula
}

export type FacturaLLC = {
  numero: string
  fecha: string          // YYYY-MM-DD
  periodo: string        // ej. "OCT"
  para: string           // "FOR:"
  cliente: { nombre: string; direccion: string; idFiscalLabel: string; idFiscal: string }
  lineas: LineaLLC[]
}

export const MAX_LINEAS_LLC = 12

export const EMISOR_LLC = {
  nombre: 'DEPLOY DAY LLC',
  lineas: ['EIN 30-1371279', '5600 SW 135TH AVE STE 200 D', 'MIAMI FL 33183'],
  pagos: [
    'Titular de la cuenta: DEPLOY DAY LLC',
    'Número de ruta: 026073150',
    'SWIFT/BIC: CMFGUS33',
    'Número de cuenta: 822000806156',
    'Dirección de Wise: 30 W. 26th Street, Sixth Floor',
    'New York NY 10010',
    'United States',
  ],
}

const MESES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function periodoCorto(mes: string): string {
  const m = parseInt(mes.split('-')[1] ?? '', 10)
  return MESES_EN[m - 1]?.slice(0, 3).toUpperCase() ?? ''
}

// "2026-11-03" -> "November 3, 2026"
export function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''
  return `${MESES_EN[m - 1]} ${d}, ${y}`
}

// 26 (año) + 28 (dia) + 10 (mes) - correlativo  ->  "262810-65"
export function numeroFactura(fecha: string, correlativo: number): string {
  const [y, m, d] = fecha.split('-')
  return `${y.slice(2)}${d}${m}-${correlativo}`
}

// Proximo correlativo a partir de los numeros ya emitidos por la LLC (el que tiene el sufijo mas alto + 1).
export function proximoCorrelativo(numeros: (string | null | undefined)[]): number {
  let max = 0
  for (const n of numeros) {
    const m = /^\d{6}-(\d+)$/.exec((n ?? '').trim())
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return max + 1
}

const r2 = (n: number) => Math.round(n * 100) / 100

// Numero estricto ("86", "16.5", "16,5"); texto como "N/A" no cuenta.
export function numeroTexto(s: string): number | null {
  const t = s.trim()
  return /^-?\d+([.,]\d+)?$/.test(t) ? parseFloat(t.replace(',', '.')) : null
}

// Item con unit y rate numericos: amount = unit x rate. Con rate de texto (ej. "N/A") el amount es manual.
export function itemCalculado(l: LineaLLC): number | null {
  if (l.tipo !== 'item') return null
  const u = numeroTexto(l.unidad), t = numeroTexto(l.tarifa)
  return u != null && t != null ? r2(u * t) : null
}

export function montoLinea(lineas: LineaLLC[], i: number): number {
  const l = lineas[i]
  if (l.tipo === 'item') return itemCalculado(l) ?? r2(Number(l.monto) || 0)
  const base = l.baseIdx != null ? lineas[l.baseIdx] : null
  if (!base || base.tipo !== 'item') return 0
  return r2(montoLinea(lineas, l.baseIdx!) * (parseFloat(l.tarifa) || 0) / 100)
}

export function totalesLLC(lineas: LineaLLC[]) {
  const subtotal = r2(lineas.reduce((s, _, i) => s + montoLinea(lineas, i), 0))
  return { subtotal, total: subtotal }
}

export const fmtUSD = (n: number) => 'USD ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const multi = (s: string) => esc(s).split(/\r?\n/).join('<br>')

export function renderFacturaLLCHtml(f: FacturaLLC, logoSrc: string): string {
  const { subtotal, total } = totalesLLC(f.lineas)
  const filas: string[] = []
  for (let i = 0; i < MAX_LINEAS_LLC; i++) {
    const l = f.lineas[i]
    const banda = i % 2 === 1 ? ' class="band"' : ''
    if (!l) { filas.push(`<tr${banda}><td>&nbsp;</td><td></td><td></td><td></td></tr>`); continue }
    const tarifa = l.tipo === 'pct' ? `${parseFloat(l.tarifa) || 0}%` : l.tarifa
    filas.push(`<tr${banda}><td>${esc(l.descripcion)}</td><td class="r">${esc(l.unidad)}</td><td class="r">${esc(tarifa)}</td><td class="r">${fmtUSD(montoLinea(f.lineas, i))}</td></tr>`)
  }
  const c = f.cliente
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(f.numero)}</title><style>
@page { size: A4; margin: 0 }
* { box-sizing: border-box }
body { margin: 0; font-family: Helvetica, Arial, sans-serif; color: #000; font-size: 9pt }
.page { width: 210mm; height: 296mm; overflow: hidden; padding: 14mm 18mm }
.head { display: flex; justify-content: space-between; align-items: center }
.head img { height: 14mm }
.head h1 { margin: 0; font-weight: 400; font-size: 24pt; color: #333; letter-spacing: .5pt }
.emisor { margin-top: 7mm; line-height: 1.7 }
.meta { display: flex; justify-content: space-between; margin-top: 2mm }
.meta table { border-collapse: collapse } .meta td { padding: 0 1mm; line-height: 1.5 } .meta td:first-child { text-align: right; color: #333 }
.bill { margin-top: 4mm; line-height: 1.7; min-height: 22mm }
table.items { width: 100%; border-collapse: collapse; margin-top: 4mm }
.items th { text-align: left; font-weight: 400; padding: 1.5mm 2mm; border-bottom: .3mm solid #000 }
.items th.r, .items td.r { text-align: right }
.items td { padding: 0 2mm; height: 6.4mm; vertical-align: middle }
.items tr.band td { background: #d2dcea }
.tot { margin: 6mm 0 0 auto; width: 90mm; border-collapse: collapse }
.tot td { padding: 1.6mm 2mm; text-align: right; border-bottom: .3mm solid #000; height: 7mm }
.tot td:first-child { text-align: center }
.tot tr.total td { background: #000; color: #fff; font-weight: 700; border: 0 }
.pay { margin-top: 10mm } .pay h3 { text-align: center; font-weight: 400; font-size: 9pt; margin: 0 0 6mm }
.pay p { margin: 0; line-height: 1.5 }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact }
</style></head><body><div class="page">
<div class="head"><img src="${logoSrc}" alt="deployday"><h1>INVOICE</h1></div>
<div class="emisor">${esc(EMISOR_LLC.nombre)}<br>${EMISOR_LLC.lineas.map(esc).join('<br>')}</div>
<div class="meta"><div></div><table>
<tr><td>DATE:</td><td>${esc(fechaLarga(f.fecha))}</td></tr>
<tr><td>PERIOD:</td><td>${esc(f.periodo)}</td></tr>
<tr><td>INVOICE #</td><td>${esc(f.numero)}</td></tr>
<tr><td>FOR:</td><td>${esc(f.para)}</td></tr></table></div>
<div class="bill">BILL TO:<br>${multi(c.nombre)}${c.direccion ? '<br>' + multi(c.direccion) : ''}${c.idFiscal ? `<br>${esc(c.idFiscalLabel || 'Ruc')}: ${esc(c.idFiscal)}` : ''}</div>
<table class="items"><thead><tr><th>DESCRIPTION</th><th class="r" style="width:24mm">UNIT</th><th class="r" style="width:24mm">RATE</th><th class="r" style="width:38mm">AMOUNT</th></tr></thead><tbody>${filas.join('')}</tbody></table>
<table class="tot"><tr><td>SUBTOTAL</td><td>${fmtUSD(subtotal)}</td></tr><tr><td></td><td></td></tr><tr class="total"><td>TOTAL</td><td>${fmtUSD(total)}</td></tr></table>
<div class="pay"><h3>PAYMENTS</h3>${EMISOR_LLC.pagos.map(p => `<p>${esc(p)}</p>`).join('')}</div>
</div></body></html>`
}
