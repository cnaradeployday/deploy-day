'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, TrendingUp, Trash2 } from 'lucide-react'

export default function CotizacionesClient({ cotizaciones }: { cotizaciones: any[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    usd_ars: ''
  })

  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    const { error } = await sb.from('cotizaciones').upsert({
      fecha: form.fecha,
      usd_ars: parseFloat(form.usd_ars),
      created_by: user?.id
    }, { onConflict: 'fecha' })
    if (error) alert('Error: ' + error.message)
    else { setForm(f => ({ ...f, usd_ars: '' })); router.refresh() }
    setLoading(false)
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta cotización?')) return
    await createClient().from('cotizaciones').delete().eq('id', id)
    router.refresh()
  }

  // Agrupar por mes
  const porMes: Record<string, any[]> = {}
  cotizaciones.forEach(c => {
    const mes = c.fecha.slice(0, 7)
    if (!porMes[mes]) porMes[mes] = []
    porMes[mes].push(c)
  })

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <TrendingUp size={18} className="text-[#1B9BF0]"/> Cotizaciones USD
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Se usa para convertir liquidaciones y facturas en USD a pesos argentinos</p>
      </div>

      {/* Formulario */}
      <form onSubmit={agregar} className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-4">Agregar cotización</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Fecha</label>
            <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">1 USD = ARS</label>
            <input type="number" min="0" step="0.01" value={form.usd_ars}
              onChange={e => setForm(f => ({ ...f, usd_ars: e.target.value }))} required
              placeholder="1250.00"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
        </div>
        <button type="submit" disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
          <Plus size={15}/> {loading ? 'Guardando...' : 'Agregar cotización'}
        </button>
      </form>

      {/* Lista por mes */}
      {Object.entries(porMes).map(([mes, items]) => {
        const last = items[0]
        return (
          <div key={mes} className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700 capitalize">
                {new Date(mes + '-01').toLocaleString('es-AR', { month: 'long', year: 'numeric' })}
              </h2>
              <span className="text-xs text-gray-400">
                Última: <span className="font-semibold text-gray-700">${Number(last.usd_ars).toLocaleString()}</span>
              </span>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
              {items.map(c => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-700">{new Date(c.fecha).toLocaleDateString('es-AR')}</span>
                    <span className="text-sm font-semibold text-gray-900">$ARS {Number(c.usd_ars).toLocaleString()}</span>
                    <span className="text-xs text-gray-400">por 1 USD</span>
                  </div>
                  <button onClick={() => eliminar(c.id)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all">
                    <Trash2 size={13}/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {!cotizaciones.length && (
        <div className="text-center py-12 text-gray-400">
          <TrendingUp size={32} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">Sin cotizaciones cargadas</p>
        </div>
      )}
    </div>
  )
}
