import type { SupabaseClient } from '@supabase/supabase-js'
import { lastDayOfMonth, ymd } from '@/lib/utils/date'
import { devengamientosPrestamosHasta } from '@/lib/contabilidad/prestamos'
import { FONDOS_FCI, tcMasReciente } from '@/lib/contabilidad/fondos'

// Cuentas de "Gastos operativos" cuyo nombre en el Plan de cuentas no coincide 1:1
// con el nombre cargado en Tipos de gasto (ej: typo histórico en la base).
const MAPEO_TIPO_GASTO: Record<string, string> = {
  'Contractors - Servicios profesionales': 'Contrators - Servicios profesionales',
}

// Ingresos Brutos: 3% de la facturación neta del mes (misma base que "Ventas a clientes").
const ALICUOTA_IIBB = 0.03

// Impuesto al débito y crédito: el 33% se computa como pago a cuenta de Ganancias (activo); el resto es gasto.
const PORC_DEB_CRED_COMPUTABLE = 0.33

// Cargos de tarjeta que son gasto directo (sin factura propia). Las solapas "Proveedores" y "Proveedores - Cuotas"
// son pagos de facturas de compra ya contadas, e IIBB/IIGG/IVA son créditos fiscales: no se vuelven a gastar.
const SOLAPAS_GASTO_TARJETA = ['Ctas de gastos', 'PL']

// Un comprobante numérico (ej. "715687") es el número de una factura de compra ya cargada: el cargo de tarjeta es su pago.
const esPagoDeFactura = (comprobante: string | null) => /^\s*\d[\d\s-]*$/.test(comprobante ?? '')

function inicioDeMes(periodo: string) {
  return `${periodo}-01`
}
function finDeMes(periodo: string) {
  const [y, m] = periodo.split('-').map(Number)
  return ymd(y, m, lastDayOfMonth(y, m))
}
function mesAnterior(periodo: string) {
  const [y, m] = periodo.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function obtenerTC(sb: SupabaseClient, fecha: string): Promise<number> {
  const { data } = await sb.from('cotizaciones').select('usd_ars').lte('fecha', fecha).order('fecha', { ascending: false }).limit(1)
  if (data?.[0]) return Number(data[0].usd_ars)
  const { data: cualquiera } = await sb.from('cotizaciones').select('usd_ars').order('fecha', { ascending: false }).limit(1)
  return cualquiera?.[0] ? Number(cualquiera[0].usd_ars) : 0
}

type PorFondo = Record<string, number>

// Cuotas en cartera a una fecha, por fondo (cada fondo tiene su propio valor de cuota).
async function cuotasFciAlCierre(sb: SupabaseClient, fecha: string): Promise<PorFondo> {
  const { data } = await sb.from('inversiones_fci_movimientos').select('fondo, operacion, cantidad_cuotas').lte('fecha', fecha)
  const out: PorFondo = {}
  for (const m of data ?? []) {
    out[m.fondo] = (out[m.fondo] ?? 0) + (m.operacion === 'SUSCRIPCION' ? Number(m.cantidad_cuotas) : -Number(m.cantidad_cuotas))
  }
  return out
}

// TC de cada fondo a una fecha: el más reciente entre la "TC de cierre de mes" cargada a mano en Inversiones >
// Fondo Común y el último movimiento registrado del propio fondo (lo mismo que usa esa pantalla).
async function tcFondoAlCierre(sb: SupabaseClient, fecha: string): Promise<PorFondo> {
  const [{ data: cierres }, { data: movs }] = await Promise.all([
    sb.from('inversiones_fci_cierres_mensuales').select('fondo, mes, tc_fondo').lte('mes', fecha).order('mes', { ascending: false }),
    sb.from('inversiones_fci_movimientos').select('fondo, fecha, tc_fondo').lte('fecha', fecha).order('fecha', { ascending: false }).order('created_at', { ascending: false }),
  ])
  const out: PorFondo = {}
  for (const fondo of FONDOS_FCI) {
    const vigente = tcMasReciente((cierres ?? []).find((c: any) => c.fondo === fondo), (movs ?? []).find((m: any) => m.fondo === fondo))
    if (vigente) out[fondo] = vigente.tc
  }
  return out
}

// Saldos "as of" fin de mes para las cuentas automáticas de Activo/Pasivo (Balance Sheet).
export async function calcularSaldosBalanceAuto(sb: SupabaseClient, periodo: string): Promise<Record<string, number>> {
  const fin = finDeMes(periodo)
  const tc = await obtenerTC(sb, fin)
  const out: Record<string, number> = {}

  {
    const { data } = await sb.from('conciliacion_bancaria').select('saldo, fecha, created_at')
      .lte('fecha', fin).order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(1)
    out['Banco Cuenta Corriente - Galicia'] = data?.[0] ? Number(data[0].saldo) : 0
  }

  {
    const [cuotas, tcFondo] = await Promise.all([cuotasFciAlCierre(sb, fin), tcFondoAlCierre(sb, fin)])
    out['Fondo Comun de Inversion (FIMA)'] = FONDOS_FCI.reduce((s, f) => s + (cuotas[f] ?? 0) * (tcFondo[f] ?? 0), 0)
  }

  {
    const { data } = await sb.from('facturas_clientes').select('importe, currency, fecha_emision, fecha_cobro').eq('sociedad', 'SAS').lte('fecha_emision', fin)
    const pendientes = (data ?? []).filter((f: any) => !f.fecha_cobro || f.fecha_cobro > fin)
    out['Clientes a cobrar'] = pendientes.reduce((s: number, f: any) => s + (f.currency === 'USD' ? Number(f.importe) * tc : Number(f.importe)), 0)
  }

  {
    // El 33% del impuesto al débito y crédito se computa como pago a cuenta de Ganancias (activo).
    const { data } = await sb.from('conciliacion_bancaria').select('credito_debito').eq('clasificacion', 'Imp Deb y Cred').lte('fecha', fin)
    out['Imp deb y credito - Computable IIGG'] = Math.round((data ?? []).reduce((s: number, r: any) => s + Math.abs(Number(r.credito_debito)), 0) * PORC_DEB_CRED_COMPUTABLE * 100) / 100
  }

  for (const [nombre, clasificacion] of [['PERCEP / RET IVA', 'Percepcion IVA'], ['PERCEP / RET IIBB', 'Percepcion IIBB']] as const) {
    const { data } = await sb.from('conciliacion_bancaria').select('credito_debito').eq('clasificacion', clasificacion).lte('fecha', fin)
    out[nombre] = (data ?? []).reduce((s: number, r: any) => s + Math.abs(Number(r.credito_debito)), 0)
  }

  {
    // Facturas devengadas hasta el mes (por mes de servicio) y no pagadas a esa fecha. Una factura "pagada" sin
    // fecha de pago se considera paga: el estado manda cuando falta la fecha.
    const { data } = await sb.from('facturas_compra').select('monto_total, fecha_factura, mes_servicio, estado, fecha_pago')
    const pendientes = (data ?? []).filter((f: any) => {
      if ((f.mes_servicio ?? f.fecha_factura.slice(0, 7)) > periodo) return false
      const pagada = f.fecha_pago ? f.fecha_pago <= fin : f.estado === 'pagado'
      return !pagada
    })
    out['Proveedores a pagar'] = -1 * pendientes.reduce((s: number, f: any) => s + Number(f.monto_total), 0)
  }

  {
    const { data } = await sb.from('prestamos').select('monto, moneda, fecha_inicio, fecha_fin').lte('fecha_inicio', fin).gte('fecha_fin', fin)
    out['Prestamo socio a pagar - Capital'] = -1 * (data ?? []).reduce((s: number, p: any) => s + (p.moneda === 'USD' ? Number(p.monto) * tc : Number(p.monto)), 0)
  }

  {
    const devengados = await devengamientosPrestamosHasta(sb, periodo)
    out['Prestamo socio a pagar - Intereses'] = -1 * devengados.reduce((s, d) => s + d.monto, 0)
  }

  {
    const { data } = await sb.from('facturas_compra').select('iva').lte('fecha_factura', fin)
    out['IVA CREDITO FISCAL'] = (data ?? []).reduce((s: number, f: any) => s + Number(f.iva), 0)
  }

  {
    const { data } = await sb.from('facturas_clientes').select('importe_iva').eq('sociedad', 'SAS').lte('fecha_emision', fin)
    out['IVA DEBITO FISCAL'] = -1 * (data ?? []).reduce((s: number, f: any) => s + Number(f.importe_iva ?? 0), 0)
  }

  {
    const { data } = await sb.from('tarjeta_credito').select('pesos, dolares').lte('fecha', fin)
    const pesos = (data ?? []).reduce((s: number, m: any) => s + (Number(m.pesos) || 0), 0)
    const dolares = (data ?? []).reduce((s: number, m: any) => s + (Number(m.dolares) || 0), 0)
    out['Tarjeta de credito VISA a pagar $'] = -1 * pesos
    out['Tarjeta de credito VISA a pagar USD'] = -1 * dolares * tc
  }

  return out
}

// Movimientos del mes seleccionado para las cuentas automáticas de Resultado (P&L).
export async function calcularSaldosResultadoAuto(sb: SupabaseClient, periodo: string, cuentasGastos: { nombre: string }[]): Promise<Record<string, number>> {
  const inicio = inicioDeMes(periodo)
  const fin = finDeMes(periodo)
  const tc = await obtenerTC(sb, fin)
  const out: Record<string, number> = {}
  let comisionesTarjeta = 0

  {
    const { data } = await sb.from('facturas_clientes').select('importe, importe_neto, currency').eq('sociedad', 'SAS').eq('mes_servicio', periodo)
    const ventas = (data ?? []).reduce((s: number, f: any) => {
      const monto = f.importe_neto != null ? Number(f.importe_neto) : Number(f.importe)
      return s + (f.currency === 'USD' ? monto * tc : monto)
    }, 0)
    out['Ventas a clientes'] = ventas
    out['Ingresos Brutos'] = -1 * Math.round(ventas * ALICUOTA_IIBB * 100) / 100
  }

  {
    const [{ data: tipos }, { data: fc }, { data: tj }] = await Promise.all([
      sb.from('tipos_gasto').select('id, nombre, fuente, incluye_otros_impuestos'),
      // Facturas: se imputan al mes de servicio; si no lo tienen, al mes de la fecha de la factura.
      sb.from('facturas_compra').select('tipo_gasto_id, monto_neto, otros_impuestos').not('tipo_gasto_id', 'is', null)
        .or(`mes_servicio.eq.${periodo},and(mes_servicio.is.null,fecha_factura.gte.${inicio},fecha_factura.lte.${fin})`),
      sb.from('tarjeta_credito').select('tipo_gasto_id, pesos, dolares, tipo_cambio, solapa, comprobante').not('tipo_gasto_id', 'is', null).gte('fecha', inicio).lte('fecha', fin),
    ])
    // De dónde sale el gasto de cada rubro: facturas de compra, cargos de tarjeta, o ambos (Tipos de gasto > Fuente).
    const fuentePorTipo = new Map<string, string>((tipos ?? []).map((t: any) => [t.id, t.fuente ?? 'facturas']))
    const porTipo = new Map<string, number>()
    const sumar = (id: string, monto: number) => porTipo.set(id, (porTipo.get(id) ?? 0) + monto)

    // El gasto del P&L es el neto: el IVA es crédito fiscal y las percepciones/otros impuestos no son gasto de la factura.
    // Excepción: rubros como Combustible incluyen los impuestos no recuperables de la factura (ej. impuesto a los combustibles).
    const conOtrosImpuestos = new Set<string>((tipos ?? []).filter((t: any) => t.incluye_otros_impuestos).map((t: any) => t.id))
    for (const f of fc ?? []) {
      if (fuentePorTipo.get(f.tipo_gasto_id) === 'tarjeta') continue
      sumar(f.tipo_gasto_id, Number(f.monto_neto) + (conOtrosImpuestos.has(f.tipo_gasto_id) ? Number(f.otros_impuestos) || 0 : 0))
    }

    // Tarjeta: dólares al tipo de cambio de cada cargo (el del resumen); si no lo tiene, al del cierre del mes.
    const montoTarjeta = (t: any) => (Number(t.pesos) || 0) + (Number(t.dolares) || 0) * (Number(t.tipo_cambio) || tc)
    const tarjetaGasto = (tj ?? []).filter((t: any) => SOLAPAS_GASTO_TARJETA.includes(t.solapa ?? 'Ctas de gastos'))
    for (const t of tarjetaGasto) {
      const fuente = fuentePorTipo.get(t.tipo_gasto_id)
      if (fuente === 'facturas') continue
      // En rubros con facturas y tarjeta, un cargo con número de factura ya está en las facturas: no se cuenta dos veces.
      if (fuente === 'ambas' && esPagoDeFactura(t.comprobante)) continue
      sumar(t.tipo_gasto_id, montoTarjeta(t))
    }

    const tipoComisiones = (tipos ?? []).find((t: any) => t.nombre === 'Comisiones bancarias')
    if (tipoComisiones) comisionesTarjeta = tarjetaGasto.filter((t: any) => t.tipo_gasto_id === tipoComisiones.id).reduce((s: number, t: any) => s + montoTarjeta(t), 0)

    for (const cuenta of cuentasGastos) {
      // IIBB se calcula sobre ventas (arriba) y las comisiones se arman abajo con banco + tarjeta.
      if (cuenta.nombre === 'Comisiones bancarias' || cuenta.nombre === 'Ingresos Brutos') continue
      const nombreBuscado = MAPEO_TIPO_GASTO[cuenta.nombre] ?? cuenta.nombre
      const tipo = (tipos ?? []).find((t: any) => t.nombre === nombreBuscado)
      if (!tipo) continue
      out[cuenta.nombre] = -1 * (porTipo.get(tipo.id) ?? 0)
    }
  }

  {
    const { data } = await sb.from('conciliacion_bancaria').select('credito_debito').eq('clasificacion', 'Imp Deb y Cred').gte('fecha', inicio).lte('fecha', fin)
    const total = (data ?? []).reduce((s: number, r: any) => s + Math.abs(Number(r.credito_debito)), 0)
    out['Impuesto Deb y Cred (perdida)'] = -1 * Math.round(total * (1 - PORC_DEB_CRED_COMPUTABLE) * 100) / 100
  }

  {
    const { data } = await sb.from('conciliacion_bancaria').select('credito_debito').eq('clasificacion', 'Comision bancaria').gte('fecha', inicio).lte('fecha', fin)
    out['Comisiones bancarias'] = -1 * ((data ?? []).reduce((s: number, r: any) => s + Math.abs(Number(r.credito_debito)), 0) + comisionesTarjeta)
  }

  {
    const { data } = await sb.from('conciliacion_bancaria').select('credito_debito').eq('clasificacion', 'Cash Back referido').gte('fecha', inicio).lte('fecha', fin)
    out['Cash Back Banco Galicia'] = (data ?? []).reduce((s: number, r: any) => s + Number(r.credito_debito), 0)
  }

  {
    const devengados = await devengamientosPrestamosHasta(sb, periodo)
    out['Intereses prestamo'] = -1 * devengados.filter(d => d.mes === inicio).reduce((s, d) => s + d.monto, 0)
  }

  {
    // Intereses ganados del FCI, por fondo: valor de la cartera al cierre − valor al cierre anterior − aportes netos del mes
    // (suscripciones − rescates). Sumado mes a mes da: valor final − neto invertido.
    const finAnt = finDeMes(mesAnterior(periodo))
    const [cuotasFin, cuotasIni, tcFin, tcIni, { data: movsMes }] = await Promise.all([
      cuotasFciAlCierre(sb, fin), cuotasFciAlCierre(sb, finAnt), tcFondoAlCierre(sb, fin), tcFondoAlCierre(sb, finAnt),
      sb.from('inversiones_fci_movimientos').select('fondo, operacion, monto').gte('fecha', inicio).lte('fecha', fin),
    ])
    let ganancia = 0
    let hayDatos = false
    for (const fondo of FONDOS_FCI) {
      const cf = cuotasFin[fondo] ?? 0, ci = cuotasIni[fondo] ?? 0
      // Sin TC no se puede valuar la cartera: se saltea ese fondo ese mes en vez de contar una pérdida falsa.
      if ((cf !== 0 && !tcFin[fondo]) || (ci !== 0 && !tcIni[fondo])) continue
      const aportes = (movsMes ?? []).filter((m: any) => m.fondo === fondo)
        .reduce((s: number, m: any) => s + (m.operacion === 'SUSCRIPCION' ? Number(m.monto) : -Number(m.monto)), 0)
      ganancia += cf * (tcFin[fondo] ?? 0) - ci * (tcIni[fondo] ?? 0) - aportes
      hayDatos = true
    }
    if (hayDatos) out['Intereses Ganados FCI'] = ganancia
  }

  return out
}

function mesesEntreRango(desde: string, hasta: string): string[] {
  const [y1, m1] = desde.split('-').map(Number)
  const [y2, m2] = hasta.split('-').map(Number)
  const meses: string[] = []
  let y = y1, m = m1
  while (y < y2 || (y === y2 && m <= m2)) {
    meses.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return meses
}

// Suma, cuenta por cuenta, el Resultado automático entre dos meses (inclusive) para el P&L.
export async function calcularSaldosResultadoAutoRango(
  sb: SupabaseClient, periodoDesde: string, periodoHasta: string, cuentasGastos: { nombre: string }[]
): Promise<Record<string, number>> {
  const meses = mesesEntreRango(periodoDesde, periodoHasta)
  const resultadosPorMes = await Promise.all(meses.map(p => calcularSaldosResultadoAuto(sb, p, cuentasGastos)))
  const out: Record<string, number> = {}
  for (const r of resultadosPorMes) {
    for (const [k, v] of Object.entries(r)) out[k] = (out[k] ?? 0) + v
  }
  return out
}

// Suma el Resultado (auto + manual) desde enero hasta el mes seleccionado, mes a mes,
// para alimentar "Resultado del Ejercicio" en el Balance Sheet.
export async function calcularResultadoYTD(
  sb: SupabaseClient, periodo: string, cuentas: { id: string; nombre: string; origen: 'manual' | 'auto' }[]
): Promise<number> {
  const [anio, mesSel] = periodo.split('-').map(Number)
  const cuentasGastos = cuentas.filter(c => c.origen === 'auto')
  const cuentasManualIds = cuentas.filter(c => c.origen === 'manual').map(c => c.id)

  const meses = Array.from({ length: mesSel }, (_, i) => `${anio}-${String(i + 1).padStart(2, '0')}`)
  const resultadosPorMes = await Promise.all(meses.map(periodoMes => calcularSaldosResultadoAuto(sb, periodoMes, cuentasGastos)))
  let total = resultadosPorMes.reduce((s, auto) => s + Object.values(auto).reduce((s2, v) => s2 + v, 0), 0)

  if (cuentasManualIds.length) {
    const { data } = await sb.from('plan_cuentas_saldos').select('monto')
      .in('cuenta_id', cuentasManualIds).gte('periodo', `${anio}-01-01`).lte('periodo', inicioDeMes(periodo))
    total += (data ?? []).reduce((s, r: any) => s + Number(r.monto), 0)
  }

  return total
}
