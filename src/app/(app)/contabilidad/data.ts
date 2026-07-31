import { SubdiarioFactura } from './SubdiarioFacturasClient'

function getEstadoEfectivo(f: any): string {
  if (f.estado === 'cobrada') return 'cobrada'
  if (f.estado === 'vencida') return 'vencida'
  if (f.fecha_vencimiento && new Date(f.fecha_vencimiento) < new Date()) return 'vencida'
  return 'pendiente'
}

export async function fetchSubdiarioFacturas(supabase: any) {
  const { data } = await supabase
    .from('facturas_clientes')
    .select('*, client:clients(name, company, razon_social, cuit)')
    .eq('sociedad', 'SAS')
    .order('fecha_emision', { ascending: false })

  const facturas: SubdiarioFactura[] = (data ?? []).map((f: any) => ({
    id: f.id,
    fecha_emision: f.fecha_emision,
    numero: f.numero,
    cuit: f.cuit ?? f.client?.cuit ?? '',
    razon_social: f.client?.razon_social ?? f.client?.company ?? f.client?.name ?? '',
    cliente: f.client?.name ?? '',
    estado: getEstadoEfectivo(f),
    importe: Number(f.importe ?? 0),
    importe_neto: f.importe_neto != null ? Number(f.importe_neto) : null,
    importe_iva: f.importe_iva != null ? Number(f.importe_iva) : null,
    currency: f.currency ?? 'ARS',
    mes_servicio: f.mes_servicio ?? null,
  }))

  const clientes = [...new Set(facturas.map(f => f.cliente).filter(Boolean))].sort()
  const meses = [...new Set(facturas.map(f => f.mes_servicio).filter((m): m is string => !!m))].sort().reverse()

  return { facturas, clientes, meses }
}
