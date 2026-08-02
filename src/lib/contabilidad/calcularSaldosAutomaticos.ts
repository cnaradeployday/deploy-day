import type { SupabaseClient } from '@supabase/supabase-js'

// Cuentas de "Gastos operativos" cuyo nombre en el Plan de cuentas no coincide 1:1
// con el nombre cargado en Tipos de gasto (ej: typo histórico en la base).
const MAPEO_TIPO_GASTO: Record<string, string> = {
  'Contractors - Servicios profesionales': 'Contrators - Servicios profesionales',
}

function inicioDeMes(periodo: string) {
  return `${periodo}-01`
}
function finDeMes(periodo: string) {
  const [y, m] = periodo.split('-').map(Number)
  const d = new Date(y, m, 0)
  return d.toISOString().split('T')[0]
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

async function cuotasFciAlCierre(sb: SupabaseClient, fecha: string): Promise<number> {
  const { data } = await sb.from('inversiones_fci_movimientos').select('operacion, cantidad_cuotas').lte('fecha', fecha)
  return (data ?? []).reduce((s: number, m: any) => s + (m.operacion === 'SUSCRIPCION' ? Number(m.cantidad_cuotas) : -Number(m.cantidad_cuotas)), 0)
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
    const cuotas = await cuotasFciAlCierre(sb, fin)
    const { data: cierres } = await sb.from('inversiones_fci_cierres_mensuales').select('tc_fondo')
      .lte('mes', inicioDeMes(periodo)).order('mes', { ascending: false }).limit(1)
    const tcFondo = cierres?.[0] ? Number(cierres[0].tc_fondo) : 0
    out['Fondo Comun de Inversion (FIMA)'] = cuotas * tcFondo
  }

  {
    const { data } = await sb.from('facturas_clientes').select('importe, currency, fecha_emision, fecha_cobro').lte('fecha_emision', fin)
    const pendientes = (data ?? []).filter((f: any) => !f.fecha_cobro || f.fecha_cobro > fin)
    out['Clientes a cobrar'] = pendientes.reduce((s: number, f: any) => s + (f.currency === 'USD' ? Number(f.importe) * tc : Number(f.importe)), 0)
  }

  for (const [nombre, clasificacion] of [['PERCEP / RET IVA', 'Percepcion IVA'], ['PERCEP / RET IIBB', 'Percepcion IIBB']] as const) {
    const { data } = await sb.from('conciliacion_bancaria').select('credito_debito').eq('clasificacion', clasificacion).lte('fecha', fin)
    out[nombre] = (data ?? []).reduce((s: number, r: any) => s + Math.abs(Number(r.credito_debito)), 0)
  }

  {
    const { data } = await sb.from('facturas_compra').select('monto_total, fecha_factura, fecha_pago').lte('fecha_factura', fin)
    const pendientes = (data ?? []).filter((f: any) => !f.fecha_pago || f.fecha_pago > fin)
    out['Proveedores a pagar'] = -1 * pendientes.reduce((s: number, f: any) => s + Number(f.monto_total), 0)
  }

  {
    const { data } = await sb.from('prestamos').select('monto, moneda, fecha_inicio, fecha_fin').lte('fecha_inicio', fin).gte('fecha_fin', fin)
    out['Prestamo socio a pagar - Capital'] = -1 * (data ?? []).reduce((s: number, p: any) => s + (p.moneda === 'USD' ? Number(p.monto) * tc : Number(p.monto)), 0)
  }

  {
    const { data } = await sb.from('prestamo_devengamientos').select('monto').lte('mes', inicioDeMes(periodo))
    out['Prestamo socio a pagar - Intereses'] = -1 * (data ?? []).reduce((s: number, d: any) => s + Number(d.monto), 0)
  }

  {
    const { data } = await sb.from('facturas_compra').select('iva').lte('fecha_factura', fin)
    out['IVA CREDITO FISCAL'] = (data ?? []).reduce((s: number, f: any) => s + Number(f.iva), 0)
  }

  {
    const { data } = await sb.from('facturas_clientes').select('importe_iva').lte('fecha_emision', fin)
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

  {
    const { data } = await sb.from('facturas_clientes').select('importe, importe_neto, currency').eq('mes_servicio', periodo)
    out['Ventas a clientes'] = (data ?? []).reduce((s: number, f: any) => {
      const monto = f.importe_neto != null ? Number(f.importe_neto) : Number(f.importe)
      return s + (f.currency === 'USD' ? monto * tc : monto)
    }, 0)
  }

  {
    const { data: tipos } = await sb.from('tipos_gasto').select('id, nombre')
    for (const cuenta of cuentasGastos) {
      if (cuenta.nombre === 'Comisiones bancarias') continue
      const nombreBuscado = MAPEO_TIPO_GASTO[cuenta.nombre] ?? cuenta.nombre
      const tipo = (tipos ?? []).find((t: any) => t.nombre === nombreBuscado)
      if (!tipo) continue
      const [{ data: fc }, { data: tj }] = await Promise.all([
        sb.from('facturas_compra').select('monto_total').eq('tipo_gasto_id', tipo.id).gte('fecha_factura', inicio).lte('fecha_factura', fin),
        sb.from('tarjeta_credito').select('pesos, dolares').eq('tipo_gasto_id', tipo.id).gte('fecha', inicio).lte('fecha', fin),
      ])
      const totalFc = (fc ?? []).reduce((s: number, f: any) => s + Number(f.monto_total), 0)
      const totalTj = (tj ?? []).reduce((s: number, t: any) => s + (Number(t.pesos) || 0) + (Number(t.dolares) || 0) * tc, 0)
      out[cuenta.nombre] = -1 * (totalFc + totalTj)
    }
  }

  {
    const { data } = await sb.from('conciliacion_bancaria').select('credito_debito').eq('clasificacion', 'Comision bancaria').gte('fecha', inicio).lte('fecha', fin)
    out['Comisiones bancarias'] = -1 * (data ?? []).reduce((s: number, r: any) => s + Math.abs(Number(r.credito_debito)), 0)
  }

  {
    const { data } = await sb.from('conciliacion_bancaria').select('credito_debito').eq('clasificacion', 'Cash Back referido').gte('fecha', inicio).lte('fecha', fin)
    out['Cash Back Banco Galicia'] = (data ?? []).reduce((s: number, r: any) => s + Number(r.credito_debito), 0)
  }

  {
    const { data } = await sb.from('prestamo_devengamientos').select('monto').eq('mes', inicio)
    out['Intereses prestamo'] = -1 * (data ?? []).reduce((s: number, d: any) => s + Number(d.monto), 0)
  }

  {
    const anterior = mesAnterior(periodo)
    const cuotasInicio = await cuotasFciAlCierre(sb, finDeMes(anterior))
    const [{ data: cierreActual }, { data: cierreAnterior }] = await Promise.all([
      sb.from('inversiones_fci_cierres_mensuales').select('tc_fondo').eq('mes', inicio).limit(1),
      sb.from('inversiones_fci_cierres_mensuales').select('tc_fondo').eq('mes', inicioDeMes(anterior)).limit(1),
    ])
    if (cierreActual?.[0] && cierreAnterior?.[0]) {
      out['Intereses Ganados FCI'] = cuotasInicio * (Number(cierreActual[0].tc_fondo) - Number(cierreAnterior[0].tc_fondo))
    }
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

  let total = 0
  for (let m = 1; m <= mesSel; m++) {
    const periodoMes = `${anio}-${String(m).padStart(2, '0')}`
    const auto = await calcularSaldosResultadoAuto(sb, periodoMes, cuentasGastos)
    total += Object.values(auto).reduce((s, v) => s + v, 0)
  }

  if (cuentasManualIds.length) {
    const { data } = await sb.from('plan_cuentas_saldos').select('monto')
      .in('cuenta_id', cuentasManualIds).gte('periodo', `${anio}-01-01`).lte('periodo', inicioDeMes(periodo))
    total += (data ?? []).reduce((s, r: any) => s + Number(r.monto), 0)
  }

  return total
}
