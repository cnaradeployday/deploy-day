'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Plus, X } from 'lucide-react'

const EMPRESAS = ['SAS', 'LLC', 'MON', 'OTR']

export default function NuevoClientePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [newPayment, setNewPayment] = useState('')
  const [selectedPayments, setSelectedPayments] = useState<string[]>([])
  const [form, setForm] = useState({
    name: '', company: '', email: '', phone: '', notes: '',
    cuit: '', empresa_cobra: 'SAS',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    createClient().from('payment_methods').select('*').order('name')
      .then(({ data }) => setPaymentMethods(data ?? []))
  }, [])

  async function addPaymentMethod() {
    if (!newPayment.trim()) return
    const sb = createClient()
    const { data } = await sb.from('payment_methods').upsert({ name: newPayment.trim() }, { onConflict: 'name' }).select().single()
    if (data) {
      setPaymentMethods(prev => [...prev.filter(p => p.id !== data.id), data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewPayment('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('clients').insert({
      ...form, formas_pago: selectedPayments, created_by: user?.id
    })
    if (!error) router.push('/clientes')
    else { alert('Error al guardar'); setLoading(false) }
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Link href="/clientes" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-6">
        <ArrowLeft size={15}/> Volver
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Nuevo cliente</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        {[
          { key: 'name', label: 'Nombre *', placeholder: 'Nombre del cliente', required: true },
          { key: 'company', label: 'Empresa', placeholder: 'Nombre de la empresa' },
          { key: 'cuit', label: 'CUIT', placeholder: '20-12345678-9' },
          { key: 'email', label: 'Email', placeholder: 'email@empresa.com', type: 'email' },
          { key: 'phone', label: 'Teléfono', placeholder: '+54 11 1234-5678' },
        ].map(({ key, label, placeholder, required, type }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
            <input type={type ?? 'text'} value={(form as any)[key]}
              onChange={e => set(key, e.target.value)} required={required} placeholder={placeholder}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
          </div>
        ))}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Empresa que cobra</label>
          <select value={form.empresa_cobra} onChange={e => set('empresa_cobra', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white">
            {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Formas de pago</label>
          {selectedPayments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedPayments.map(p => (
                <span key={p} className="flex items-center gap-1.5 bg-[#E8F4FE] text-[#1B9BF0] text-xs px-2.5 py-1 rounded-full">
                  {p}
                  <button type="button" onClick={() => setSelectedPayments(prev => prev.filter(x => x !== p))}>
                    <X size={11}/>
                  </button>
                </span>
              ))}
            </div>
          )}
          <select
            value=""
            onChange={e => {
              if (e.target.value && !selectedPayments.includes(e.target.value))
                setSelectedPayments(prev => [...prev, e.target.value])
              e.target.value = ''
            }}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] bg-white mb-2">
            <option value="">+ Agregar forma de pago</option>
            {paymentMethods.filter(p => !selectedPayments.includes(p.name)).map(p => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input type="text" value={newPayment} onChange={e => setNewPayment(e.target.value)}
              placeholder="Nueva forma de pago..."
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPaymentMethod() }}}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
            <button type="button" onClick={addPaymentMethod}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm transition-all">
              <Plus size={14}/>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0] resize-none"/>
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/clientes" className="flex-1 text-center py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</Link>
          <button type="submit" disabled={loading}
            className="flex-1 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
            {loading ? 'Guardando...' : 'Guardar cliente'}
          </button>
        </div>
      </form>
    </div>
  )
}
